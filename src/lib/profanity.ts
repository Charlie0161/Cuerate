// Basic profanity filter — add/remove words as needed
const BLOCKED = [
  'fuck', 'fucker', 'fucking', 'f**k', 'fuk',
  'shit', 'shite', 'sh1t',
  'cunt', 'c**t',
  'bastard', 'bitch', 'bitches',
  'dick', 'cock', 'prick',
  'ass', 'arse', 'asshole', 'arsehole',
  'wanker', 'wank',
  'twat', 'bellend',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spastic',
  'whore', 'slag', 'slut',
  'bollocks', 'bollock',
  'piss', 'pisser',
  'knob', 'knobhead',
  'minge', 'fanny',
];

// Regex: word boundaries, case-insensitive, ignores leet substitutions (@ = a, 3 = e, 1 = i, 0 = o)
function normalise(s: string) {
  return s.toLowerCase()
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/\*/g, '');
}

export function containsProfanity(text: string): boolean {
  const norm = normalise(text);
  return BLOCKED.some(word => {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    return re.test(norm);
  });
}

export function cleanText(text: string): string {
  let out = text;
  const norm = normalise(text);
  for (const word of BLOCKED) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    if (re.test(norm)) {
      out = out.replace(new RegExp(`\\b${word}\\b`, 'gi'), '*'.repeat(word.length));
    }
  }
  return out;
}
