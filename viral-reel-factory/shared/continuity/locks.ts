// LOCK SYSTEM: which properties may change, and under what condition.
//   locked      — never changes without an explicit story transformation
//   conditional — changes only through an explaining event
//   mutable     — may change as part of the scene's action
import type { Category, Entity, EntityKind, LockType, Text, Value } from './types';

type Rule = [prefix: string, lock: LockType, category: Category];

const COMMON: Rule[] = [
  ['present', 'conditional', 'objects'],
  ['locationId', 'conditional', 'location'],
  ['name', 'locked', 'identity'],
];

const RULES: Record<EntityKind, Rule[]> = {
  character: [
    ['identity.faceDescription', 'locked', 'identity'],
    ['identity.gender', 'locked', 'identity'],
    ['identity.approximateAge', 'locked', 'identity'],
    ['identity', 'locked', 'appearance'],
    ['wardrobe', 'conditional', 'wardrobe'],
    ['knowledge', 'conditional', 'knowledge'],
    ['position', 'mutable', 'position'],
    ['orientation', 'mutable', 'position'],
    ['pose', 'mutable', 'position'],
    ['emotion', 'mutable', 'causality'],
    ['expression', 'mutable', 'causality'],
    ['physicalCondition', 'mutable', 'causality'],
    ['movement', 'mutable', 'position'],
  ],
  location: [
    ['type', 'locked', 'location'],
    ['architecture', 'locked', 'location'],
    ['layout', 'locked', 'location'],
    ['time', 'conditional', 'time'],
    ['weather', 'conditional', 'weather'],
    ['lighting', 'conditional', 'lighting'],
    ['palette', 'conditional', 'lighting'],
    ['backgroundElements', 'conditional', 'location'],
    ['foregroundElements', 'conditional', 'location'],
    ['atmosphere', 'mutable', 'location'],
  ],
  object: [
    ['type', 'locked', 'objects'],
    ['appearance', 'locked', 'objects'],
    ['color', 'locked', 'objects'],
    ['material', 'locked', 'objects'],
    ['visibility', 'mutable', 'objects'],
    ['', 'conditional', 'objects'],
  ],
  vehicle: [
    ['make', 'locked', 'objects'],
    ['model', 'locked', 'objects'],
    ['color', 'locked', 'objects'],
    ['body', 'locked', 'objects'],
    ['wheels', 'locked', 'objects'],
    ['plate', 'locked', 'objects'],
    ['interior', 'locked', 'objects'],
    ['', 'conditional', 'objects'],
  ],
  product: [
    ['spot', 'conditional', 'objects'],
    ['condition', 'conditional', 'objects'],
    ['', 'locked', 'objects'],
  ],
};

export function ruleFor(kind: EntityKind, path: string): { lock: LockType; category: Category } {
  for (const [prefix, lock, category] of [...COMMON, ...RULES[kind]]) {
    if (prefix === '' || path === prefix || path.startsWith(`${prefix}.`)) return { lock, category };
  }
  return { lock: 'conditional', category: 'objects' };
}

export const isText = (v: unknown): v is Text => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as Text).en === 'string';

/** Canonical comparable form: Text → English, arrays → sorted list, strings trimmed and lower-cased. */
export function canon(v: Value | undefined): string {
  if (v === undefined || v === null) return '';
  if (isText(v)) return v.en.trim().toLowerCase();
  if (Array.isArray(v)) return [...v].map((x) => String(x).trim().toLowerCase()).sort().join('|');
  return String(v).trim().toLowerCase();
}
export const same = (a: Value | undefined, b: Value | undefined) => canon(a) === canon(b);

export function getPath(e: Entity, path: string): Value | undefined {
  let cur: any = e;
  for (const k of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur as Value | undefined;
}

/** Sets a value in place. A plain string written over a Text field becomes an English-only Text. */
export function setPath(e: Entity, path: string, value: Value): void {
  const keys = path.split('.');
  let cur: any = e;
  for (const k of keys.slice(0, -1)) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  const last = keys[keys.length - 1];
  cur[last] = isText(cur[last]) && typeof value === 'string' ? { en: value } : value;
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
