export type AngleType = 'pain' | 'result' | 'emotion' | 'humor' | 'expert';
export type Duration = 10 | 15 | 20 | 30 | 45 | 60;
export type Platform = 'reels' | 'tiktok' | 'shorts' | 'vk';
export type VisualStyle = 'cinematic' | 'ugc' | 'commercial' | 'funny' | 'luxury' | 'expert' | 'viral';
export type ProjectStatus = 'draft' | 'generated' | 'ready';
export type VoiceGender = 'male' | 'female';
export type VoiceTone = 'energetic' | 'calm' | 'expert' | 'friendly' | 'dramatic' | 'funny';
export type VoiceSpeed = 'slow' | 'normal' | 'fast';
export type AIMode = 'demo' | 'openai' | 'gemini';

export interface ProductInput {
  ozonUrl: string;
  /** Resized data URL of the uploaded product photo; the main visual reference. */
  imageDataUrl?: string;
  name: string;
  category: string;
  price: string;
  specs: string;
  benefits: string;
  audience: string;
  restrictions: string;
  /** Free-text description of the product's look used by Product Lock. */
  appearance: string;
}

export interface RiskFlag {
  phrase: string;
  source: string;
  reason: string;
  safeAlternative: string;
}

export interface ProductAnalysis {
  name: string;
  category: string;
  audience: string;
  pain: string;
  desire: string;
  mainBenefit: string;
  sellingPoint: string;
  objections: string[];
  reasonsNow: string[];
  risks: RiskFlag[];
  rules: string[];
}

export interface AdAngle {
  id: string;
  type: AngleType;
  title: string;
  hook: string;
  idea: string;
  emotion: string;
  whyItWorks: string;
  audience: string;
}

export interface GeneratorSettings {
  format: '9:16';
  duration: Duration;
  platform: Platform;
  style: VisualStyle;
  cta: string;
}

export interface Scene {
  id: string;
  goal: string;
  duration: number;
  action: string;
  onScreenText: string;
  voiceover: string;
  camera: string;
  lighting: string;
  sound: string;
  imagePrompt: string;
  videoPrompt: string;
  /** English description of the last frame, used by Continue Story for seamless cuts. */
  endingFrame: string;
}

export interface ProductLock {
  hasReference: boolean;
  appearance: string;
  attributes: string[];
  clause: string;
}

export interface VoiceSettings {
  voice: VoiceGender;
  tone: VoiceTone;
  speed: VoiceSpeed;
}

export interface SocialVariation {
  id: 'A' | 'B' | 'C';
  label: string;
  caption: string;
}

export interface SocialPackage {
  caption: string;
  hook: string;
  cta: string;
  hashtags: string[];
  keywords: string[];
  variations: SocialVariation[];
}

export interface ViralChange {
  area: string;
  before: string;
  after: string;
}

export interface ViralResult {
  scenes: Scene[];
  changes: ViralChange[];
}

export interface ViralState {
  beforeScenes: Scene[];
  changes: ViralChange[];
  appliedAt: string;
}

export interface Project {
  id: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  product: ProductInput;
  analysis?: ProductAnalysis;
  angles?: AdAngle[];
  selectedAngleId?: string;
  /** Angle the current scenes were generated for. */
  scriptAngleId?: string;
  settings: GeneratorSettings;
  scenes: Scene[];
  voice: VoiceSettings;
  social?: SocialPackage;
  viral?: ViralState;
  /** Which engine produced the latest generation. */
  generatedBy?: AIMode;
}

export interface GenContext {
  product: ProductInput;
  analysis: ProductAnalysis;
  angle: AdAngle;
  settings: GeneratorSettings;
}

export type AITask = 'analyze' | 'angles' | 'script' | 'viral' | 'continue' | 'social';

export interface AIResponse<T> {
  data: T;
  mode: AIMode;
  /** Shown to the user, e.g. when a provider failed and demo output was used instead. */
  notice?: string;
}

export interface AIStatus {
  mode: AIMode;
  connected: boolean;
  model?: string;
  message: string;
}
