import { analyzeIdea, generateHooks, generateScenes, generateStory } from './engine';
import { withPrompts } from './prompts';
import type { Reel, ReelSettings } from './types';

export const DEMO_IDEA = 'Девушка садится в машину, закрывает дверь и оказывается в мире динозавров.';

/** The demo project is produced by the same engine the user runs — not hand-written output. */
export function buildDemoReel(): Reel {
  const settings: ReelSettings = { duration: 15, format: '9:16', style: 'cinematic' };
  const analysis = analyzeIdea(DEMO_IDEA, settings);
  const hooks = generateHooks(DEMO_IDEA, settings);
  const hook = hooks.find((h) => h.type === 'curiosity')!;
  const story = generateStory(DEMO_IDEA, settings, hook);
  const { continuity, scenes } = generateScenes(DEMO_IDEA, settings, hook, story);
  return { id: 'demo', idea: DEMO_IDEA, settings, analysis, hooks, selectedHookId: hook.id, story, continuity, scenes: withPrompts(scenes, settings), boosts: [], version: 1, isDemo: true, createdAt: 0 };
}
