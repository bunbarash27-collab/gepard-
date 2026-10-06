// PROMPT CONTEXT: WORLD STATE + SCENE CONTRACT + STATE CHANGES → state lines for the prompt builder,
// and compact summaries for AI requests (only what the next step needs, not the whole project).
import type { Lang } from '../types';
import { canon } from './locks';
import { heldBy, presentHere, relationshipsOf } from './relationships';
import type { CharacterState, Entity, EventLogEntry, PromptContext, SceneContract, StateChange, VehicleState, WorldState } from './types';
import { nameOf, pathLabel, RELATION_LABELS, tx, valueLabel } from './vocab';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const noDot = (s: string) => s.replace(/[.\s]+$/, '');

const W: Record<Lang, Record<string, string>> = {
  en: { facing: 'facing', gaze: 'looking at', emotion: 'emotion', holding: 'holding', in: 'in', nothing: 'empty-handed', inside: 'inside', doors: 'doors', engine: 'engine', lights: 'headlights', damage: 'damage', at: 'position' },
  ru: { facing: 'повёрнут(а) к', gaze: 'смотрит на', emotion: 'эмоция', holding: 'держит', in: 'в', nothing: 'руки свободны', inside: 'внутри:', doors: 'двери', engine: 'двигатель', lights: 'фары', damage: 'повреждения', at: 'положение' },
};
const DOOR: Record<Lang, Record<string, string>> = { en: { driver: 'driver', passenger: 'passenger' }, ru: { driver: 'водительская', passenger: 'пассажирская' } };
const HAND: Record<Lang, Record<string, string>> = { en: { left: 'left hand', right: 'right hand', both: 'both hands' }, ru: { left: 'левой руке', right: 'правой руке', both: 'обеих руках' } };
const BODY_KEYS = new Set(['standing', 'walking', 'running', 'seated_driver', 'seated', 'settled', 'crouching', 'frozen', 'still']);
const EMOTION_KEYS = new Set(['calm', 'curious', 'uneasy', 'fear', 'terror', 'awe', 'wonder', 'relief', 'determination', 'disbelief']);
/** Known keys are labelled; free text (from a model) is shown as is. */
const show = (v: string, set: Set<string>) => Boolean(v) && (set.has(v) || !/^[a-z_]+$/.test(v));

function describeCharacter(state: WorldState, c: CharacterState, lang: Lang): string {
  const w = W[lang];
  const parts: string[] = [];
  if (c.position.inside) parts.push(`${w.inside} ${nameOf(state, c.position.inside, lang)}`);
  if (tx(c.position.spot, lang)) parts.push(`${w.at}: ${tx(c.position.spot, lang)}`);
  if (show(c.pose.bodyPosition, BODY_KEYS)) parts.push(valueLabel(c.pose.bodyPosition, lang, state));
  if (c.orientation.facing && c.orientation.facing !== 'ahead') parts.push(`${w.facing} ${valueLabel(c.orientation.facing, lang, state)}`);
  if (c.orientation.gaze && c.orientation.gaze !== 'ahead' && c.orientation.gaze !== c.orientation.facing) parts.push(`${w.gaze} ${valueLabel(c.orientation.gaze, lang, state)}`);
  if (show(c.emotion.primary, EMOTION_KEYS)) parts.push(`${w.emotion}: ${valueLabel(c.emotion.primary, lang, state)}`);
  const held = heldBy(state, c.id);
  if (c.role !== 'creature') parts.push(held.length ? `${w.holding} ${held.map((o) => `${tx(o.name, lang)}${o.hand ? ` ${w.in} ${HAND[lang][o.hand]}` : ''}`).join(', ')}` : w.nothing);
  return `${cap(tx(c.name, lang))} (${c.referenceId}): ${parts.join('; ')}`;
}

function describeVehicle(v: VehicleState, lang: Lang): string {
  const w = W[lang];
  const doors = Object.entries(v.doors).map(([k, s]) => `${DOOR[lang][k] ?? k} — ${valueLabel(s, lang)}`).join(', ');
  const head = [tx(v.color, lang), tx(v.body, lang)].filter(Boolean).join(', ');
  return `${cap(tx(v.name, lang))} (${v.referenceId}): ${head}; ${w.doors}: ${doors}; ${w.engine}: ${valueLabel(v.engine, lang)}; ${w.lights}: ${valueLabel(v.lights, lang)}; ${w.damage}: ${valueLabel(v.damage, lang)}`;
}

/** One line per present character and vehicle: the facts the frame must show. */
export function stateLines(state: WorldState, lang: Lang): string[] {
  const here = presentHere(state);
  return [
    ...here.filter((e): e is CharacterState => e.kind === 'character').map((c) => describeCharacter(state, c, lang)),
    ...here.filter((e): e is VehicleState => e.kind === 'vehicle').map((v) => describeVehicle(v, lang)),
  ];
}

export function spatialLines(state: WorldState, lang: Lang): string[] {
  return relationshipsOf(state)
    .filter((r) => r.relation !== 'at' && !(r.relation === 'inside' && state.entities[r.subject]?.kind !== 'character'))
    .map((r) => `${cap(nameOf(state, r.subject, lang))} ${RELATION_LABELS[r.relation]?.[lang] ?? r.relation.replace(/_/g, ' ')} ${nameOf(state, r.object, lang)}`);
}

export function changeLine(c: StateChange, state: WorldState, lang: Lang): string {
  const who = cap(nameOf(state, c.entity, lang));
  if (c.path === 'knowledge') return lang === 'ru' ? `${who} узнаёт: ${nameOf(state, String(c.to), lang)}` : `${who} now knows about ${nameOf(state, String(c.to), lang)}`;
  if (c.path === 'present') return `${who}: ${c.to ? (lang === 'ru' ? 'появляется' : 'appears') : lang === 'ru' ? 'исчезает' : 'disappears'}`;
  return `${who} — ${pathLabel(c.path, lang)}: ${noDot(valueLabel(c.from, lang, state))} → ${noDot(valueLabel(c.to, lang, state))}`;
}

const VISIBLE_CHANGE = /^(doors\.|engine|lights|damage|position\.inside|present|emotion\.primary|orientation\.facing|pose\.bodyPosition|heldBy|hand|condition|currentLocation|knowledge)/;

export function buildPromptContext(opening: WorldState, end: WorldState, changes: StateChange[], lang: Lang): PromptContext {
  const refs = [...presentHere(end), end.entities[end.currentLocation]].filter(Boolean) as Entity[];
  return {
    references: refs.map((e) => `${e.referenceId} — ${tx(e.name, lang)}`).join('; '),
    opening: stateLines(opening, lang),
    changes: changes.filter((c) => VISIBLE_CHANGE.test(c.path)).map((c) => changeLine(c, end, lang)),
    ending: stateLines(end, lang),
    spatial: spatialLines(end, lang),
  };
}

/** Russian prompts need Russian names for everything in the frame. */
export const hasLanguage = (state: WorldState, lang: Lang) => lang === 'en' || Object.values(state.entities).every((e) => !e.present || Boolean(e.name.ru));

// ───────── Compact AI context ─────────

function brief(e: Entity) {
  const base = { id: e.id, kind: e.kind, name: e.name.en };
  switch (e.kind) {
    case 'character':
      return { ...base, role: e.role, face: e.identity.faceDescription.en, clothing: e.wardrobe.clothing.en, inside: e.position.inside, spot: e.position.spot.en, facing: e.orientation.facing, emotion: e.emotion.primary, condition: e.physicalCondition, knows: e.knowledge };
    case 'vehicle':
      return { ...base, color: e.color.en, body: e.body.en, doors: e.doors, engine: e.engine, lights: e.lights, damage: e.damage };
    case 'object':
      return { ...base, spot: e.spot.en, heldBy: e.heldBy, hand: e.hand, condition: e.condition, inVehicle: e.locationId?.startsWith('vehicle') ? e.locationId : undefined };
    case 'product':
      return { ...base, color: e.color.en, branding: e.branding.en, spot: e.spot.en };
    default:
      return base;
  }
}

/** MasterStateSummary + CurrentSceneState + RelevantEvents/Characters/Objects (+ SceneContract when given). */
export function compactContext(state: WorldState, master: WorldState, log: EventLogEntry[], contract?: SceneContract) {
  const loc = state.entities[state.currentLocation];
  return {
    masterStateSummary: {
      title: master.story.title.en,
      visualStyle: master.visualStyle.en,
      cameraStyle: master.cameraStyle.en,
      worldRules: master.worldRules.map((r) => r.en),
      locations: Object.values(state.entities).filter((e) => e.kind === 'location').map((e) => ({ id: e.id, name: e.name.en })),
    },
    currentSceneState: loc && loc.kind === 'location' ? { location: loc.id, name: loc.name.en, time: loc.time.en, weather: loc.weather.en, lighting: loc.lighting.en } : { location: state.currentLocation },
    relevantCharacters: presentHere(state).filter((e) => e.kind === 'character').map(brief),
    relevantObjects: presentHere(state).filter((e) => e.kind !== 'character').map(brief),
    relationships: relationshipsOf(state).filter((r) => r.relation !== 'at').map((r) => `${r.subject} ${r.relation} ${r.object}`),
    knownEntitiesNotPresent: Object.values(state.entities).filter((e) => !e.present && e.kind !== 'location').map((e) => ({ id: e.id, name: e.name.en })),
    relevantEvents: log.slice(-6).map((e) => `#${e.n} ${e.actor}: ${e.action.en}`),
    ...(contract
      ? {
          sceneContract: {
            mustPreserve: contract.mustPreserve.map((i) => `${i.entity}.${i.path} = ${canon(i.value)}`),
            mustChange: contract.mustChange.map((c) => `${c.entity}.${c.path}: ${canon(c.from)} → ${canon(c.to)}`),
            mustNotChange: contract.mustNotChange.map((i) => `${i.entity}.${i.path}`),
            newElements: contract.newElements,
            removedElements: contract.removedElements,
          },
        }
      : {}),
  };
}
