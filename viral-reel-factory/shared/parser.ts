import {
  CHARACTERS,
  CONFLICT_RE,
  DEFAULT_CHARACTER,
  DEFAULT_LOCATION,
  EMOTION_RE,
  findWorld,
  LOCATIONS,
  TRIGGERS,
  TWIST_RE,
  WORLDS,
  type CharacterPreset,
  type LocationPreset,
  type WorldPreset,
} from './lexicon';

export interface ParsedIdea {
  raw: string;
  lang: 'ru' | 'en';
  words: number;
  clauses: string[];
  character: CharacterPreset;
  characterFound: boolean;
  location: LocationPreset;
  locationFound: boolean;
  /** World the twist leads to; falls back to a location-appropriate suggestion when the idea names none. */
  world: WorldPreset;
  worldFound: boolean;
  twist: boolean;
  twistClause?: string;
  conflict: boolean;
  conflictClause?: string;
  emotion: boolean;
  trigger: string;
  triggerRu: string;
}

export function parseIdea(idea: string): ParsedIdea {
  const raw = idea.trim().replace(/\s+/g, ' ');
  const text = ` ${raw.toLowerCase()} `;
  const clauses = raw.split(/[,.;!?—]+|\s(?:и|а|затем|потом|and|then)\s/i).map((c) => c.trim()).filter(Boolean);
  const character = CHARACTERS.find((c) => c.re.test(text));
  const location = LOCATIONS.find((l) => l.re.test(text));
  const world = WORLDS.find((x) => x.re.test(text));
  const resolvedLocation = location ?? DEFAULT_LOCATION;
  const matched = TRIGGERS.find((t) => t.re.test(text));
  // A location-specific door action ("watches the elevator doors slide shut") beats the generic door trigger.
  const trigger = matched && /door/.test(matched.text) && /door/.test(resolvedLocation.trigger) ? undefined : matched;
  const twistClause = clauses.find((c) => TWIST_RE.test(` ${c.toLowerCase()} `));
  const conflictClause = clauses.find((c) => CONFLICT_RE.test(` ${c.toLowerCase()} `));
  return {
    raw,
    lang: /[а-яё]/i.test(raw) ? 'ru' : 'en',
    words: raw.split(' ').filter(Boolean).length,
    clauses,
    character: character ?? DEFAULT_CHARACTER,
    characterFound: Boolean(character),
    location: resolvedLocation,
    locationFound: Boolean(location),
    world: world ?? findWorld(resolvedLocation.defaultWorld),
    worldFound: Boolean(world),
    twist: Boolean(twistClause) || Boolean(world),
    twistClause,
    conflict: Boolean(conflictClause),
    conflictClause,
    emotion: EMOTION_RE.test(text),
    trigger: trigger?.text ?? resolvedLocation.trigger,
    triggerRu: trigger?.ru ?? '',
  };
}

/** Replaces {ref} {Ref} {they} {their} {them} {frame} tokens for the given character and location. */
export function fill(tpl: string, p: Pick<ParsedIdea, 'character' | 'location'>): string {
  const c = p.character;
  return tpl
    .replace(/\{frame\}/g, p.location.frame)
    .replace(/\{Ref\}/g, c.ref[0].toUpperCase() + c.ref.slice(1))
    .replace(/\{ref\}/g, c.ref)
    .replace(/\{they\}/g, c.they)
    .replace(/\{their\}/g, c.their)
    .replace(/\{them\}/g, c.them);
}
