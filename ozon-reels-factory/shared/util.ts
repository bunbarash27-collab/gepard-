export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Splits multi-line / bulleted / semicolon-separated user input into clean items. */
export function lines(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n|;|•/)
    .map((s) => s.replace(/^[\s\-–—*·\d.)]+/, '').trim())
    .filter(Boolean);
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const lowerFirst = (s: string) => (s && !/^[A-ZА-ЯЁ]{2}/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
export const stripDot = (s: string) => s.replace(/[.!?…]+$/, '');
export const sentence = (s: string) => (s ? cap(stripDot(s.trim())) + '.' : '');

export function formatPrice(price: string): string {
  const p = price.trim();
  if (!p) return '';
  return /^[\d\s.,]+$/.test(p) ? `${p} ₽` : p;
}

export function timeline(scenes: { duration: number }[]): { start: number; end: number }[] {
  let t = 0;
  return scenes.map((s) => {
    const start = t;
    t += s.duration;
    return { start, end: t };
  });
}

export const totalDuration = (scenes: { duration: number }[]) => scenes.reduce((a, s) => a + s.duration, 0);

export const fmtSec = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}`;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
}

/** Russian plural: plural(4, ['сцена', 'сцены', 'сцен']) → 'сцены'. */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
export const scenesLabel = (n: number) => `${n} ${plural(n, ['сцена', 'сцены', 'сцен'])}`;
