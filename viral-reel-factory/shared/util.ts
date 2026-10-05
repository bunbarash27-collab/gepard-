let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const fmtSec = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const timeRange = (start: number, end: number) => `${fmtSec(start)}–${fmtSec(end)} sec`;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Filler phrases that give an image/video model nothing concrete to render. */
export const VAGUE_PHRASES = [
  'make it amazing',
  'make it viral',
  'beautiful cinematic scene',
  'stunning visuals',
  'epic scene',
  'high quality',
  'masterpiece',
  'best quality',
  'ultra amazing',
  'trending on artstation',
];

export function findVaguePhrases(text: string): string[] {
  const t = text.toLowerCase();
  return VAGUE_PHRASES.filter((p) => t.includes(p));
}

export function stripVague(text: string): string {
  let out = text;
  for (const p of VAGUE_PHRASES) out = out.replace(new RegExp(`[,;]?\\s*${p.replace(/\s+/g, '\\s+')}[.,;]?`, 'gi'), '');
  return out.replace(/\s{2,}/g, ' ').trim();
}
