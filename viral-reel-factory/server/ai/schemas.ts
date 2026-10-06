import type { AITask } from '../../shared/types';

/**
 * JSON Schema subset understood by Gemini structured output and OpenAI json_schema.
 * `allowEmpty` is local-only (stripped by toWire): every other required string must be non-empty.
 */
export type Schema =
  | { type: 'object'; properties: Record<string, Schema>; required: string[]; description?: string }
  | { type: 'array'; items: Schema; minItems?: number; maxItems?: number; description?: string }
  | { type: 'string'; enum?: string[]; description?: string; allowEmpty?: boolean }
  | { type: 'number' | 'integer'; minimum?: number; maximum?: number; description?: string };

const str = (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) });
const opt = (description?: string): Schema => ({ type: 'string', allowEmpty: true, ...(description ? { description } : {}) });
const en = (values: string[]): Schema => ({ type: 'string', enum: values });
const num = (): Schema => ({ type: 'number', minimum: 0 });
const arr = (items: Schema, minItems?: number, maxItems?: number): Schema => ({ type: 'array', items, ...(minItems != null ? { minItems } : {}), ...(maxItems != null ? { maxItems } : {}) });
/** All properties are required except the listed optional ones. */
const obj = (properties: Record<string, Schema>, optional: string[] = []): Schema => ({ type: 'object', properties, required: Object.keys(properties).filter((k) => !optional.includes(k)) });

const BEATS = ['COLD OPEN', 'HOOK', 'SETUP', 'ESCALATION', 'TURN', 'PAYOFF'];
const AREAS = ['opening', 'curiosity', 'pacing', 'conflict', 'escalation', 'surprise', 'payoff'];

const CONTINUITY = obj({
  character: str('face, hair, age, distinctive features'), location: str(), objects: arr(str(), 1), wardrobe: str(), lighting: str(), time: str(), weather: str(),
  cameraStyle: str(), visualStyle: str(), colorPalette: str(),
});
const IMAGE = obj({
  subject: str(), composition: str(), cameraAngle: str(), lens: str('focal length'), depthOfField: str(), lighting: str(), materials: str(), textures: str(), atmosphere: str(),
});
const VIDEO = obj({
  subjectMovement: str(), cameraMovement: str(), objectMovement: str(), facialMovement: str(), environmentMovement: str(), physicalInteraction: str(),
  timing: str('second-by-second within this scene'), transition: str(), endingFrame: str(),
});
const CONTINUITY_CHANGES = obj({ location: str(), objects: arr(str()), lighting: str(), time: str(), weather: str(), colorPalette: str() }, ['location', 'objects', 'lighting', 'time', 'weather', 'colorPalette']);
const SCENE = obj(
  {
    beat: en(BEATS), start: num(), end: num(),
    purpose: str(), visual: str(), action: str(), camera: str(), lighting: str(), sound: str(),
    onScreenText: opt(), voiceover: opt(),
    image: IMAGE, video: VIDEO, continuityChanges: CONTINUITY_CHANGES,
  },
  ['continuityChanges'],
);

export const TASK_SCHEMAS: Record<AITask, Schema> = {
  analyze: obj(
    {
      concept: str(), mainCharacter: str(), goal: str(), conflict: str(), surprise: str(), emotionalDirection: str(), payoff: str(),
      score: { type: 'integer', minimum: 1, maximum: 10 }, verdict: en(['strong', 'needs-work', 'weak']),
      strengths: arr(str()), weaknesses: arr(str()), improvedIdea: opt(),
    },
    ['improvedIdea'],
  ),
  hooks: obj({ hooks: arr(obj({ type: en(['curiosity', 'shock', 'emotional', 'visual', 'story']), hook: str(), whyItWorks: str(), openingShot: str(), onScreenText: opt() }), 5, 5) }),
  story: obj({
    title: str(), summary: str(), structureNote: str(), emotionalArc: str(), pacing: str(), additions: arr(str()),
    beats: arr(obj({ beat: en(BEATS), start: num(), end: num(), description: str(), emotion: str(), tempo: en(['fast', 'pause', 'peak', 'steady']), pacing: str() }), 3),
  }),
  scenes: obj({ continuity: CONTINUITY, scenes: arr(SCENE, 1) }),
  stronger: obj({
    hookOnScreenText: opt(), summary: str(), pacing: str(), scenes: arr(SCENE, 1),
    improvements: arr(obj({ area: en(AREAS), before: str(), after: str(), why: str() })),
  }),
  prompts: obj({ scenes: arr(obj({ image: IMAGE, video: VIDEO, continuity: CONTINUITY }), 1) }),
};

/** Schema as sent to the provider (local-only keys removed). */
export function toWire(s: Schema): object {
  if (s.type === 'object') return { ...s, properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toWire(v)])) };
  if (s.type === 'array') return { ...s, items: toWire(s.items) };
  if (s.type === 'string') {
    const { allowEmpty: _a, ...rest } = s;
    return rest;
  }
  return s;
}

/** Returns human-readable violations (empty when valid). Enum case is not enforced: normalization fixes it. */
export function validateSchema(s: Schema, v: unknown, path = '$'): string[] {
  switch (s.type) {
    case 'object': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${path}: expected object`];
      const o = v as Record<string, unknown>;
      const errs: string[] = [];
      for (const k of s.required) if (o[k] === undefined || o[k] === null) errs.push(`${path}.${k}: missing`);
      for (const [k, sub] of Object.entries(s.properties)) if (o[k] !== undefined && o[k] !== null) errs.push(...validateSchema(sub, o[k], `${path}.${k}`));
      return errs;
    }
    case 'array': {
      if (!Array.isArray(v)) return [`${path}: expected array`];
      const errs: string[] = [];
      if (s.minItems != null && v.length < s.minItems) errs.push(`${path}: expected at least ${s.minItems} items, got ${v.length}`);
      if (s.maxItems != null && v.length > s.maxItems) errs.push(`${path}: expected at most ${s.maxItems} items, got ${v.length}`);
      v.forEach((x, i) => errs.push(...validateSchema(s.items, x, `${path}[${i}]`)));
      return errs;
    }
    case 'string': {
      if (typeof v !== 'string') return [`${path}: expected string`];
      if (!s.allowEmpty && !v.trim()) return [`${path}: empty`];
      if (s.enum && !s.enum.some((e) => e.toLowerCase() === v.trim().toLowerCase())) return [`${path}: "${v.slice(0, 40)}" is not one of ${s.enum.join('|')}`];
      return [];
    }
    default: {
      if (typeof v !== 'number' || !Number.isFinite(v)) return [`${path}: expected number`];
      if (s.type === 'integer' && !Number.isInteger(v)) return [`${path}: expected integer`];
      if ((s.minimum != null && v < s.minimum) || (s.maximum != null && v > s.maximum)) return [`${path}: ${v} out of range`];
      return [];
    }
  }
}
