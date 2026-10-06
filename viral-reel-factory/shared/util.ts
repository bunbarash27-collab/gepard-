let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const fmtSec = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const timeRange = (start: number, end: number) => `${fmtSec(start)}–${fmtSec(end)} sec`;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** True when items run contiguously from 0 and end exactly at `total`. */
export function isExactTimeline(items: { start: number; end: number }[], total: number): boolean {
  if (!items.length || items[0].start !== 0 || items[items.length - 1].end !== total) return false;
  return items.every((x, i) => x.end > x.start && (i === 0 || x.start === items[i - 1].end));
}

/**
 * Re-times items so that sum(duration) === total exactly: contiguous from 0, whole seconds (half seconds
 * only when there are more items than seconds), proportional to the original durations.
 */
export function fitTimeline<T extends { start: number; end: number }>(items: T[], total: number): T[] {
  if (!items.length || isExactTimeline(items, total)) return items;
  const step = items.length <= total ? 1 : 0.5;
  const units = Math.round(total / step);
  const list = items.slice(0, units);
  const w = list.map((x) => {
    const d = Number(x.end) - Number(x.start);
    return Number.isFinite(d) && d > 0 ? d : 1;
  });
  const sum = w.reduce((a, b) => a + b, 0);
  const ideal = w.map((d) => (d / sum) * units);
  const n = ideal.map((v) => Math.max(1, Math.floor(v)));
  let diff = units - n.reduce((a, b) => a + b, 0);
  const order = ideal.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  for (let k = 0; diff > 0; k++, diff--) n[order[k % order.length]]++;
  while (diff < 0) {
    n[n.indexOf(Math.max(...n))]--;
    diff++;
  }
  let t = 0;
  return list.map((x, i) => {
    const start = t;
    t = Math.round((t + n[i] * step) * 10) / 10;
    return { ...x, start, end: t };
  });
}

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
  'сделай круто',
  'сделай вирусным',
  'вирусное видео',
  'красивая кинематографичная сцена',
  'шедевр',
  'высокое качество',
  'наилучшее качество',
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
