// Continuity Engine 2.0 — data model. Internal keys are English; every user-visible value is a Text with
// an English canonical form (used for comparison and for generator prompts) and an optional Russian form.
import type { Lang } from '../types';

export interface Text {
  en: string;
  ru?: string;
}
export type Value = string | number | boolean | null | Text | string[];

export type LockType = 'locked' | 'mutable' | 'conditional';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export const CATEGORIES = ['identity', 'appearance', 'wardrobe', 'location', 'objects', 'relationships', 'position', 'time', 'weather', 'lighting', 'causality', 'knowledge', 'physics'] as const;
export type Category = (typeof CATEGORIES)[number];
export type EntityKind = 'character' | 'location' | 'object' | 'vehicle' | 'product';

interface EntityBase {
  id: string;
  /** Stable handle for future reference images (character_01, vehicle_01, …). */
  referenceId: string;
  kind: EntityKind;
  name: Text;
  /** Physically present in the story world right now (not "in frame"). */
  present: boolean;
  /** Location id, or a vehicle id for things inside a vehicle. */
  locationId: string | null;
}

export interface CharacterState extends EntityBase {
  kind: 'character';
  role: 'hero' | 'supporting' | 'creature';
  identity: { gender: string; approximateAge: Text; faceDescription: Text; hair: Text; eyes: Text; bodyType: Text; distinctiveFeatures: Text };
  wardrobe: { clothing: Text; shoes: Text; accessories: Text; condition: string };
  position: { inside: string | null; spot: Text };
  orientation: { facing: string; gaze: string };
  pose: { bodyPosition: string; hands: string; feet: string };
  emotion: { primary: string; intensity: number };
  expression: string;
  physicalCondition: string;
  movement: string;
  /** Entity ids this character knows exist. */
  knowledge: string[];
}

export interface LocationState extends EntityBase {
  kind: 'location';
  type: string;
  architecture: Text;
  layout: Text;
  time: Text;
  weather: Text;
  lighting: Text;
  palette: Text;
  backgroundElements: Text;
  foregroundElements: Text;
  atmosphere: Text;
}

export interface ObjectState extends EntityBase {
  kind: 'object';
  type: string;
  appearance: Text;
  color: Text;
  material: Text;
  spot: Text;
  owner: string | null;
  heldBy: string | null;
  hand: 'left' | 'right' | 'both' | null;
  condition: string;
  orientation: string;
  visibility: string;
}

export interface VehicleState extends EntityBase {
  kind: 'vehicle';
  make: Text;
  model: Text;
  color: Text;
  body: Text;
  wheels: Text;
  plate: string;
  doors: Record<string, 'open' | 'closed'>;
  windows: string;
  engine: 'on' | 'off';
  lights: 'on' | 'off';
  damage: string[];
  interior: Text;
}

/** Prepared for the Product/Ozon mode: every design property is locked. */
export interface ProductState extends EntityBase {
  kind: 'product';
  shape: Text;
  color: Text;
  branding: Text;
  logo: Text;
  packaging: Text;
  label: Text;
  dimensions: Text;
  materials: Text;
  design: Text;
  spot: Text;
  condition: string;
}

export type Entity = CharacterState | LocationState | ObjectState | VehicleState | ProductState;

export interface Relationship {
  subject: string;
  relation: string;
  object: string;
  /** 0–1 */
  strength: number;
  status: 'active' | 'ended';
}

export interface WorldState {
  story: { title: Text; summary: Text };
  entities: Record<string, Entity>;
  /** Explicit relations set by events; structural ones (inside, holding, at) are derived. */
  relationships: Relationship[];
  currentLocation: string;
  visualStyle: Text;
  cameraStyle: Text;
  worldRules: Text[];
}

export interface ChangeOp {
  entity: string;
  path: string;
  value: Value;
}

export interface StateChange {
  entity: string;
  path: string;
  from: Value;
  to: Value;
}

/** A planned or generated story event. Only events may change conditional and locked properties. */
export interface StoryEvent {
  id: string;
  actor: string;
  target?: string;
  action: Text;
  result: Text;
  /** 'cut' events happen at the cut into the scene (they shape its opening frame). */
  timing: 'cut' | 'during';
  changes: ChangeOp[];
  introduces?: Entity[];
  /** Entity ids that leave the story world (present → false). */
  removes?: string[];
  perceives?: { character: string; entity: string }[];
  /** The actor reacts to this entity — it must already be known (or be perceived by this event). */
  reactsTo?: string;
  relations?: { add?: Relationship[]; end?: Pick<Relationship, 'subject' | 'relation' | 'object'>[] };
  /** Explicit story transformation: allowed to change locked properties. */
  explicit?: boolean;
}

/** What a generated scene shows; validated against the state its events lead to. */
export interface SceneClaims {
  location?: string;
  present?: string[];
  /** Things the scene shows that do not exist in the world state. */
  unknown?: { name: string; kind?: EntityKind }[];
  values?: ChangeOp[];
  reactions?: { character: string; to: string }[];
  relations?: Relationship[];
}

export interface SceneDraft {
  events: StoryEvent[];
  claims: SceneClaims;
  /** Flash-forward shot (cold open / shock hook): validated against the scene it previews, outside the chain. */
  flashForward?: boolean;
}

export type IssueCode =
  | 'locked-change'
  | 'unexplained-change'
  | 'hallucination'
  | 'reappeared'
  | 'dropped'
  | 'knowledge'
  | 'dead-acts'
  | 'redundant-event'
  | 'impossible-exit'
  | 'too-many-held'
  | 'absent-target'
  | 'damage-removed'
  | 'location-jump'
  | 'bad-relation'
  | 'unknown-actor';

export type RepairOp =
  | { type: 'restore'; entity: string; path: string }
  | { type: 'restore-location' }
  | { type: 'remove-unknown'; name: string }
  | { type: 'remove-present'; entity: string }
  | { type: 'add-present'; entity: string }
  | { type: 'remove-reaction'; character: string; to: string }
  | { type: 'drop-change'; eventId: string; entity: string; path: string }
  | { type: 'drop-event'; eventId: string }
  | { type: 'drop-reaction-event'; eventId: string }
  | { type: 'remove-relation'; subject: string; relation: string; object: string };

export interface Issue {
  code: IssueCode;
  category: Category;
  severity: Severity;
  entity?: string;
  /** Entity name at detection time, so messages survive repairs that remove the entity. */
  entityName?: Text;
  path?: string;
  expected?: Value;
  claimed?: Value;
  eventId?: string;
  /** Deterministic fix; absent when the contradiction changes the plot and needs a human. */
  fix?: RepairOp;
}

export type Scores = Record<Category | 'overall', number>;

export interface ContractItem {
  entity: string;
  path: string;
  value: Value;
}

export interface SceneContract {
  sceneId: string;
  mustPreserve: ContractItem[];
  mustChange: StateChange[];
  mustNotChange: ContractItem[];
  newElements: string[];
  removedElements: string[];
  /** World state ids are snapshots stored in StoryWorld.timeline. */
  storyPurpose: string;
}

export type CheckStatus = 'passed' | 'repaired' | 'needs-review';

/** Pre-rendered state lines for the prompt builder, per prompt language. */
export interface PromptContext {
  references: string;
  opening: string[];
  changes: string[];
  ending: string[];
  spatial: string[];
}

export interface SceneCheck {
  status: CheckStatus;
  attempts: number;
  /** Problems still open (status needs-review) or low notes. */
  issues: Issue[];
  /** Problems found and fixed automatically. */
  repaired: Issue[];
  scores: Scores;
  contract: SceneContract;
  changes: StateChange[];
  eventIds: string[];
  prompt: Partial<Record<Lang, PromptContext>> & { en: PromptContext };
}

export interface EventLogEntry {
  id: string;
  n: number;
  sceneId: string;
  /** Seconds from the start of the reel. */
  timestamp: number;
  actor: string;
  action: Text;
  target?: string;
  result: Text;
  stateChanges: StateChange[];
}

export interface TimelineEntry {
  sceneId: string;
  start: WorldState;
  /** State after the scene's cut events: the scene's opening frame (image prompt). */
  opening: WorldState;
  end: WorldState;
}

export interface StoryWorld {
  mode: 'offline' | 'ai';
  master: WorldState;
  current: WorldState;
  timeline: TimelineEntry[];
  log: EventLogEntry[];
}
