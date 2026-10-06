import type { ParsedIdea } from '../parser';
import type { BeatName, BoostArea, ContinuityState, Hook, HookType, IdeaAnalysis, ImageSpec, Lang, ReelStyle, Scene, StoryBeat, VideoSpec } from '../types';

/** Everything a language pack needs to phrase one idea. */
export interface Ctx { p: ParsedIdea; style: ReelStyle }

export type Strength = 'hero' | 'location' | 'surprise' | 'twist' | 'conflict';
export type Weakness = 'noHero' | 'noLocation' | 'noSurprise' | 'notVisual' | 'noConflict' | 'noEmotion' | 'tooShort';
export type Core = Pick<Scene, 'purpose' | 'visual' | 'action' | 'camera' | 'lighting' | 'sound' | 'onScreenText' | 'voiceover' | 'image' | 'video'>;
export interface SceneArgs { beat: StoryBeat; k: number; hook: Hook; cont: ContinuityState; isLast: boolean; hasEsc: boolean }
export type HookText = Pick<Hook, 'hook' | 'whyItWorks' | 'openingShot' | 'onScreenText'>;

export interface StrongerTexts {
  labels: Record<BoostArea, string>;
  why: Record<BoostArea, string>;
  coldOpen(x: Ctx): Pick<Scene, 'purpose' | 'visual' | 'action' | 'camera' | 'sound' | 'onScreenText'>;
  coldImage(x: Ctx): Partial<ImageSpec>;
  coldVideo: Partial<VideoSpec>;
  openingBefore(end: number, visual: string): string;
  openingAfter(x: Ctx): string;
  caption(x: Ctx, hook: HookType): string;
  onScreen(text: string): string;
  timeline(scenes: Pick<Scene, 'beat' | 'start' | 'end'>[]): string;
  pacingTight: string;
  setupCameraSuffix: string;
  setupTransition: string;
  conflict(x: Ctx): { extra: string; purpose: string };
  conflictPhysical(x: Ctx): string;
  escalationSteps: [string, string, string];
  heartbeat: string;
  turnFacial: string;
  turnSound(x: Ctx): string;
  turnReaction(text: string): string;
  surpriseCamera(x: Ctx): string;
  surpriseSpec(x: Ctx): { composition: string; cameraAngle: string; cameraMovement: string };
  payoffAction(x: Ctx): string;
  payoffEndingFrame: string;
  payoffText: string;
  storyPacing(coldOpen: boolean, turnStart: number): string;
  message: string;
}

/**
 * A language pack: every user-visible or prompt-visible phrase the offline engine produces.
 * The engine (engine.ts) owns structure, timing, scoring and continuity; packs own wording only.
 */
export interface Texts {
  lang: Lang;
  none: { text: string; vo: string };
  /** Rewrites the user's idea; chosen by the language the idea is written in. */
  improveIdea(p: ParsedIdea): string;
  analysis(x: Ctx): Pick<IdeaAnalysis, 'concept' | 'mainCharacter' | 'goal' | 'conflict' | 'surprise' | 'emotionalDirection' | 'payoff'>;
  strength(code: Strength, x: Ctx): string;
  weakness(code: Weakness, x: Ctx): string;
  hooks(x: Ctx): Record<HookType, HookText>;
  story: {
    beat(x: Ctx, beat: BeatName, k: number, hook: Hook, hasEsc: boolean): string;
    emotion(beat: BeatName, comedy: boolean): string;
    /** `variant` = a repeated beat (second ESCALATION / TURN / PAYOFF shot). */
    pacing(beat: BeatName, variant: boolean): string;
    notes: { shock: string; noEsc: string; long(duration: number): string; classic: string };
    twistAdded(x: Ctx): string;
    heroAdded(x: Ctx): string;
    title(x: Ctx): string;
    summary(x: Ctx): string;
    overview(hookEnd: number, turnStart: number, payoffStart: number): string;
  };
  continuity: {
    base(x: Ctx): ContinuityState;
    omenLighting(base: string, x: Ctx): string;
    other(x: Ctx): Pick<ContinuityState, 'location' | 'objects' | 'lighting' | 'time' | 'weather' | 'colorPalette'>;
    artifact(x: Ctx): string;
  };
  scene(x: Ctx, a: SceneArgs): Core;
  stronger: StrongerTexts;
}
