import type { SceneCheck, SceneDraft, StoryWorld } from './continuity/types';

export type Duration = 10 | 15 | 30 | 60;
export type ReelFormat = '9:16';
export type ReelStyle = 'cinematic' | 'ugc' | 'commercial' | 'comedy' | 'realistic';
/** Narrative/UI language and, separately, prompt language. */
export type Lang = 'ru' | 'en';

export interface ReelSettings {
  duration: Duration;
  format: ReelFormat;
  style: ReelStyle;
  /** Language of the UI and of all narrative content (analysis, hooks, story, scenes, voiceover, on-screen text). */
  language: Lang;
  /** Language the image/video prompts are shown and copied in. */
  promptLanguage: Lang;
}

export type Verdict = 'strong' | 'needs-work' | 'weak';

export interface IdeaAnalysis {
  concept: string;
  mainCharacter: string;
  goal: string;
  conflict: string;
  surprise: string;
  emotionalDirection: string;
  payoff: string;
  /** 0–10, how ready the idea is for a short vertical video. */
  score: number;
  verdict: Verdict;
  strengths: string[];
  weaknesses: string[];
  /** Present when the idea has weaknesses worth fixing. */
  improvedIdea?: string;
}

export type HookType = 'curiosity' | 'shock' | 'emotional' | 'visual' | 'story';

export interface Hook {
  id: string;
  type: HookType;
  hook: string;
  whyItWorks: string;
  /** What the viewer sees in the first 1–2 seconds. */
  openingShot: string;
  onScreenText: string;
}

export type BeatName = 'COLD OPEN' | 'HOOK' | 'SETUP' | 'ESCALATION' | 'TURN' | 'PAYOFF';

export interface StoryBeat {
  beat: BeatName;
  start: number;
  end: number;
  description: string;
  /** Viewer emotion at this beat. */
  emotion: string;
  tempo: 'fast' | 'pause' | 'peak' | 'steady';
  pacing: string;
}

export interface Story {
  title: string;
  summary: string;
  /** Why the structure deviates from HOOK → SETUP → ESCALATION → TURN → PAYOFF, if it does. */
  structureNote: string;
  beats: StoryBeat[];
  emotionalArc: string;
  pacing: string;
  /** Elements the engine had to add because the idea lacked them. */
  additions: string[];
}

/** Internal visual memory passed to every scene. Not shown to the user in Phase 1. */
export interface ContinuityState {
  character: string;
  location: string;
  objects: string[];
  wardrobe: string;
  lighting: string;
  time: string;
  weather: string;
  cameraStyle: string;
  visualStyle: string;
  colorPalette: string;
}

export interface ImageSpec {
  subject: string;
  composition: string;
  cameraAngle: string;
  lens: string;
  depthOfField: string;
  materials: string;
  textures: string;
  atmosphere: string;
  /** Optional per-shot lighting; prompts fall back to CONTINUITY_STATE lighting. */
  lighting?: string;
}

export interface VideoSpec {
  subjectMovement: string;
  cameraMovement: string;
  objectMovement: string;
  facialMovement: string;
  environmentMovement: string;
  physicalInteraction: string;
  timing: string;
  transition: string;
  endingFrame: string;
}

/** Machine layer of a scene in one prompt language: specs, continuity and the compiled prompts. */
export interface PromptLayer {
  image: ImageSpec;
  video: VideoSpec;
  /** Snapshot of CONTINUITY_STATE this scene was generated with. */
  continuity: ContinuityState;
  imagePrompt: string;
  videoPrompt: string;
}

/**
 * Narrative fields are in the reel's language. The top-level prompt layer is English (the default and
 * generator-optimized language); `ru` holds the Russian prompt layer when it is available.
 */
export interface Scene extends PromptLayer {
  id: string;
  beat: BeatName;
  start: number;
  end: number;
  purpose: string;
  visual: string;
  action: string;
  camera: string;
  lighting: string;
  sound: string;
  onScreenText: string;
  voiceover: string;
  ru?: PromptLayer;
  /** Planned events and what the scene shows, as drafted (before validation). */
  draft?: SceneDraft;
  /** Continuity Engine result: contract, validation, repairs and prompt state lines. */
  check?: SceneCheck;
}

export interface SceneBundle {
  continuity: ContinuityState;
  scenes: Scene[];
  world?: StoryWorld;
}

export type BoostArea = 'opening' | 'curiosity' | 'pacing' | 'conflict' | 'escalation' | 'surprise' | 'payoff';

export interface Improvement {
  area: BoostArea;
  label: string;
  before: string;
  after: string;
  why: string;
}

export interface StrongerResult {
  hook: Hook;
  story: Story;
  scenes: Scene[];
  improvements: Improvement[];
  /** Set when nothing could be improved. */
  message?: string;
  world?: StoryWorld;
}

export interface Reel {
  id: string;
  idea: string;
  settings: ReelSettings;
  analysis?: IdeaAnalysis;
  hooks?: Hook[];
  selectedHookId?: string;
  story?: Story;
  continuity?: ContinuityState;
  scenes?: Scene[];
  /** Continuity Engine 2.0: master state, current state, per-scene timeline and event log. */
  world?: StoryWorld;
  /** Continue Story choices in order (replayed when an offline reel is re-rendered in another language). */
  continued?: ContinueChoice[];
  /** Boost areas already applied by MAKE IT STRONGER. */
  boosts: BoostArea[];
  version: number;
  isDemo?: boolean;
  /** 'offline' reels can be re-rendered in another language locally; 'ai' reels need a new generation. */
  source: 'offline' | 'ai';
  createdAt: number;
}

export type AIMode = 'demo' | 'openai' | 'gemini';
export type AITask = 'analyze' | 'hooks' | 'story' | 'scenes' | 'stronger' | 'prompts' | 'continueOptions' | 'continue';

export type ContinueKind = 'step-out' | 'returns' | 'witness' | 'artifact' | 'escape' | 'noticed' | 'second' | 'flicker' | 'custom';
export interface ContinueChoice {
  kind: ContinueKind;
  /** Model-proposed option id (AI reels). */
  optionId?: string;
}

export interface AIStatus {
  mode: AIMode;
  connected: boolean;
  model?: string;
  message: string;
}

export interface AIResponse<T> {
  data: T;
  mode: AIMode;
  notice?: string;
}
