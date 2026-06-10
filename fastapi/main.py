"""
Cuerate Track Analyser — FastAPI server
Polls Supabase for pending track_submissions, downloads audio via yt-dlp,
analyses BPM + key with librosa, converts to Camelot notation, updates row.
"""

import os
import asyncio
import tempfile
import logging
from pathlib import Path
from typing import List

import librosa
import numpy as np
import yt_dlp
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cuerate-analyser")

# ─── Env vars ────────────────────────────────────────────────────────────────
SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_SECRET     = os.environ["WORKER_SECRET"]
POLL_INTERVAL     = int(os.environ.get("POLL_INTERVAL_SECS", "30"))
PLAYLIST_CAP      = int(os.environ.get("PLAYLIST_CAP", "20"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
app = FastAPI(title="Cuerate Track Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Camelot wheel conversion ─────────────────────────────────────────────────

CAMELOT_MAP = {
  "C minor":   "5A",  "C# minor": "12A", "Db minor": "12A",
  "D minor":   "7A",  "D# minor": "2A",  "Eb minor": "2A",
  "E minor":   "9A",  "F minor":  "4A",  "F# minor": "11A",
  "Gb minor":  "11A", "G minor":  "6A",  "G# minor": "1A",
  "Ab minor":  "1A",  "A minor":  "8A",  "A# minor": "3A",
  "Bb minor":  "3A",  "B minor":  "10A",
  "C major":   "8B",  "C# major": "3B",  "Db major": "3B",
  "D major":   "10B", "D# major": "5B",  "Eb major": "5B",
  "E major":   "12B", "F major":  "7B",  "F# major": "2B",
  "Gb major":  "2B",  "G major":  "9B",  "G# major": "4B",
  "Ab major":  "4B",  "A major":  "11B", "A# major": "6B",
  "Bb major":  "6B",  "B major":  "1B",
}

def librosa_key_to_camelot(key_string: str) -> tuple[str, str]:
  camelot = CAMELOT_MAP.get(key_string, "")
  parts = key_string.split()
  if len(parts) == 2:
    root, mode = parts
    musical = root + ("m" if mode == "minor" else "")
  else:
    musical = key_string
  return musical, camelot

# ─── Audio analysis ───────────────────────────────────────────────────────────

def analyse_audio(filepath: str) -> dict:
  log.info(f"Analysing {filepath}")
  y, sr = librosa.load(filepath, sr=22050, mono=True, duration=180)

  tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
  bpm = int(round(float(np.median(tempo))))

  chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
  chroma_mean = np.mean(chroma, axis=1)
  notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
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
    wav_path = str(Path(filename).with_suffix(".wav"))
    if not Path(wav_path).exists():
      files = list(Path(out_dir).glob("*.*"))
      if not files:
        raise FileNotFoundError("Download produced no output file")
      wav_path = str(files[0])
  return wav_path

# ─── Extract playlist metadata (no download) ─────────────────────────────────

def extract_playlist_info(url: str, cap: int) -> List[dict]:
  """
  Returns list of dicts: {title, artist, url, thumbnail, duration_secs, platform}
  Does NOT download audio — metadata extraction only.
  """
  ydl_opts = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": "in_playlist",   # metadata only, no download
    "socket_timeout": 20,
    "playlistend": cap,              # respect the cap
  }
  tracks = []
  with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
    entries = info.get("entries") or []
    for entry in entries[:cap]:
      if not entry:
        continue
      # Determine platform from url
      webpage = entry.get("url") or entry.get("webpage_url") or ""
      if "soundcloud" in webpage or "soundcloud" in url:
        platform = "soundcloud"
      elif "youtube" in webpage or "youtu.be" in webpage or "youtube" in url:
        platform = "youtube"
      else:
        platform = "soundcloud"  # fallback

      # Extract artist from uploader or track title split
      raw_title = entry.get("title") or "Unknown"
      uploader  = entry.get("uploader") or entry.get("channel") or ""
      # Many SoundCloud tracks are formatted as "Artist - Title"
      if " - " in raw_title:
        parts  = raw_title.split(" - ", 1)
        artist = parts[0].strip()
        title  = parts[1].strip()
      else:
        artist = uploader
        title  = raw_title

      track_url = entry.get("url") or entry.get("webpage_url") or ""
      # For YouTube flat extraction, url may just be the video id
      if platform == "youtube" and not track_url.startswith("http"):
        track_url = f"https://www.youtube.com/watch?v={entry.get('id', '')}"

      tracks.append({
        "title":        title,
        "artist":       artist,
        "url":          track_url,
        "thumbnail":    entry.get("thumbnail") or entry.get("thumbnails", [{}])[-1].get("url"),
        "duration_secs": entry.get("duration"),
        "platform":     platform,
      })

  return tracks

# ─── Core worker ─────────────────────────────────────────────────────────────

async def process_submission(submission_id: str, url: str):
  log.info(f"Processing submission {submission_id}: {url}")
  supabase.table("track_submissions").update({"status": "analysing"}).eq("id", submission_id).execute()

  try:
    with tempfile.TemporaryDirectory() as tmp:
      filepath = await asyncio.to_thread(download_audio, url, tmp)
      results  = await asyncio.to_thread(analyse_audio, filepath)

    supabase.table("track_submissions").update({
      "status":        "ready",
      "bpm":           results["bpm"],
      "musical_key":   results["musical_key"],
      "camelot_key":   results["camelot_key"],
      "energy":        results["energy"],
      "analysed_at":   "now()",
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
        .limit(5)
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
  if x_worker_secret != WORKER_SECRET:
    raise HTTPException(status_code=401, detail="Unauthorised")
  asyncio.create_task(process_submission(req.submission_id, req.url))
  return {"queued": req.submission_id}

# ─── Playlist endpoint ────────────────────────────────────────────────────────

class PlaylistRequest(BaseModel):
  url: str

class PlaylistTrack(BaseModel):
  title: str
  artist: str
  url: str
  thumbnail: str | None
  duration_secs: int | None
  platform: str

class PlaylistResponse(BaseModel):
  tracks: List[PlaylistTrack]
  total_found: int
  capped: bool

@app.post("/playlist/info", response_model=PlaylistResponse)
async def playlist_info(req: PlaylistRequest, x_worker_secret: str = Header(None)):
  """
  Extract track metadata from a playlist URL without downloading audio.
  Called by the web app before the user confirms submission.
  """
  if x_worker_secret != WORKER_SECRET:
    raise HTTPException(status_code=401, detail="Unauthorised")

  # Validate platform
  url = req.url.lower()
  if "soundcloud.com" not in url and "youtube.com" not in url and "youtu.be" not in url:
    raise HTTPException(status_code=400, detail="Only SoundCloud and YouTube playlists are supported.")

  try:
    # Extract one extra to know if we hit the cap
    tracks_raw = await asyncio.to_thread(extract_playlist_info, req.url, PLAYLIST_CAP + 1)
  except Exception as e:
    raise HTTPException(status_code=422, detail=f"Could not read playlist: {str(e)[:200]}")

  capped = len(tracks_raw) > PLAYLIST_CAP
  tracks = tracks_raw[:PLAYLIST_CAP]

  return PlaylistResponse(
    tracks=[PlaylistTrack(**t) for t in tracks],
    total_found=len(tracks_raw),
    capped=capped,
  )
