export type Duration = 10 | 15 | 30 | 60;
export type ReelFormat = '9:16';
export type ReelStyle = 'cinematic' | 'ugc' | 'commercial' | 'comedy' | 'realistic';

export interface ReelSettings {
  duration: Duration;
  format: ReelFormat;
  style: ReelStyle;
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

export interface Scene {
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
  image: ImageSpec;
  video: VideoSpec;
  /** Snapshot of CONTINUITY_STATE this scene was generated with. */
  continuity: ContinuityState;
  imagePrompt: string;
  videoPrompt: string;
}

export interface SceneBundle {
  continuity: ContinuityState;
  scenes: Scene[];
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
  /** Boost areas already applied by MAKE IT STRONGER. */
  boosts: BoostArea[];
  version: number;
  isDemo?: boolean;
  createdAt: number;
}

export type AIMode = 'demo' | 'openai' | 'gemini';
export type AITask = 'analyze' | 'hooks' | 'story' | 'scenes' | 'stronger';

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
