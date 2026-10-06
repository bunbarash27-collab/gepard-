export const firstPart = (s: string) => s.split(/[,;]/)[0].trim();
export const noDot = (s: string) => s.trim().replace(/[.!]+$/, '');

/** Splits a shot into 2–3 timed phases, e.g. "0–1.4s a; 1.4–3s b". */
export function timingWith(sec: (n: number) => string, unit: string) {
  return (dur: number, a: string, b: string, c?: string): string => {
    const t1 = Math.round(dur * (c ? 0.35 : 0.5) * 10) / 10;
    const t2 = Math.round(dur * 0.75 * 10) / 10;
    return c ? `0–${sec(t1)}${unit} ${a}; ${sec(t1)}–${sec(t2)}${unit} ${b}; ${sec(t2)}–${sec(dur)}${unit} ${c}` : `0–${sec(t1)}${unit} ${a}; ${sec(t1)}–${sec(dur)}${unit} ${b}`;
  };
}
