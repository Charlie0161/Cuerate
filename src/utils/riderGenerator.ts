/**
 * Cuerate — Technical Rider Generator
 * Builds an HTML string from rig data, prints to PDF via expo-print,
 * then shares via the native iOS/Android share sheet.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { GearItem, ConnectionType } from '../data/gearDatabase';
import { GigProfile } from '../store/rigStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiderData {
  djName: string;
  email?: string;
  gigName?: string;         // e.g. "Fabric Warm-up", "Wedding", "Festival"
  date?: string;
  venue?: string;
  // Gig rig
  controller: GearItem | null;
  mixer: GearItem | null;
  speakers: GearItem[];
  connections: Record<string, ConnectionType>;
  totalPowerDraw: number;
  // Home rig extras
  laptop: GearItem | null;
  headphones: GearItem | null;
}

// ─── Connection label map ─────────────────────────────────────────────────────

const CONN_LABELS: Record<ConnectionType, string> = {
  xlr: 'XLR', trs: 'TRS / Jack', rca: 'RCA', usb: 'USB',
  bluetooth: 'Bluetooth', hdmi: 'HDMI ARC', optical: 'Optical', phono: 'Phono/DIN',
};

const CATEGORY_LABELS: Record<string, string> = {
  controller: 'DJ Controller', mixer: 'Mixer', cdj: 'CDJ / Standalone Player',
  speaker: 'Speaker / Monitor', subwoofer: 'Subwoofer', amplifier: 'Amplifier',
  headphones: 'Headphones', laptop: 'Laptop',
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

function gearRow(item: GearItem, conn?: ConnectionType): string {
  const connStr = conn ? CONN_LABELS[conn] : '';
  const powerStr = item.powerDraw > 0 ? `${item.powerDraw}W` : 'USB powered';
  const noteStr = item.notes ?? '';
  return `
    <tr>
      <td class="gear-name"><strong>${item.brand} ${item.model}</strong>${noteStr ? `<br><span class="note">${noteStr}</span>` : ''}</td>
      <td class="gear-type">${CATEGORY_LABELS[item.category] ?? item.category}</td>
      <td class="gear-conn">${connStr || '—'}</td>
      <td class="gear-power">${powerStr}</td>
    </tr>`;
}

export function buildRiderHTML(data: RiderData): string {
  const allGear: { item: GearItem; conn?: ConnectionType }[] = [];
  if (data.controller) allGear.push({ item: data.controller });
  if (data.mixer)      allGear.push({ item: data.mixer });
  if (data.laptop)     allGear.push({ item: data.laptop });
  data.speakers.forEach(s => allGear.push({ item: s, conn: data.connections[s.id] }));
  if (data.headphones) allGear.push({ item: data.headphones });

  const powerColor = data.totalPowerDraw > 2000 ? '#FF4D4D'
    : data.totalPowerDraw > 1200 ? '#F5A623' : '#4DCC8F';

  const hasConnections = data.speakers.length > 0;
  const connectionNotes = data.speakers.map(s => {
    const conn = data.connections[s.id];
    return conn ? `${s.brand} ${s.model}: connect via <strong>${CONN_LABELS[conn]}</strong>` : '';
  }).filter(Boolean);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Technical Rider — ${data.djName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #1a1a2e;
      padding: 40px;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #7C5CFC;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-mark {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #7C5CFC, #B05AF5);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 22px; font-weight: 800;
    }
    .logo-text { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #7C5CFC; text-transform: uppercase; }
    .dj-name { font-size: 26px; font-weight: 800; color: #1a1a2e; line-height: 1.1; }
    .doc-meta { text-align: right; font-size: 11px; color: #888; line-height: 1.8; }
    .doc-meta strong { color: #1a1a2e; }

    /* Gig info bar */
    .gig-bar {
      background: #f8f7ff;
      border: 1px solid #e0d9ff;
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      gap: 32px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .gig-item { display: flex; flex-direction: column; gap: 2px; }
    .gig-label { font-size: 10px; font-weight: 700; color: #7C5CFC; text-transform: uppercase; letter-spacing: 0.8px; }
    .gig-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }

    /* Section */
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 11px; font-weight: 700; letter-spacing: 1px;
      text-transform: uppercase; color: #7C5CFC;
      border-bottom: 1px solid #e8e4ff;
      padding-bottom: 6px; margin-bottom: 14px;
    }

    /* Gear table */
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; font-size: 10px; font-weight: 700;
      color: #888; text-transform: uppercase; letter-spacing: 0.6px;
      padding: 8px 10px; border-bottom: 2px solid #f0eeff;
    }
    td { padding: 10px; border-bottom: 1px solid #f5f3ff; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #faf9ff; }
    .gear-name { width: 40%; }
    .gear-type { width: 22%; color: #555; }
    .gear-conn { width: 20%; }
    .gear-power { width: 18%; font-family: monospace; }
    .note { font-size: 11px; color: #888; font-style: italic; }

    /* Power summary */
    .power-box {
      background: #f8f7ff;
      border: 2px solid;
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .power-label { font-size: 12px; color: #555; margin-bottom: 2px; }
    .power-value { font-size: 28px; font-weight: 800; }
    .power-note { font-size: 11px; color: #888; margin-top: 4px; }
    .power-requirements { font-size: 12px; color: #555; line-height: 1.8; }

    /* Connection notes */
    .conn-list { list-style: none; padding: 0; }
    .conn-list li {
      padding: 8px 0;
      border-bottom: 1px solid #f0eeff;
      font-size: 13px;
      color: #333;
    }
    .conn-list li:last-child { border-bottom: none; }

    /* Requirements */
    .req-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .req-item {
      background: #f8f7ff; border: 1px solid #e8e4ff;
      border-radius: 8px; padding: 12px 14px;
    }
    .req-item-label { font-size: 10px; font-weight: 700; color: #7C5CFC; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .req-item-value { font-size: 13px; color: #1a1a2e; font-weight: 500; }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e8e4ff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #aaa;
    }
    .footer strong { color: #7C5CFC; }

    /* Signature block */
    .sig-block {
      margin-top: 32px;
      padding: 16px;
      border: 1px dashed #ccc;
      border-radius: 8px;
      display: flex;
      gap: 40px;
    }
    .sig-line {
      flex: 1;
      border-top: 1px solid #333;
      padding-top: 6px;
      font-size: 11px;
      color: #888;
      margin-top: 32px;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <div class="logo-mark">C</div>
      <div>
        <div class="logo-text">Cuerate</div>
        <div class="dj-name">${data.djName}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Technical Rider</div>
      </div>
    </div>
    <div class="doc-meta">
      <div>Generated: <strong>${today}</strong></div>
      ${data.email ? `<div>Contact: <strong>${data.email}</strong></div>` : ''}
      <div style="margin-top:6px;font-size:10px;color:#bbb;">Built with Cuerate · cuerate.co.uk</div>
    </div>
  </div>

  <!-- Gig info bar -->
  ${(data.gigName || data.date || data.venue) ? `
  <div class="gig-bar">
    ${data.gigName ? `<div class="gig-item"><div class="gig-label">Event / Gig</div><div class="gig-value">${data.gigName}</div></div>` : ''}
    ${data.date ? `<div class="gig-item"><div class="gig-label">Date</div><div class="gig-value">${data.date}</div></div>` : ''}
    ${data.venue ? `<div class="gig-item"><div class="gig-label">Venue</div><div class="gig-value">${data.venue}</div></div>` : ''}
  </div>` : ''}

  <!-- Equipment list -->
  <div class="section">
    <div class="section-title">Equipment List</div>
    ${allGear.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Type</th>
          <th>Connection</th>
          <th>Power</th>
        </tr>
      </thead>
      <tbody>
        ${allGear.map(({ item, conn }) => gearRow(item, conn)).join('')}
      </tbody>
    </table>` : '<p style="color:#888;font-style:italic;">No equipment added to this rig profile.</p>'}
  </div>

  <!-- Power requirements -->
  ${data.totalPowerDraw > 0 ? `
  <div class="section">
    <div class="section-title">Power Requirements</div>
    <div class="power-box" style="border-color:${powerColor}22;background:${powerColor}08;">
      <div>
        <div class="power-label">Total estimated draw</div>
        <div class="power-value" style="color:${powerColor};">${data.totalPowerDraw}W</div>
        <div class="power-note">Based on manufacturer specs — actual draw may vary</div>
      </div>
      <div class="power-requirements">
        <div>✓ Requires <strong>${Math.ceil(data.totalPowerDraw / 230 * 1.3 * 10) / 10}A</strong> minimum at 230V</div>
        <div>✓ Dedicated ${data.totalPowerDraw > 1500 ? '16A' : '13A'} circuit recommended</div>
        <div>✓ ${Math.ceil(data.totalPowerDraw / 1000 + 0.5)} power sockets required</div>
        ${data.totalPowerDraw > 2000 ? '<div style="color:#FF4D4D;">⚠ High draw — check venue supply</div>' : ''}
      </div>
    </div>
  </div>` : ''}

  <!-- Connection requirements -->
  ${connectionNotes.length > 0 ? `
  <div class="section">
    <div class="section-title">Connection Requirements</div>
    <ul class="conn-list">
      ${connectionNotes.map(n => `<li>→ ${n}</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Venue requirements -->
  <div class="section">
    <div class="section-title">Venue Requirements</div>
    <div class="req-grid">
      <div class="req-item">
        <div class="req-item-label">Stage / Booth</div>
        <div class="req-item-value">Minimum 1.5m × 1m clear space for DJ setup</div>
      </div>
      <div class="req-item">
        <div class="req-item-label">Lighting</div>
        <div class="req-item-value">Adequate booth lighting for equipment operation</div>
      </div>
      <div class="req-item">
        <div class="req-item-label">Power sockets</div>
        <div class="req-item-value">${Math.ceil(data.totalPowerDraw / 1000 + 1)} × UK 3-pin sockets minimum, within 2m of booth</div>
      </div>
      <div class="req-item">
        <div class="req-item-label">Cable management</div>
        <div class="req-item-value">Cable trunking or taped-down runs for safety</div>
      </div>
      ${data.controller?.standaloneCompatible === false ? `
      <div class="req-item">
        <div class="req-item-label">Internet</div>
        <div class="req-item-value">WiFi or ethernet access for software licensing (if required)</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Notes -->
  <div class="section">
    <div class="section-title">Additional Notes</div>
    <ul class="conn-list">
      <li>Please ensure all equipment listed above is set up and powered on 30 minutes before performance.</li>
      <li>DJ will bring all cables required for the connections listed above.</li>
      <li>Any substitution of listed equipment must be agreed in advance.</li>
      ${data.headphones ? `<li>DJ uses ${data.headphones.brand} ${data.headphones.model} headphones — no headphone amplifier required.</li>` : ''}
    </ul>
  </div>

  <!-- Signature block -->
  <div class="sig-block">
    <div>
      <div style="font-size:11px;color:#888;margin-bottom:28px;">DJ / Artist</div>
      <div class="sig-line">${data.djName}</div>
    </div>
    <div>
      <div style="font-size:11px;color:#888;margin-bottom:28px;">Venue / Promoter</div>
      <div class="sig-line">Name &amp; Signature</div>
    </div>
    <div>
      <div style="font-size:11px;color:#888;margin-bottom:28px;">Date</div>
      <div class="sig-line">&nbsp;</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Generated by <strong>Cuerate</strong> — cuerate.co.uk</div>
    <div>${data.djName} · Technical Rider · ${today}</div>
  </div>

</body>
</html>`;
}

// ─── Generate + share ─────────────────────────────────────────────────────────

export async function generateAndShareRider(data: RiderData): Promise<void> {
  const html = buildRiderHTML(data);

  // Print to PDF
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Share via native share sheet
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${data.djName} — Technical Rider`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    // Fallback — open in browser/PDF viewer
    await Print.printAsync({ uri });
  }
}

// ─── Build RiderData from rigStore state ──────────────────────────────────────

export function buildRiderDataFromGig(
  gigProfile: GigProfile,
  djName: string,
  email: string | null | undefined,
  totalPowerDraw: number,
  gigName?: string,
  date?: string,
  venue?: string,
): RiderData {
  return {
    djName: djName || 'DJ',
    email: email ?? undefined,
    gigName,
    date,
    venue,
    controller: gigProfile.controller,
    mixer: gigProfile.mixer,
    speakers: gigProfile.speakers,
    connections: gigProfile.activeConnections,
    totalPowerDraw,
    laptop: null,
    headphones: null,
  };
}

export function buildRiderDataFromHome(
  controller: GearItem | null,
  speakers: GearItem[],
  connections: Record<string, ConnectionType>,
  laptop: GearItem | null,
  headphones: GearItem | null,
  djName: string,
  email: string | null | undefined,
  totalPowerDraw: number,
): RiderData {
  return {
    djName: djName || 'DJ',
    email: email ?? undefined,
    controller,
    mixer: null,
    speakers,
    connections,
    totalPowerDraw,
    laptop,
    headphones,
  };
}
