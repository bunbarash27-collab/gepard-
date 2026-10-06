// Offline (Demo Mode) planner: builds the MASTER WORLD STATE from the parsed idea and plans the events of
// every story beat. The offline narrative engine then drafts the scenes; the Continuity Engine validates
// those drafts against the plan. Wording comes from the same lexicons as the narrative (en + ru).
import { TRIGGERS } from '../lexicon';
import { CHARACTERS_RU, LOCATIONS_RU, WORLDS_RU, type CharRu, type LocRu } from '../lexicon.ru';
import { texts, type Ctx } from '../narrative';
import { fill } from '../parser';
import type { BeatName, ContinuityState, Hook, Lang } from '../types';
import { WORLD } from './stateTransition';
import type { CharacterState, Entity, LocationState, ObjectState, SceneClaims, StoryEvent, Text, VehicleState, WorldState } from './types';
import { tx } from './vocab';

export const HERO = 'character_01';
export const HOME = 'location_01';
export const OTHER = 'location_02';
export const CAR = 'vehicle_01';
export const ARTIFACT = 'object_artifact';

export const T = (en: string, ru: string): Text => ({ en, ru });
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pick = (s: string, re: RegExp) => s.split(/,\s*|;\s*/).filter((x) => re.test(x)).join(', ');
const NON_CREATURE_WORLDS = new Set(['future', 'eighties']);
const emptyT = (): Text => ({ en: '', ru: '' });

function ruUse(x: Ctx) {
  const c: CharRu = CHARACTERS_RU[x.p.character.key] ?? CHARACTERS_RU.person;
  const l: LocRu = LOCATIONS_RU[x.p.location.key] ?? LOCATIONS_RU.home;
  const w = WORLDS_RU[x.p.world.key] ?? WORLDS_RU.dinosaurs;
  const pr: Record<string, string> = c.g === 'f' ? { она: 'она', её: 'её', ей: 'ей', нём: 'ней', ним: 'ней' } : { она: 'он', её: 'его', ей: 'ему', нём: 'нём', ним: 'ним' };
  const f = (t: string) => t.replace(/\{frame\.(nom|gen|acc|ins)\}/g, (_, k: 'nom' | 'gen' | 'acc' | 'ins') => l.frame[k]).replace(/\{(она|её|ей|нём|ним)\}/g, (_, k: string) => pr[k]);
  return { c, l, w, f, g: (fem: string, masc: string) => (c.g === 'f' ? fem : masc) };
}

/** Texts shared by the master state, the planner and Continue Story, in both languages. */
export function lexicon(x: Ctx) {
  const { p } = x;
  const en = texts('en');
  const ru = texts('ru');
  const r = ruUse(x);
  const baseEn = en.continuity.base(x);
  const baseRu = ru.continuity.base(x);
  const otherEn = en.continuity.other(x);
  const otherRu = ru.continuity.other(x);
  const fe = (s: string) => fill(s, p);
  return {
    p, r, baseEn, baseRu, otherEn, otherRu, fe,
    hero: T(p.character.ref, r.c.ref),
    Hero: T(cap(p.character.ref), cap(r.c.ref)),
    artifact: T(en.continuity.artifact(x), ru.continuity.artifact(x)),
    omenLighting: T(en.continuity.omenLighting(baseEn.lighting, x), ru.continuity.omenLighting(baseRu.lighting, x)),
    trigger: T(fe(p.trigger), r.f(p.triggerIdx >= 0 ? TRIGGERS[p.triggerIdx].ru : r.l.trigger)),
    worldObjects: otherEn.objects.slice(2).map((name, i) => T(name, otherRu.objects.slice(2)[i] ?? name)),
  };
}
export type Lex = ReturnType<typeof lexicon>;

function hero(x: Ctx, L: Lex): CharacterState {
  const c = x.p.character;
  const isCar = x.p.location.key === 'car';
  const hair = /hair|bun|ponytail|braid|bob|curl|shaved|head|fur|mane|волос|пуч|хвост|кос|каре|стрижк|голов|шерст/i;
  const eyes = /eye|glass|глаз|очк/i;
  const shoes = /sneaker|shoe|loafer|boot|heel|sandal|slipper|кроссов|туф|ботин|сапог|лофер|кед|тапоч|босонож|мокасин/i;
  const acc = /watch|chain|collar|earbud|scarf|ring|bracelet|часы|цепоч|ошейник|наушник|шарф|кольц|браслет/i;
  const ruApp = L.r.c.appearance;
  const rest = (s: string) => s.split(/,\s*/).filter((v) => !hair.test(v) && !eyes.test(v)).join(', ');
  return {
    id: HERO, referenceId: HERO, kind: 'character', role: 'hero', name: L.hero, present: true, locationId: HOME,
    identity: {
      gender: c.they === 'she' ? 'female' : c.they === 'he' ? 'male' : 'animal',
      approximateAge: T(c.description, L.r.c.description),
      faceDescription: T(L.baseEn.character, L.baseRu.character),
      hair: T(pick(c.appearance, hair), pick(ruApp, hair)),
      eyes: T(pick(c.appearance, eyes), pick(ruApp, eyes)),
      bodyType: T(c.description, L.r.c.description),
      distinctiveFeatures: T(rest(c.appearance), rest(ruApp)),
    },
    wardrobe: { clothing: T(L.baseEn.wardrobe, L.baseRu.wardrobe), shoes: T(pick(c.wardrobe, shoes), pick(L.r.c.wardrobe, shoes)), accessories: T(pick(`${c.appearance}, ${c.wardrobe}`, acc), pick(`${ruApp}, ${L.r.c.wardrobe}`, acc)), condition: 'intact' },
    position: { inside: null, spot: isCar ? T('walking up to the car in the parking garage', 'подходит к машине на парковке') : T(`on the way into ${x.p.location.short}`, `на пути: ${L.r.l.short.nom}`) },
    orientation: { facing: 'ahead', gaze: 'ahead' },
    pose: { bodyPosition: 'walking', hands: 'relaxed', feet: 'on the ground' },
    emotion: { primary: 'calm', intensity: 0.2 },
    expression: 'neutral',
    physicalCondition: 'healthy',
    movement: 'walking',
    knowledge: [],
  };
}

type Atmos = Pick<ContinuityState, 'lighting' | 'time' | 'weather' | 'colorPalette'>;
function location(id: string, name: Text, type: string, env: Text, en: Atmos, ru: Atmos): LocationState {
  return {
    id, referenceId: id, kind: 'location', name, present: true, locationId: null, type,
    architecture: env, layout: emptyT(),
    time: T(en.time, ru.time), weather: T(en.weather, ru.weather), lighting: T(en.lighting, ru.lighting), palette: T(en.colorPalette, ru.colorPalette),
    backgroundElements: emptyT(), foregroundElements: emptyT(), atmosphere: emptyT(),
  };
}

export function object(id: string, name: Text, locationId: string | null, spot: Text, present: boolean): ObjectState {
  return { id, referenceId: id, kind: 'object', name, present, locationId, type: 'prop', appearance: name, color: emptyT(), material: emptyT(), spot, owner: null, heldBy: null, hand: null, condition: 'intact', orientation: '', visibility: 'visible' };
}

function car(): VehicleState {
  return {
    id: CAR, referenceId: CAR, kind: 'vehicle', name: T('the silver hatchback', 'серебристый хэтчбек'), present: true, locationId: HOME,
    make: T('compact city car, no visible badge', 'компактная городская машина без логотипа'), model: T('hatchback', 'хэтчбек'), color: T('silver', 'серебристый'),
    body: T('compact five-door hatchback', 'компактный пятидверный хэтчбек'), wheels: T('stock alloy wheels', 'штатные литые диски'), plate: 'not visible',
    doors: { driver: 'closed', passenger: 'closed' }, windows: 'up', engine: 'off', lights: 'off', damage: [],
    interior: T('grey fabric seats, worn leather steering wheel', 'серые тканевые сиденья, потёртая кожаная оплётка руля'),
  };
}

/** A non-hero character (creature or supporting role) with the hero's structure. */
export function supporting(x: Ctx, L: Lex, id: string, role: 'creature' | 'supporting', name: Text, look: Text, locationId: string, spot: Text, present: boolean): CharacterState {
  const h = hero(x, L);
  return {
    ...h, id, referenceId: id, role, name, present, locationId,
    identity: { gender: role, approximateAge: emptyT(), faceDescription: look, hair: emptyT(), eyes: emptyT(), bodyType: look, distinctiveFeatures: emptyT() },
    wardrobe: { clothing: role === 'supporting' ? look : emptyT(), shoes: emptyT(), accessories: emptyT(), condition: 'intact' },
    position: { inside: null, spot }, orientation: { facing: 'ahead', gaze: 'ahead' }, pose: { bodyPosition: 'standing', hands: '', feet: '' },
    emotion: { primary: role === 'creature' ? 'curious' : 'calm', intensity: 0.3 }, expression: 'neutral', movement: 'still', knowledge: [],
  };
}

/** World entities that appear at the turn: the first is a creature (a character) when the world has one. */
function worldEntities(x: Ctx, L: Lex, firstObject: number): Entity[] {
  const spot = T(`outside ${x.p.location.frame}`, `за ${L.r.l.frame.ins}`);
  return L.worldObjects.map((name, i): Entity => {
    if (i === 0 && !NON_CREATURE_WORLDS.has(x.p.world.key)) return supporting(x, L, 'character_02', 'creature', name, name, OTHER, spot, false);
    return object(`object_${String(firstObject + i).padStart(2, '0')}`, name, OTHER, spot, false);
  });
}

/** MASTER WORLD STATE: every entity the story knows, with its locked identity and initial condition. */
export function buildMaster(x: Ctx): WorldState {
  const L = lexicon(x);
  const { p } = x;
  const isCar = p.location.key === 'car';
  const entities: Record<string, Entity> = {};
  const add = (e: Entity) => (entities[e.id] = e);
  add(hero(x, L));
  add(location(HOME, T(p.location.label, L.r.l.label), p.location.key, T(L.baseEn.location, L.baseRu.location), L.baseEn, L.baseRu));
  add(location(OTHER, T(p.world.label, L.r.w.name), `world:${p.world.key}`, T(L.otherEn.location, L.otherRu.location), L.otherEn, L.otherRu));
  if (isCar) add(car());
  L.baseEn.objects.forEach((name, i) => add(object(`object_${String(i + 1).padStart(2, '0')}`, T(name, L.baseRu.objects[i] ?? name), isCar ? CAR : null, T(isCar ? 'in the car' : `in ${p.location.short}`, isCar ? 'в машине' : L.r.l.short.in), true)));
  for (const e of worldEntities(x, L, L.baseEn.objects.length + 1)) add(e);
  add(object(ARTIFACT, L.artifact, isCar ? CAR : null, T(fill(p.location.artifactPlace, p), L.r.f(L.r.l.artifactPlace)), false));
  const h = entities[HERO] as CharacterState;
  h.knowledge = Object.values(entities).filter((e) => e.present && e.id !== HERO).map((e) => e.id);
  const en = texts('en');
  const ru = texts('ru');
  return {
    story: { title: T(en.story.title(x), ru.story.title(x)), summary: T(en.story.summary(x), ru.story.summary(x)) },
    entities,
    relationships: [],
    currentLocation: HOME,
    visualStyle: T(L.baseEn.visualStyle, L.baseRu.visualStyle),
    cameraStyle: T(L.baseEn.cameraStyle, L.baseRu.cameraStyle),
    worldRules: [
      T(`The trigger (${L.trigger.en}) carries ${p.location.short} into ${p.world.label}; the place travels with ${p.character.ref}`, `Триггер (${L.trigger.ru}) переносит место действия в другой мир: ${L.r.w.name}`),
      T(`${cap(p.character.ref)} keeps the same face, body and clothes in both worlds`, `${cap(L.r.c.ref)} сохраняет то же лицо, телосложение и одежду в обоих мирах`),
      T('Whatever comes back from the other world stays (the artifact)', 'То, что вернулось из другого мира, остаётся (артефакт)'),
    ],
  };
}

export const worldIds = (m: WorldState) => Object.values(m.entities).filter((e) => e.kind !== 'location' && e.locationId === OTHER).map((e) => e.id);
export const creatureOf = (m: WorldState) => Object.values(m.entities).find((e) => e.kind === 'character' && e.role === 'creature')?.id ?? worldIds(m)[0];

export interface PlanArgs { beat: BeatName; k: number; hook: Hook; hasEsc: boolean }

/** Shock-hook openers and cold opens preview the turn instead of continuing the chain. */
export const isFlashForward = (a: Pick<PlanArgs, 'beat' | 'hook'>) => a.beat === 'COLD OPEN' || (a.beat === 'HOOK' && a.hook.type === 'shock');

/** Planned events of one beat (deterministic). */
export function planBeat(x: Ctx, master: WorldState, sceneId: string, a: PlanArgs): StoryEvent[] {
  if (isFlashForward(a)) return [];
  const L = lexicon(x);
  const isCar = Boolean(master.entities[CAR]);
  const ev = (key: string, e: Omit<StoryEvent, 'id'>): StoryEvent => ({ id: `${sceneId}:${key}`, ...e });
  const H = L.Hero;
  const creature = creatureOf(master);
  const cName = master.entities[creature]?.name ?? T('it', 'это');
  const cRu = cName.ru ?? cName.en;
  const facing = isCar ? 'windshield' : 'frame';
  const trigger = (): StoryEvent =>
    ev('trigger', {
      actor: HERO, target: isCar ? CAR : undefined, timing: 'during',
      action: T(`${H.en} ${L.trigger.en}`, `${H.ru} ${L.trigger.ru}`),
      result: isCar ? T("The driver's door is shut", 'Водительская дверь закрыта') : T('The ordinary moment is complete', 'Обычный момент завершён'),
      changes: isCar && /door/i.test(L.trigger.en) && !/open/i.test(L.trigger.en) ? [{ entity: CAR, path: 'doors.driver', value: 'closed' }] : [],
    });
  switch (a.beat) {
    case 'HOOK':
      return isCar ? [ev('approach', { actor: HERO, target: CAR, timing: 'during', action: T(`${H.en} walks up to the driver's door`, `${H.ru} подходит к водительской двери`), result: T('Standing at the car', 'У машины'), changes: [{ entity: HERO, path: 'orientation.facing', value: CAR }] })] : [];
    case 'SETUP': {
      if (a.k > 0) return [ev(`routine${a.k}`, { actor: HERO, timing: 'during', action: T(`${H.en} ${L.fe(x.p.location.routine)}`, `${H.ru} ${L.r.f(L.r.l.routine)}`), result: T('Routine', 'Рутина'), changes: [{ entity: HERO, path: 'pose.hands', value: 'busy' }] })];
      const enter = ev('enter', {
        actor: HERO, target: isCar ? CAR : HOME, timing: 'during',
        action: T(`${H.en} ${L.fe(x.p.location.enter)}`, `${H.ru} ${L.r.f(L.r.l.enter)}`),
        result: isCar ? T("In the driver's seat, the door still open", 'На водительском сиденье, дверь ещё открыта') : T(`Inside ${x.p.location.short}`, cap(L.r.l.short.in)),
        changes: [
          ...(isCar ? [{ entity: CAR, path: 'doors.driver', value: 'open' }, { entity: HERO, path: 'position.inside', value: CAR }] : []),
          { entity: HERO, path: 'position.spot', value: isCar ? T("the driver's seat", 'водительское сиденье') : T(`inside ${x.p.location.short}`, L.r.l.short.in) },
          { entity: HERO, path: 'pose.bodyPosition', value: isCar ? 'seated_driver' : 'settled' },
          { entity: HERO, path: 'movement', value: 'still' },
          { entity: HERO, path: 'orientation.facing', value: facing },
        ],
      });
      return a.hasEsc ? [enter] : [enter, trigger()];
    }
    case 'ESCALATION': {
      const i = Math.min(a.k, 2);
      const notice = ev(`omen${a.k}`, {
        actor: HERO, timing: 'during',
        action: T(`${H.en} notices: ${fill(x.p.world.omens[i], x.p)}`, `${H.ru} замечает: ${L.r.f(L.r.w.omens[i])}`), result: T('Something is off', 'Что-то не так'),
        changes: [
          ...(a.k === 0 ? [{ entity: HOME, path: 'lighting', value: L.omenLighting }] : []),
          { entity: HERO, path: 'emotion.primary', value: 'uneasy' },
          { entity: HERO, path: 'emotion.intensity', value: Math.min(0.4 + a.k * 0.15, 0.8) },
          { entity: HERO, path: 'orientation.gaze', value: facing },
        ],
      });
      return a.k === 0 ? [trigger(), notice] : [notice];
    }
    case 'TURN': {
      if (a.k > 0) {
        return [ev(`reaction${a.k}`, {
          actor: creature, target: HERO, timing: 'during',
          action: T(cap(fill(x.p.world.reaction, x.p)), cap(L.r.f(L.r.w.reaction))), result: T(`${cap(cName.en)} comes closer`, `${cap(cRu)} приближается`),
          changes: [{ entity: HERO, path: 'emotion.intensity', value: 0.95 }],
          relations: { add: [{ subject: creature, relation: 'approaching', object: HERO, strength: 0.9, status: 'active' }] },
        })];
      }
      const ids = worldIds(master);
      const change = ev('world', {
        actor: WORLD, timing: 'cut', explicit: true,
        action: T(`The world beyond ${x.p.location.frame} becomes ${x.p.world.label}`, `За ${L.r.l.frame.ins} теперь ${L.r.w.name}`),
        result: T(`${cap(x.p.location.short)} now stands in ${x.p.world.label}`, `Место действия — ${L.r.w.in}`),
        introduces: ids.map((id) => master.entities[id]),
        changes: [
          { entity: WORLD, path: 'currentLocation', value: OTHER },
          { entity: HERO, path: 'locationId', value: OTHER },
          ...(isCar ? [{ entity: CAR, path: 'locationId', value: OTHER }] : []),
        ],
      });
      const see = ev('see', {
        actor: HERO, target: creature, timing: 'during', reactsTo: creature,
        action: T(`${H.en} turns and sees ${cName.en}`, `${H.ru} оборачивается и видит: ${cRu}`),
        result: T(`${H.en} knows it is real`, `${H.ru} понимает, что это реально`),
        perceives: ids.map((id) => ({ character: HERO, entity: id })),
        changes: [
          { entity: HERO, path: 'orientation.facing', value: creature },
          { entity: HERO, path: 'orientation.gaze', value: creature },
          { entity: HERO, path: 'emotion.primary', value: 'fear' },
          { entity: HERO, path: 'emotion.intensity', value: 0.85 },
          { entity: HERO, path: 'expression', value: 'wide_eyed' },
        ],
        relations: { add: [{ subject: HERO, relation: 'looking_at', object: creature, strength: 1, status: 'active' }, ...(master.entities[creature]?.kind === 'character' ? [{ subject: creature, relation: 'looking_at', object: HERO, strength: 0.8, status: 'active' as const }] : [])] },
      });
      return [change, see];
    }
    case 'PAYOFF': {
      if (a.k > 0) return [];
      const revert = ev('revert', {
        actor: HERO, timing: 'cut', explicit: true,
        action: T(`${H.en} squeezes ${x.p.character.their} eyes shut — and the world is back to normal`, `${H.ru} зажмуривается — и мир снова прежний`),
        result: T(`${cap(x.p.location.short)} is back where it was, but something came back with it`, 'Всё на своих местах, но кое-что вернулось вместе с героем'),
        removes: worldIds(master),
        introduces: [master.entities[ARTIFACT]],
        changes: [
          { entity: WORLD, path: 'currentLocation', value: HOME },
          { entity: HERO, path: 'locationId', value: HOME },
          ...(isCar ? [{ entity: CAR, path: 'locationId', value: HOME }] : []),
          { entity: HOME, path: 'lighting', value: T(L.baseEn.lighting, L.baseRu.lighting) },
          { entity: HERO, path: 'orientation.facing', value: facing },
          { entity: HERO, path: 'orientation.gaze', value: 'ahead' },
        ],
        relations: { end: [{ subject: HERO, relation: 'looking_at', object: creature }, { subject: creature, relation: 'looking_at', object: HERO }, { subject: creature, relation: 'approaching', object: HERO }] },
      });
      const notice = ev('artifact', {
        actor: HERO, target: ARTIFACT, timing: 'during', reactsTo: ARTIFACT,
        action: T(`${H.en} notices ${L.artifact.en}`, `${H.ru} замечает: ${L.artifact.ru}`), result: T('Proof that it really happened', 'Доказательство, что всё было на самом деле'),
        perceives: [{ character: HERO, entity: ARTIFACT }],
        changes: [{ entity: HERO, path: 'emotion.primary', value: 'awe' }, { entity: HERO, path: 'emotion.intensity', value: 0.7 }, { entity: HERO, path: 'orientation.gaze', value: ARTIFACT }],
      });
      return [revert, notice];
    }
    default:
      return [];
  }
}

/** What a drafted scene shows, read from its CONTINUITY_STATE snapshot (English layer). */
export function claimsFromContinuity(c: ContinuityState, world: WorldState): SceneClaims {
  const all = Object.values(world.entities);
  const byName = new Map(all.map((e) => [e.name.en.trim().toLowerCase(), e.id]));
  const loc = all.find((e) => e.kind === 'location' && e.architecture.en === c.location)?.id;
  const present: string[] = [];
  const unknown: NonNullable<SceneClaims['unknown']> = [];
  for (const o of c.objects) {
    const id = byName.get(o.trim().toLowerCase());
    if (id) present.push(id);
    else unknown.push({ name: o });
  }
  const hero = all.find((e) => e.kind === 'character' && e.role === 'hero');
  const target = loc ?? world.currentLocation;
  return {
    location: loc,
    present,
    unknown,
    values: [
      ...(hero ? [{ entity: hero.id, path: 'identity.faceDescription', value: c.character }, { entity: hero.id, path: 'wardrobe.clothing', value: c.wardrobe }] : []),
      { entity: target, path: 'lighting', value: c.lighting },
      { entity: target, path: 'time', value: c.time },
      { entity: target, path: 'weather', value: c.weather },
      { entity: target, path: 'palette', value: c.colorPalette },
    ],
  };
}

/** CONTINUITY_STATE snapshot rendered from the validated world state, in one prompt language. */
export function continuityFromState(state: WorldState, lang: Lang, listed: (e: Entity) => boolean): ContinuityState | null {
  const hero = Object.values(state.entities).find((e): e is CharacterState => e.kind === 'character' && e.role === 'hero');
  const loc = state.entities[state.currentLocation];
  if (!hero || !loc || loc.kind !== 'location') return null;
  if (lang === 'ru' && !(hero.wardrobe.clothing.ru && loc.architecture.ru)) return null;
  const t = (v: Text) => tx(v, lang);
  const here = (e: Entity) => e.locationId === null || e.locationId === state.currentLocation || (state.entities[e.locationId]?.kind === 'vehicle' && state.entities[e.locationId].locationId === state.currentLocation);
  const objects = Object.values(state.entities).filter((e) => e.present && e.kind !== 'location' && listed(e) && here(e));
  return {
    character: t(hero.identity.faceDescription),
    location: t(loc.architecture),
    objects: objects.map((e) => t(e.name)),
    wardrobe: t(hero.wardrobe.clothing),
    lighting: t(loc.lighting),
    time: t(loc.time),
    weather: t(loc.weather),
    cameraStyle: t(state.cameraStyle),
    visualStyle: t(state.visualStyle),
    colorPalette: t(loc.palette),
  };
}
