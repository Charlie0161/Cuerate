export type ConnectionType =
  | 'usb'
  | 'xlr'
  | 'rca'
  | 'trs'
  | 'bluetooth'
  | 'hdmi'
  | 'optical'
  | 'phono';

export type GearCategory =
  | 'controller'
  | 'mixer'
  | 'speaker'
  | 'subwoofer'
  | 'soundbar'
  | 'headphones'
  | 'interface'
  | 'cdj'
  | 'laptop'
  | 'amplifier';

export interface GearItem {
  id: string;
  brand: string;
  model: string;
  category: GearCategory;
  powerDraw: number;
  connections: ConnectionType[];
  maxSampleRate?: number;
  maxBitDepth?: number;
  standaloneCompatible?: boolean;
  notes?: string;
  warningFlags?: string[];
  // Headphone specific
  impedanceOhms?: number;
  driverMm?: number;
  // Laptop specific
  os?: 'mac' | 'windows' | 'ios' | 'android';
  softwareCompatibility?: string[];
  cpuWarning?: boolean;
}

export interface CompatibilityWarning {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  fix: string;
  latencyMs?: number;
}

// ─── Affiliate tags — fill in when accounts are approved ────────────────────
export const AFFILIATE_TAGS = {
  thomann:   '',  // e.g. 'cuerate'
  andertons: '',  // e.g. 'cuerate'
  amazon:    '',  // e.g. 'cuerate-21'
};

export function getBuyLinks(brand: string, model: string) {
  const q = encodeURIComponent(`${brand} ${model}`);
  const t = AFFILIATE_TAGS.thomann   ? `&partner=${AFFILIATE_TAGS.thomann}`   : '';
  const a = AFFILIATE_TAGS.andertons ? `&ref=${AFFILIATE_TAGS.andertons}`     : '';
  const z = AFFILIATE_TAGS.amazon    ? `&tag=${AFFILIATE_TAGS.amazon}`        : '';
  return {
    thomann:   `https://www.thomann.de/gb/search_dir.html?sw=${q}${t}`,
    andertons: `https://www.andertons.co.uk/search?q=${q}${a}`,
    amazon:    `https://www.amazon.co.uk/s?k=${q}${z}`,
  };
}

export const GEAR_DATABASE: GearItem[] = [
  // ── Controllers ─────────────────────────────────────────────────────────
  {
    id: 'pioneer-ddj-flx4',
    brand: 'Pioneer',
    model: 'DDJ-FLX4',
    category: 'controller',
    powerDraw: 12,
    connections: ['usb', 'rca', 'trs'],
    maxSampleRate: 44100,
    maxBitDepth: 24,
    standaloneCompatible: false,
    notes: 'USB bus powered. Requires laptop/PC.',
  },
  {
    id: 'pioneer-ddj-flx6',
    brand: 'Pioneer',
    model: 'DDJ-FLX6-GT',
    category: 'controller',
    powerDraw: 18,
    connections: ['usb', 'rca', 'trs', 'phono'],
    maxSampleRate: 48000,
    maxBitDepth: 24,
    standaloneCompatible: false,
  },
  {
    id: 'pioneer-ddj-rev7',
    brand: 'Pioneer',
    model: 'DDJ-REV7',
    category: 'controller',
    powerDraw: 40,
    connections: ['usb', 'xlr', 'rca', 'trs', 'phono'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: false,
  },
  {
    id: 'pioneer-ddj-sb3',
    brand: 'Pioneer',
    model: 'DDJ-SB3',
    category: 'controller',
    powerDraw: 10,
    connections: ['usb', 'rca'],
    maxSampleRate: 44100,
    maxBitDepth: 16,
    standaloneCompatible: false,
  },
  {
    id: 'pioneer-ddj-400',
    brand: 'Pioneer',
    model: 'DDJ-400',
    category: 'controller',
    powerDraw: 10,
    connections: ['usb', 'rca'],
    maxSampleRate: 44100,
    maxBitDepth: 24,
    standaloneCompatible: false,
  },
  {
    id: 'denon-mcx8000',
    brand: 'Denon',
    model: 'MCX8000',
    category: 'controller',
    powerDraw: 30,
    connections: ['usb', 'xlr', 'rca', 'trs'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: true,
  },
  {
    id: 'native-instruments-traktor-s4',
    brand: 'Native Instruments',
    model: 'Traktor S4 MK3',
    category: 'controller',
    powerDraw: 20,
    connections: ['usb', 'rca', 'trs'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: false,
    warningFlags: ['traktor-only'],
    notes: 'Requires Traktor Pro software. Not compatible with Serato or rekordbox.',
  },
  {
    id: 'rane-one',
    brand: 'Rane',
    model: 'ONE',
    category: 'controller',
    powerDraw: 25,
    connections: ['usb', 'xlr', 'rca', 'phono'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: false,
    warningFlags: ['serato-only'],
    notes: 'Serato DJ Pro only.',
  },
  // ── CDJ / Standalone ────────────────────────────────────────────────────
  {
    id: 'pioneer-xdj-rx3',
    brand: 'Pioneer',
    model: 'XDJ-RX3',
    category: 'cdj',
    powerDraw: 35,
    connections: ['usb', 'xlr', 'rca'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: true,
    warningFlags: ['no-32bit', 'no-vbr-mp3'],
    notes: 'Standalone. Does NOT load 32-bit WAV or VBR MP3.',
  },
  {
    id: 'pioneer-xdj-xz',
    brand: 'Pioneer',
    model: 'XDJ-XZ',
    category: 'cdj',
    powerDraw: 45,
    connections: ['usb', 'xlr', 'rca', 'phono'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: true,
    warningFlags: ['no-32bit', 'no-vbr-mp3'],
  },
  {
    id: 'pioneer-cdj-3000',
    brand: 'Pioneer',
    model: 'CDJ-3000',
    category: 'cdj',
    powerDraw: 28,
    connections: ['usb', 'xlr', 'rca'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
    standaloneCompatible: true,
    warningFlags: ['no-32bit', 'no-vbr-mp3'],
  },
  {
    id: 'denon-sc6000',
    brand: 'Denon',
    model: 'SC6000M',
    category: 'cdj',
    powerDraw: 30,
    connections: ['usb', 'xlr', 'rca'],
    maxSampleRate: 96000,
    maxBitDepth: 32,
    standaloneCompatible: true,
    notes: 'Supports 32-bit audio. No VBR restrictions.',
  },
  {
    id: 'denon-sc5000',
    brand: 'Denon',
    model: 'SC5000M',
    category: 'cdj',
    powerDraw: 25,
    connections: ['usb', 'xlr', 'rca'],
    maxSampleRate: 96000,
    maxBitDepth: 32,
    standaloneCompatible: true,
  },
  // ── Mixers ──────────────────────────────────────────────────────────────
  {
    id: 'pioneer-djm-900nxs2',
    brand: 'Pioneer',
    model: 'DJM-900NXS2',
    category: 'mixer',
    powerDraw: 38,
    connections: ['xlr', 'rca', 'trs', 'phono', 'usb'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
  },
  {
    id: 'pioneer-djm-750mk2',
    brand: 'Pioneer',
    model: 'DJM-750MK2',
    category: 'mixer',
    powerDraw: 30,
    connections: ['xlr', 'rca', 'trs', 'phono', 'usb'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
  },
  {
    id: 'pioneer-djm-s9',
    brand: 'Pioneer',
    model: 'DJM-S9',
    category: 'mixer',
    powerDraw: 28,
    connections: ['xlr', 'rca', 'trs', 'phono', 'usb'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
  },
  {
    id: 'allen-heath-xone96',
    brand: 'Allen & Heath',
    model: 'Xone:96',
    category: 'mixer',
    powerDraw: 65,
    connections: ['xlr', 'rca', 'trs', 'phono'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
  },
  {
    id: 'allen-heath-xone43',
    brand: 'Allen & Heath',
    model: 'Xone:43',
    category: 'mixer',
    powerDraw: 40,
    connections: ['xlr', 'rca', 'trs', 'phono'],
  },
  {
    id: 'rane-mp2015',
    brand: 'Rane',
    model: 'MP2015',
    category: 'mixer',
    powerDraw: 35,
    connections: ['xlr', 'rca', 'trs', 'phono'],
    maxSampleRate: 96000,
    maxBitDepth: 24,
  },
  // ── Studio Monitors ─────────────────────────────────────────────────────
  {
    id: 'pioneer-dm-40d',
    brand: 'Pioneer',
    model: 'DM-40D',
    category: 'speaker',
    powerDraw: 42,
    connections: ['rca', 'trs', 'optical', 'bluetooth'],
    warningFlags: ['bluetooth-latency'],
    notes: 'Bluetooth adds ~150ms latency. Use RCA or TRS for live play.',
  },
  {
    id: 'pioneer-dm-50d',
    brand: 'Pioneer',
    model: 'DM-50D-BT',
    category: 'speaker',
    powerDraw: 60,
    connections: ['rca', 'trs', 'optical', 'bluetooth'],
    warningFlags: ['bluetooth-latency'],
  },
  {
    id: 'yamaha-hs5',
    brand: 'Yamaha',
    model: 'HS5',
    category: 'speaker',
    powerDraw: 70,
    connections: ['xlr', 'trs'],
    notes: 'Studio reference monitor. Flat frequency response.',
  },
  {
    id: 'yamaha-hs7',
    brand: 'Yamaha',
    model: 'HS7',
    category: 'speaker',
    powerDraw: 95,
    connections: ['xlr', 'trs'],
  },
  {
    id: 'krk-rokit-5',
    brand: 'KRK',
    model: 'Rokit 5 G4',
    category: 'speaker',
    powerDraw: 55,
    connections: ['xlr', 'trs'],
  },
  {
    id: 'adam-t5v',
    brand: 'Adam Audio',
    model: 'T5V',
    category: 'speaker',
    powerDraw: 70,
    connections: ['xlr', 'trs', 'rca'],
  },
  // ── PA Speakers ─────────────────────────────────────────────────────────
  {
    id: 'ev-zlx-12p',
    brand: 'Electro-Voice',
    model: 'ZLX-12P',
    category: 'speaker',
    powerDraw: 1000,
    connections: ['xlr', 'trs'],
    notes: 'Pro PA speaker. 126dB SPL.',
  },
  {
    id: 'mackie-thump15a',
    brand: 'Mackie',
    model: 'Thump15A',
    category: 'speaker',
    powerDraw: 1300,
    connections: ['xlr', 'trs'],
  },
  {
    id: 'yamaha-dxr15',
    brand: 'Yamaha',
    model: 'DXR15',
    category: 'speaker',
    powerDraw: 1100,
    connections: ['xlr', 'trs'],
  },
  {
    id: 'qsc-k12-2',
    brand: 'QSC',
    model: 'K12.2',
    category: 'speaker',
    powerDraw: 2000,
    connections: ['xlr', 'trs'],
    notes: '2000W peak. Suitable for large venues.',
  },
  {
    id: 'rcf-art-745a',
    brand: 'RCF',
    model: 'ART 745-A MK4',
    category: 'speaker',
    powerDraw: 1400,
    connections: ['xlr', 'trs'],
  },
  // ── Subwoofers ──────────────────────────────────────────────────────────
  {
    id: 'ev-ekx-18sp',
    brand: 'Electro-Voice',
    model: 'EKX-18SP',
    category: 'subwoofer',
    powerDraw: 1300,
    connections: ['xlr'],
  },
  {
    id: 'mackie-thump118s',
    brand: 'Mackie',
    model: 'Thump118S',
    category: 'subwoofer',
    powerDraw: 1400,
    connections: ['xlr', 'trs'],
  },
  {
    id: 'qsc-ksub',
    brand: 'QSC',
    model: 'KSub',
    category: 'subwoofer',
    powerDraw: 1000,
    connections: ['xlr'],
  },
  {
    id: 'rcf-sub-705',
    brand: 'RCF',
    model: 'SUB 705-AS MK3',
    category: 'subwoofer',
    powerDraw: 1400,
    connections: ['xlr'],
  },
  // ── Soundbars ───────────────────────────────────────────────────────────
  {
    id: 'samsung-hw-t420',
    brand: 'Samsung',
    model: 'HW-T420',
    category: 'soundbar',
    powerDraw: 120,
    connections: ['hdmi', 'optical', 'bluetooth'],
    warningFlags: ['bluetooth-latency', 'consumer-audio', 'no-xlr'],
    notes: 'Consumer soundbar. Not designed for DJ monitoring.',
  },
  {
    id: 'sonos-beam',
    brand: 'Sonos',
    model: 'Beam Gen 2',
    category: 'soundbar',
    powerDraw: 85,
    connections: ['hdmi', 'optical'],
    warningFlags: ['consumer-audio', 'no-xlr', 'high-processing-latency'],
    notes: 'DSP processing introduces 20–70ms latency even on optical.',
  },
  // ── Headphones ──────────────────────────────────────────────────────────
  {
    id: 'pioneer-hdj-x10',
    brand: 'Pioneer',
    model: 'HDJ-X10',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 32,
    driverMm: 50,
    notes: 'Professional DJ headphone. 5Hz–40kHz response.',
  },
  {
    id: 'pioneer-hdj-x7',
    brand: 'Pioneer',
    model: 'HDJ-X7',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 32,
    driverMm: 40,
  },
  {
    id: 'pioneer-hdj-cue1',
    brand: 'Pioneer',
    model: 'HDJ-CUE1',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 32,
    driverMm: 36,
    notes: 'Entry-level DJ headphone.',
  },
  {
    id: 'sennheiser-hd25',
    brand: 'Sennheiser',
    model: 'HD 25',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 70,
    driverMm: 25,
    notes: 'Industry standard. Requires decent headphone amp output.',
    warningFlags: ['high-impedance'],
  },
  {
    id: 'sony-mdr-7506',
    brand: 'Sony',
    model: 'MDR-7506',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 63,
    driverMm: 40,
    notes: 'Studio monitoring standard. Not specifically DJ-tuned.',
    warningFlags: ['high-impedance'],
  },
  {
    id: 'audio-technica-ath-m50x',
    brand: 'Audio-Technica',
    model: 'ATH-M50x',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 38,
    driverMm: 45,
  },
  {
    id: 'shure-srh840a',
    brand: 'Shure',
    model: 'SRH840A',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 44,
    driverMm: 40,
  },
  {
    id: 'beyerdynamic-dt770',
    brand: 'Beyerdynamic',
    model: 'DT 770 Pro',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs'],
    impedanceOhms: 250,
    driverMm: 45,
    notes: 'Studio headphone. 250Ω version requires dedicated headphone amp.',
    warningFlags: ['high-impedance', 'needs-amp'],
  },
  {
    id: 'v-moda-crossfade2',
    brand: 'V-MODA',
    model: 'Crossfade 2 Wireless',
    category: 'headphones',
    powerDraw: 0,
    connections: ['trs', 'bluetooth'],
    impedanceOhms: 32,
    driverMm: 50,
    warningFlags: ['bluetooth-latency'],
    notes: 'Use wired mode only for DJ monitoring. Bluetooth adds latency.',
  },
  // ── Laptops & Devices ───────────────────────────────────────────────────
  {
    id: 'macbook-pro-m3',
    brand: 'Apple',
    model: 'MacBook Pro (M3/M4)',
    category: 'laptop',
    powerDraw: 30,
    connections: ['usb'],
    os: 'mac',
    softwareCompatibility: ['Serato DJ Pro', 'rekordbox', 'Traktor Pro', 'Virtual DJ', 'Ableton Live'],
    notes: 'Best DJ laptop. USB-C only — needs USB-A hub for older controllers.',
  },
  {
    id: 'macbook-air-m2',
    brand: 'Apple',
    model: 'MacBook Air (M1/M2)',
    category: 'laptop',
    powerDraw: 25,
    connections: ['usb'],
    os: 'mac',
    softwareCompatibility: ['Serato DJ Pro', 'rekordbox', 'Traktor Pro', 'Virtual DJ'],
    notes: 'No fan — may throttle under sustained heavy load at high sample rates.',
    warningFlags: ['thermal-throttle'],
  },
  {
    id: 'windows-laptop-modern',
    brand: 'Windows',
    model: 'Windows Laptop (2020+)',
    category: 'laptop',
    powerDraw: 45,
    connections: ['usb'],
    os: 'windows',
    softwareCompatibility: ['Serato DJ Pro', 'rekordbox', 'Traktor Pro', 'Virtual DJ', 'Ableton Live'],
    notes: 'Install ASIO4ALL driver for low-latency audio on Windows.',
    warningFlags: ['needs-asio'],
  },
  {
    id: 'windows-laptop-old',
    brand: 'Windows',
    model: 'Windows Laptop (pre-2018)',
    category: 'laptop',
    powerDraw: 65,
    connections: ['usb'],
    os: 'windows',
    softwareCompatibility: ['Virtual DJ', 'rekordbox'],
    cpuWarning: true,
    warningFlags: ['needs-asio', 'cpu-warning'],
    notes: 'Older CPU may struggle with high sample rate audio and effects.',
  },
  {
    id: 'ipad-pro',
    brand: 'Apple',
    model: 'iPad Pro (M1/M2/M4)',
    category: 'laptop',
    powerDraw: 20,
    connections: ['usb'],
    os: 'ios',
    softwareCompatibility: ['djay Pro', 'edjing Mix', 'rekordbox (limited)'],
    warningFlags: ['no-serato', 'no-traktor', 'limited-software'],
    notes: 'Serato and Traktor are not available on iPad. Most Pioneer controllers are not iPad-compatible.',
  },
  {
    id: 'ipad-standard',
    brand: 'Apple',
    model: 'iPad (standard)',
    category: 'laptop',
    powerDraw: 15,
    connections: ['usb'],
    os: 'ios',
    softwareCompatibility: ['djay Pro', 'edjing Mix'],
    warningFlags: ['no-serato', 'no-traktor', 'limited-software', 'cpu-warning'],
    notes: 'Limited DJ software support. Not recommended for professional use.',
  },
  // ── Amplifiers ──────────────────────────────────────────────────────────
  {
    id: 'crown-xls-1502',
    brand: 'Crown',
    model: 'XLS 1502',
    category: 'amplifier',
    powerDraw: 525,
    connections: ['xlr', 'trs'],
    notes: '525W per channel. Used with passive PA speakers.',
  },
  {
    id: 'qsc-gx5',
    brand: 'QSC',
    model: 'GX5',
    category: 'amplifier',
    powerDraw: 500,
    connections: ['xlr', 'trs'],
  },
];

// ─── Bottleneck Engine ──────────────────────────────────────────────────────

export function analyzeRig(
  controller: GearItem | null,
  speakers: GearItem[],
  activeConnections: Record<string, ConnectionType>,
  headphones?: GearItem | null,
  laptop?: GearItem | null,
): CompatibilityWarning[] {
  const warnings: CompatibilityWarning[] = [];

  // Laptop warnings
  if (laptop) {
    if (laptop.warningFlags?.includes('needs-asio')) {
      warnings.push({
        severity: 'info',
        message: `${laptop.brand} ${laptop.model} requires ASIO drivers for low-latency DJ audio on Windows.`,
        fix: 'Download and install ASIO4ALL (free) from asio4all.org before running DJ software.',
      });
    }
    if (laptop.warningFlags?.includes('cpu-warning')) {
      warnings.push({
        severity: 'warning',
        message: `${laptop.brand} ${laptop.model} may struggle with high sample rates and real-time effects.`,
        fix: 'Set your DJ software buffer size to 512 or higher. Disable unnecessary effects. Close background apps.',
      });
    }
    if (laptop.warningFlags?.includes('thermal-throttle')) {
      warnings.push({
        severity: 'info',
        message: `MacBook Air has no cooling fan and may throttle CPU during long sets at high sample rates.`,
        fix: 'Keep the MacBook on a hard flat surface. Avoid 96kHz for long sets — 44.1kHz is sufficient.',
      });
    }
    if (laptop.os === 'ios' && controller && !controller.standaloneCompatible) {
      warnings.push({
        severity: 'critical',
        message: `Most DJ controllers including the ${controller.brand} ${controller.model} are not compatible with iPad.`,
        fix: 'Use a MacBook or Windows laptop for full controller support, or switch to a standalone CDJ setup.',
      });
    }
    if (laptop.warningFlags?.includes('no-serato') && controller?.warningFlags?.includes('serato-only')) {
      warnings.push({
        severity: 'critical',
        message: `The ${controller.brand} ${controller.model} requires Serato DJ Pro, which is not available on iPad.`,
        fix: 'Use a Mac or Windows laptop to run Serato DJ Pro.',
      });
    }
  }

  // Headphone warnings
  if (headphones) {
    if (headphones.warningFlags?.includes('needs-amp')) {
      warnings.push({
        severity: 'warning',
        message: `${headphones.brand} ${headphones.model} has ${headphones.impedanceOhms}Ω impedance — too high for most DJ controller headphone outputs.`,
        fix: 'Use a dedicated headphone amplifier, or switch to a 32Ω DJ headphone like the Pioneer HDJ-X10.',
      });
    } else if (headphones.warningFlags?.includes('high-impedance') && controller) {
      warnings.push({
        severity: 'info',
        message: `${headphones.brand} ${headphones.model} (${headphones.impedanceOhms}Ω) is on the high side for the ${controller.model}'s headphone output. Volume may be lower than expected.`,
        fix: 'Turn headphone gain to max on the controller. If still too quiet, add a portable headphone amp.',
      });
    }
    if (headphones.warningFlags?.includes('bluetooth-latency')) {
      warnings.push({
        severity: 'critical',
        message: `${headphones.brand} ${headphones.model} in Bluetooth mode adds ~150ms latency — unusable for DJ cueing.`,
        fix: 'Always use the wired TRS connection for DJ monitoring.',
      });
    }
  }

  if (!controller || speakers.length === 0) return warnings;

  for (const speaker of speakers) {
    const conn = activeConnections[speaker.id];
    if (!conn) continue;

    if (conn === 'bluetooth') {
      warnings.push({
        severity: 'critical',
        message: `Bluetooth to ${speaker.brand} ${speaker.model} adds ~150ms latency.`,
        fix: 'Switch to RCA or TRS cable for zero-latency monitoring.',
        latencyMs: 150,
      });
    }
    if (speaker.warningFlags?.includes('consumer-audio')) {
      warnings.push({
        severity: 'warning',
        message: `${speaker.brand} ${speaker.model} is a consumer soundbar — not designed for DJ monitoring.`,
        fix: 'Use studio monitors (Yamaha HS5, Pioneer DM-40D) or PA speakers for accurate sound.',
      });
    }
    if (speaker.warningFlags?.includes('high-processing-latency') && conn === 'optical') {
      warnings.push({
        severity: 'warning',
        message: `${speaker.brand} ${speaker.model} applies DSP even on optical, adding 20–70ms latency.`,
        fix: 'Use studio monitors with a direct analog connection.',
        latencyMs: 45,
      });
    }
    if (controller.connections.includes('xlr') && speaker.connections.includes('xlr') && conn !== 'xlr') {
      warnings.push({
        severity: 'info',
        message: `Both your controller and ${speaker.model} support XLR but you're using ${conn.toUpperCase()}.`,
        fix: 'XLR provides a balanced signal with better noise rejection over long cable runs.',
      });
    }
  }

  const totalWatts =
    (controller?.powerDraw ?? 0) +
    (laptop?.powerDraw ?? 0) +
    speakers.reduce((sum, s) => sum + s.powerDraw, 0);

  if (totalWatts > 800) {
    warnings.push({
      severity: 'info',
      message: `Your rig draws ~${totalWatts}W continuous. Plan your power carefully.`,
      fix: `For outdoor gigs: a ${Math.ceil(totalWatts / 800) * 2}kW+ generator is recommended. Use an RCD adapter.`,
    });
  }

  return warnings;
}

export function getTotalPowerDraw(gear: GearItem[]): number {
  return gear.reduce((sum, g) => sum + g.powerDraw, 0);
}
