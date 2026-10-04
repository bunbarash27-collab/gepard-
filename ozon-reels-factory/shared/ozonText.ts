/**
 * Helpers for getting product data without server access to Ozon (Ozon blocks server requests with an anti-bot redirect).
 */
import type { ProductInput } from './types';

export type ExtractedProduct = Partial<Pick<ProductInput, 'name' | 'category' | 'price' | 'specs' | 'benefits' | 'audience' | 'appearance'>>;

const MULTI: [string, string][] = [
  ['shch', 'щ'], ['sch', 'щ'], ['zh', 'ж'], ['ch', 'ч'], ['sh', 'ш'], ['ts', 'ц'], ['kh', 'х'],
  ['yu', 'ю'], ['ya', 'я'], ['yo', 'ё'], ['ye', 'е'],
];
const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о',
  p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф', h: 'х', c: 'к', w: 'в', x: 'кс', j: 'й', q: 'к',
};
const VOWELS = 'аеёиоуыэюя';
const UNITS: Record<string, string> = { mg: 'мг', mkg: 'мкг', ml: 'мл', g: 'г', kg: 'кг', l: 'л', sht: 'шт', sm: 'см', mm: 'мм', m: 'м', vt: 'Вт' };

function translitWord(w: string): string {
  if (/\d/.test(w)) {
    const m = w.match(/^(\d+)([a-z]+)$/);
    return m && UNITS[m[2]] ? `${m[1]} ${UNITS[m[2]]}` : w.toUpperCase();
  }
  let out = '';
  for (let i = 0; i < w.length; ) {
    const prev = out.at(-1) ?? '';
    // After a consonant "ye" is the adjective ending «ые» (besprovodnye → беспроводные), not «е».
    const iotaOk = !prev || VOWELS.includes(prev);
    const multi = MULTI.find(([lat]) => w.startsWith(lat, i) && (lat !== 'ye' || iotaOk));
    if (multi) {
      out += multi[1];
      i += multi[0].length;
      continue;
    }
    const ch = w[i];
    if (ch === 'y') {
      // Ozon writes both «й» and «ы» as "y": after a vowel it is «й», otherwise «ы».
      out += prev && VOWELS.includes(prev) ? 'й' : prev ? 'ы' : 'й';
    } else out += SINGLE[ch] ?? ch;
    i += 1;
  }
  return out.replace(/ыы$/, 'ый');
}

/** Approximate Russian product name from an Ozon URL slug, e.g. /product/magniy-v6-400mg-320244429/. */
export function nameFromOzonUrl(url: string): string | undefined {
  const slug = url.match(/\/product\/([^/?#]+)/)?.[1];
  if (!slug) return undefined;
  const words = decodeURIComponent(slug).toLowerCase().replace(/-?\d{5,}$/, '').split('-').filter(Boolean);
  if (!words.length) return undefined;
  const name = words.map(translitWord).join(' ');
  return name[0].toUpperCase() + name.slice(1);
}

/** Rule-based extraction used in Demo Mode; AI mode returns much cleaner results. */
export function extractFromPageText(text: string, url = ''): ExtractedProduct {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const result: ExtractedProduct = {};
  const price = text.match(/(\d{1,3}(?:[\s\u00a0\u202f]\d{3})*|\d+)\s?₽/);
  if (price) result.price = price[1].replace(/[\s\u00a0\u202f]/g, '');
  const specs: string[] = [];
  for (let i = 0; i < lines.length && specs.length < 10; i++) {
    const kv = lines[i].match(/^([А-ЯЁA-Z][^:\t]{2,40}?)\s*[:\t]\s*(.{1,80})$/);
    if (kv && !/₽|отзыв|доставк|корзин|продав/i.test(lines[i])) specs.push(`${kv[1]}: ${kv[2]}`);
  }
  if (specs.length) result.specs = specs.join('\n');
  const name = nameFromOzonUrl(url);
  if (name) result.name = name;
  return result;
}
