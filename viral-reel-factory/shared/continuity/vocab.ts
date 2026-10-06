// Localized labels for state keys and enum-like values. State values stay English keys internally.
import type { Lang } from '../types';
import { isText } from './locks';
import type { Category, CheckStatus, EntityKind, IssueCode, Severity, Text, Value, WorldState } from './types';

type L = Record<Lang, string>;
const l = (en: string, ru: string): L => ({ en, ru });

export const VALUE_LABELS: Record<string, L> = {
  open: l('open', 'открыта'),
  closed: l('closed', 'закрыта'),
  on: l('on', 'включён'),
  off: l('off', 'выключен'),
  up: l('up', 'подняты'),
  down: l('down', 'опущены'),
  left: l('left hand', 'левая рука'),
  right: l('right hand', 'правая рука'),
  both: l('both hands', 'обе руки'),
  standing: l('standing', 'стоит'),
  walking: l('walking', 'идёт'),
  running: l('running', 'бежит'),
  seated_driver: l("seated in the driver's seat", 'сидит на водительском сиденье'),
  seated: l('seated', 'сидит'),
  settled: l('settled in place', 'устроилась на месте'),
  crouching: l('crouching', 'пригнулась'),
  frozen: l('frozen still', 'замерла'),
  still: l('still', 'неподвижно'),
  calm: l('calm', 'спокойствие'),
  curious: l('curiosity', 'любопытство'),
  uneasy: l('unease', 'тревога'),
  fear: l('fear', 'страх'),
  terror: l('terror', 'ужас'),
  awe: l('awe', 'изумление'),
  wonder: l('wonder', 'восхищение'),
  relief: l('relief', 'облегчение'),
  determination: l('determination', 'решимость'),
  disbelief: l('disbelief', 'недоверие'),
  neutral: l('neutral', 'нейтральное'),
  wide_eyed: l('wide-eyed', 'широко раскрытые глаза'),
  ahead: l('ahead', 'вперёд'),
  windshield: l('the windshield', 'лобовое стекло'),
  frame: l('the window', 'окно'),
  healthy: l('unharmed', 'невредима'),
  injured: l('injured', 'ранена'),
  dead: l('dead', 'мертва'),
  unconscious: l('unconscious', 'без сознания'),
  intact: l('intact', 'целый'),
  glowing: l('glowing', 'светится'),
  relaxed: l('relaxed', 'расслаблены'),
  busy: l('busy', 'заняты'),
  gripping: l('gripping the door handle', 'сжимают ручку двери'),
  visible: l('visible', 'видно'),
  hidden: l('hidden', 'скрыт'),
  none: l('none', 'нет'),
  'not visible': l('not visible', 'не виден'),
};

export const PATH_LABELS: Record<string, L> = {
  'doors.driver': l("driver's door", 'водительская дверь'),
  'doors.passenger': l('passenger door', 'пассажирская дверь'),
  engine: l('engine', 'двигатель'),
  lights: l('headlights', 'фары'),
  windows: l('windows', 'окна'),
  damage: l('damage', 'повреждения'),
  color: l('color', 'цвет'),
  'position.inside': l('inside', 'внутри'),
  'position.spot': l('position', 'положение'),
  locationId: l('location', 'локация'),
  currentLocation: l('location', 'локация'),
  'emotion.primary': l('emotion', 'эмоция'),
  'emotion.intensity': l('emotion intensity', 'сила эмоции'),
  'orientation.facing': l('facing', 'повёрнута к'),
  'orientation.gaze': l('gaze', 'взгляд'),
  'pose.bodyPosition': l('pose', 'поза'),
  'pose.hands': l('hands', 'руки'),
  expression: l('expression', 'выражение лица'),
  movement: l('movement', 'движение'),
  physicalCondition: l('physical condition', 'физическое состояние'),
  heldBy: l('held by', 'в руках у'),
  hand: l('hand', 'рука'),
  spot: l('position', 'положение'),
  condition: l('condition', 'состояние'),
  present: l('in the story world', 'присутствует'),
  knowledge: l('knows about', 'знает о'),
  'wardrobe.clothing': l('clothing', 'одежда'),
  'wardrobe.shoes': l('shoes', 'обувь'),
  'wardrobe.accessories': l('accessories', 'аксессуары'),
  'wardrobe.condition': l('clothing condition', 'состояние одежды'),
  'identity.faceDescription': l('face and appearance', 'лицо и внешность'),
  'identity.hair': l('hair', 'волосы'),
  'identity.eyes': l('eyes', 'глаза'),
  time: l('time', 'время'),
  weather: l('weather', 'погода'),
  lighting: l('lighting', 'освещение'),
  palette: l('color palette', 'палитра'),
  architecture: l('architecture', 'архитектура'),
};

export const RELATION_LABELS: Record<string, L> = {
  at: l('is at', 'находится в локации'),
  inside: l('is inside', 'внутри'),
  holding: l('is holding', 'держит'),
  looking_at: l('is looking at', 'смотрит на'),
  approaching: l('is approaching', 'приближается к'),
  next_to: l('is next to', 'рядом с'),
  following: l('is following', 'следует за'),
};

export const CATEGORY_LABELS: Record<Category, L> = {
  identity: l('Identity', 'Личность'),
  appearance: l('Appearance', 'Внешность'),
  wardrobe: l('Wardrobe', 'Одежда'),
  location: l('Location', 'Локация'),
  objects: l('Objects', 'Предметы'),
  relationships: l('Relationships', 'Связи'),
  position: l('Position', 'Положение'),
  time: l('Time', 'Время'),
  weather: l('Weather', 'Погода'),
  lighting: l('Lighting', 'Освещение'),
  causality: l('Causality', 'Причинность'),
  knowledge: l('Knowledge', 'Знание'),
  physics: l('Physics', 'Физика'),
};

export const SEVERITY_LABELS: Record<Severity, L> = {
  low: l('low', 'низкая'),
  medium: l('medium', 'средняя'),
  high: l('high', 'высокая'),
  critical: l('critical', 'критическая'),
};

export const STATUS_LABELS: Record<CheckStatus, L> = {
  passed: l('✓ Continuity verified', '✓ Последовательность проверена'),
  repaired: l('⚠ Contradiction found — fixed automatically', '⚠ Обнаружено противоречие — исправлено автоматически'),
  'needs-review': l('⚠ Scene needs review', '⚠ Требуется проверка сцены'),
};

export const KIND_LABELS: Record<EntityKind, L> = {
  character: l('Character', 'Персонаж'),
  location: l('Location', 'Локация'),
  object: l('Object', 'Предмет'),
  vehicle: l('Vehicle', 'Транспорт'),
  product: l('Product', 'Товар'),
};

export const tx = (t: Text | undefined, lang: Lang): string => (t ? (lang === 'ru' ? (t.ru ?? t.en) : t.en) : '');

export function nameOf(state: WorldState | undefined, id: string, lang: Lang): string {
  if (id === 'world') return lang === 'ru' ? 'мир' : 'the world';
  const e = state?.entities[id];
  return e ? tx(e.name, lang) : id;
}

export const pathLabel = (path: string, lang: Lang) => PATH_LABELS[path]?.[lang] ?? PATH_LABELS[path.split('.').pop()!]?.[lang] ?? path;

/** Human-readable value: Text in the language, entity ids as names, known keys as labels. */
export function valueLabel(v: Value | undefined, lang: Lang, state?: WorldState): string {
  if (v === undefined || v === null || v === '') return '—';
  if (isText(v)) return tx(v, lang) || '—';
  if (Array.isArray(v)) return v.length ? v.map((x) => valueLabel(x, lang, state)).join(', ') : VALUE_LABELS.none[lang];
  if (typeof v === 'boolean') return lang === 'ru' ? (v ? 'да' : 'нет') : v ? 'yes' : 'no';
  if (typeof v === 'number') return String(v);
  if (state?.entities[v]) return tx(state.entities[v].name, lang);
  return VALUE_LABELS[v]?.[lang] ?? v;
}

const Q = (lang: Lang, s: string) => (lang === 'ru' ? `«${s}»` : `“${s}”`);

/** Issue message in the UI language. */
export function issueText(i: { code: IssueCode; entity?: string; entityName?: Text; path?: string; expected?: Value; claimed?: Value }, lang: Lang, state?: WorldState): string {
  const who = i.entityName ? tx(i.entityName, lang) : i.entity ? nameOf(state, i.entity, lang) : '';
  const what = i.path ? pathLabel(i.path, lang) : '';
  const exp = valueLabel(i.expected, lang, state);
  const got = valueLabel(i.claimed, lang, state);
  const ru = lang === 'ru';
  switch (i.code) {
    case 'locked-change':
      return ru ? `${who}: ${what} — заблокированное свойство изменено (${Q(lang, got)} вместо ${Q(lang, exp)})` : `${who}: ${what} is locked but changed (${Q(lang, got)} instead of ${Q(lang, exp)})`;
    case 'unexplained-change':
      return ru ? `${who}: ${what} изменилось без события (${Q(lang, got)} вместо ${Q(lang, exp)})` : `${who}: ${what} changed with no event to explain it (${Q(lang, got)} instead of ${Q(lang, exp)})`;
    case 'hallucination':
      return ru ? `Появился объект, которого нет в истории: ${Q(lang, got)}` : `An object that is not part of the story appeared: ${Q(lang, got)}`;
    case 'reappeared':
      return ru ? `${who} снова в кадре, хотя покинул(а) сцену` : `${who} is back in the scene although it left`;
    case 'dropped':
      return ru ? `${who} пропал(а) из сцены без события` : `${who} vanished from the scene with no event`;
    case 'knowledge':
      return ru ? `${who} реагирует на ${Q(lang, got)}, хотя ещё не знает об этом` : `${who} reacts to ${Q(lang, got)} before knowing about it`;
    case 'dead-acts':
      return ru ? `${who} действует, хотя по сюжету мёртв(а)` : `${who} acts although dead in the story`;
    case 'redundant-event':
      return ru ? `${who}: ${what} уже ${Q(lang, exp)} — действие ничего не меняет` : `${who}: ${what} is already ${Q(lang, exp)} — the action changes nothing`;
    case 'impossible-exit':
      return ru ? `${who} проходит сквозь закрытую дверь (${Q(lang, got)})` : `${who} passes through a closed door (${Q(lang, got)})`;
    case 'too-many-held':
      return ru ? `${who} держит больше предметов, чем позволяют две руки` : `${who} holds more objects than two hands allow`;
    case 'absent-target':
      return ru ? `Действие направлено на ${Q(lang, got)}, которого нет в сцене` : `The action targets ${Q(lang, got)}, which is not in the scene`;
    case 'damage-removed':
      return ru ? `${who}: повреждения исчезли без ремонта` : `${who}: damage vanished without a repair`;
    case 'location-jump':
      return ru ? `Локация сменилась без события (${Q(lang, got)} вместо ${Q(lang, exp)})` : `The location changed with no event (${Q(lang, got)} instead of ${Q(lang, exp)})`;
    case 'bad-relation':
      return ru ? `Связь не соответствует состоянию: ${Q(lang, got)}` : `Relationship contradicts the state: ${Q(lang, got)}`;
    case 'unknown-actor':
      return ru ? `Действует неизвестный персонаж: ${Q(lang, got)}` : `Unknown actor: ${Q(lang, got)}`;
  }
}
