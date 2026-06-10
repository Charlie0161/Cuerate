"""
Cuerate Track Analyser — FastAPI server
Polls Supabase for pending track_submissions, downloads audio via yt-dlp,
analyses BPM + key with librosa, converts to Camelot notation, updates row.

Deploy on any VPS (Railway, Render, Fly.io etc.) with the env vars below.
"""

import os
import asyncio
import tempfile
import logging
from pathlib import Path

import librosa
import numpy as np
import yt_dlp
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cuerate-analyser")

# ─── Env vars ────────────────────────────────────────────────────────────────
SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # service role — can bypass RLS
WORKER_SECRET     = os.environ["WORKER_SECRET"]              # shared secret to protect /analyse endpoint
POLL_INTERVAL     = int(os.environ.get("POLL_INTERVAL_SECS", "30"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
app = FastAPI(title="Cuerate Track Analyser")

# ─── Camelot wheel conversion ─────────────────────────────────────────────────
# librosa returns a Krumhansl-Schmuckler key string e.g. 'C major', 'A minor'
# We map that to Camelot notation.

CAMELOT_MAP = {
  # Minor keys → A
  "C minor":   "5A",  "C# minor": "12A", "Db minor": "12A",
  "D minor":   "7A",  "D# minor": "2A",  "Eb minor": "2A",
  "E minor":   "9A",  "F minor":  "4A",  "F# minor": "11A",
  "Gb minor":  "11A", "G minor":  "6A",  "G# minor": "1A",
  "Ab minor":  "1A",  "A minor":  "8A",  "A# minor": "3A",
  "Bb minor":  "3A",  "B minor":  "10A",
  # Major keys → B
  "C major":   "8B",  "C# major": "3B",  "Db major": "3B",
  "D major":   "10B", "D# major": "5B",  "Eb major": "5B",
  "E major":   "12B", "F major":  "7B",  "F# major": "2B",
  "Gb major":  "2B",  "G major":  "9B",  "G# major": "4B",
  "Ab major":  "4B",  "A major":  "11B", "A# major": "6B",
  "Bb major":  "6B",  "B major":  "1B",
}

def librosa_key_to_camelot(key_string: str) -> tuple[str, str]:
  """Returns (musical_key, camelot_key) e.g. ('Am', '8A')"""
  # librosa key_to_notes returns e.g. 'C major' or 'A minor'
  camelot = CAMELOT_MAP.get(key_string, "")
  # Shorten e.g. 'A minor' → 'Am', 'C major' → 'C'
  parts = key_string.split()
  if len(parts) == 2:
    root, mode = parts
    musical = root + ("m" if mode == "minor" else "")
  else:
    musical = key_string
  return musical, camelot

# ─── Audio analysis ───────────────────────────────────────────────────────────

def analyse_audio(filepath: str) -> dict:
  """Load audio file and return BPM, key, energy."""
  log.info(f"Analysing {filepath}")
  y, sr = librosa.load(filepath, sr=22050, mono=True, duration=180)  # analyse first 3 min

  # BPM — use beat tracker, take median for stability
  tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
  bpm = int(round(float(np.median(tempo))))

  # Musical key
  chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
  chroma_mean = np.mean(chroma, axis=1)
  key_idx = int(np.argmax(chroma_mean))
  # Build key string matching CAMELOT_MAP keys
  notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  # Use Krumhansl-Schmuckler profiles to determine major vs minor
  major_profile = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
  minor_profile = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])

  best_score, best_key_str = -999, "C major"
  for i in range(12):
    rotated = np.roll(chroma_mean, -i)
    maj_score = np.corrcoef(rotated, major_profile)[0,1]
    min_score = np.corrcoef(rotated, minor_profile)[0,1]
    if maj_score > best_score:
      best_score = maj_score
      best_key_str = f"{notes[i]} major"
    if min_score > best_score:
      best_score = min_score
      best_key_str = f"{notes[i]} minor"

  musical_key, camelot_key = librosa_key_to_camelot(best_key_str)

  # Energy — RMS normalised 0–1
  rms = librosa.feature.rms(y=y)
  energy = float(np.clip(np.mean(rms) * 10, 0, 1))

  return {
    "bpm": bpm,
    "musical_key": musical_key,
    "camelot_key": camelot_key,
    "energy": round(energy, 4),
  }

# ─── Download audio ───────────────────────────────────────────────────────────

def download_audio(url: str, out_dir: str) -> str:
  """Download best audio from URL using yt-dlp. Returns filepath."""
  ydl_opts = {
    "format": "bestaudio/best",
    "outtmpl": str(Path(out_dir) / "%(id)s.%(ext)s"),
    "postprocessors": [{
      "key": "FFmpegExtractAudio",
      "preferredcodec": "wav",
      "preferredquality": "0",
    }],
    "quiet": True,
    "no_warnings": True,
    "socket_timeout": 30,
  }
  with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=True)
    filename = ydl.prepare_filename(info)
    # After postprocessing, extension is .wav
    wav_path = str(Path(filename).with_suffix(".wav"))
    if not Path(wav_path).exists():
      # Fallback: find any audio file in out_dir
      files = list(Path(out_dir).glob("*.*"))
      if not files:
        raise FileNotFoundError("Download produced no output file")
      wav_path = str(files[0])
  return wav_path

# ─── Core worker ─────────────────────────────────────────────────────────────

async def process_submission(submission_id: str, url: str):
  """Mark as analysing, download, analyse, update row."""
  log.info(f"Processing submission {submission_id}: {url}")

  # Mark as analysing
  supabase.table("track_submissions").update({"status": "analysing"}).eq("id", submission_id).execute()

  try:
    with tempfile.TemporaryDirectory() as tmp:
      filepath = await asyncio.to_thread(download_audio, url, tmp)
      results  = await asyncio.to_thread(analyse_audio, filepath)

    supabase.table("track_submissions").update({
      "status":       "ready",
      "bpm":          results["bpm"],
      "musical_key":  results["musical_key"],
      "camelot_key":  results["camelot_key"],
      "energy":       results["energy"],
      "analysed_at":  "now()",
      "error_message": None,
    }).eq("id", submission_id).execute()

    log.info(f"✓ {submission_id} — {results['bpm']} BPM, {results['camelot_key']}")

  except Exception as e:
    log.error(f"✗ {submission_id} failed: {e}")
    supabase.table("track_submissions").update({
      "status": "failed",
      "error_message": str(e)[:500],
    }).eq("id", submission_id).execute()

# ─── Background polling loop ──────────────────────────────────────────────────

async def poll_loop():
  log.info(f"Worker started — polling every {POLL_INTERVAL}s")
  while True:
    try:
      res = (
        supabase.table("track_submissions")
        .select("id, external_url")
        .eq("status", "pending")
        .order("created_at")
        .limit(5)          # process 5 at a time
        .execute()
      )
      for row in (res.data or []):
        await process_submission(row["id"], row["external_url"])
    except Exception as e:
      log.error(f"Poll error: {e}")
    await asyncio.sleep(POLL_INTERVAL)

@app.on_event("startup")
async def startup():
  asyncio.create_task(poll_loop())

# ─── HTTP endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
  return {"status": "ok"}

class AnalyseRequest(BaseModel):
  submission_id: str
  url: str

@app.post("/analyse")
async def analyse_now(req: AnalyseRequest, x_worker_secret: str = Header(None)):
  """Trigger immediate analysis of a specific submission (webhook-style)."""
  if x_worker_secret != WORKER_SECRET:
    raise HTTPException(status_code=401, detail="Unauthorised")
  asyncio.create_task(process_submission(req.submission_id, req.url))
  return {"queued": req.submission_id}
