// Live end-to-end check against the configured real provider (reads .env). Prints results, never the key.
import { AIService } from '../server/ai/AIService';
import { providerFromEnv, type AIProvider } from '../server/ai/providers';
import { DEMO_IDEA } from '../shared/demo';
import { withPrompts } from '../shared/prompts';
import type { AIResponse, ReelSettings, Scene } from '../shared/types';
import { isExactTimeline } from '../shared/util';

try {
  process.loadEnvFile?.('.env');
} catch {
  // .env is optional when the variables come from the environment
}

const inner = providerFromEnv(process.env);
if (!inner) {
  console.error('No API key configured (GEMINI_API_KEY or OPENAI_API_KEY) — nothing to check.');
  process.exit(2);
}
let requests = 0;
const provider: AIProvider = { ...inner, completeJSON: (s, u, f) => (requests++, inner.completeJSON(s, u, f)) };
const ai = new AIService(provider);
const CYR = /[а-яё]/i;
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, info?: string) => {
  results.push([name, ok, info]);
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ` — ${info}` : ''}`);
};
const real = <T>(r: AIResponse<T>, step: string) => {
  // A notice in real mode means part of the step (e.g. prompt localization) fell back.
  const ok = r.mode === inner.id && !r.notice;
  check(`${step}: answered by ${inner.id}`, ok, ok ? undefined : r.notice);
  return r.data;
};

console.log(`Provider: ${inner.id}, model: ${inner.model}`);
const settings: ReelSettings = { duration: 15, format: '9:16', style: 'cinematic', language: 'ru', promptLanguage: 'en' };
const idea = process.argv[2] ?? DEMO_IDEA;

const analysis = real(await ai.run('analyze', { idea, settings }), 'analysis');
check('analysis in Russian', CYR.test(analysis.concept) && CYR.test(analysis.conflict), `оценка ${analysis.score}/10, «${analysis.concept.slice(0, 80)}»`);

const hooks = real(await ai.run('hooks', { idea, settings, analysis }), 'hooks');
check('5 distinct Russian hooks', hooks.length === 5 && new Set(hooks.map((h) => h.hook)).size === 5 && hooks.every((h) => CYR.test(h.hook)), `«${hooks[0].hook.slice(0, 80)}»`);

const story = real(await ai.run('story', { idea, settings, analysis, hook: hooks[0] }), 'story');
check('story in Russian, exact duration', CYR.test(story.emotionalArc) && isExactTimeline(story.beats, settings.duration), story.beats.map((b) => `${b.beat} ${b.start}-${b.end}`).join(', '));

const bundle = real(await ai.run('scenes', { idea, settings, analysis, hook: hooks[0], story }), 'scenes');
const scenes = withPrompts(bundle.scenes, settings);
check('scenes: Russian voiceover / on-screen text', scenes.every((s) => CYR.test(s.action)) && scenes.some((s) => CYR.test(s.voiceover) || CYR.test(s.onScreenText)));
check('scenes: sum(duration) === 15', isExactTimeline(scenes, settings.duration), scenes.map((s) => `${s.start}-${s.end}`).join(', '));
check('image/video prompts in English, non-empty', scenes.every((s) => s.imagePrompt.length > 200 && s.videoPrompt.length > 200 && !CYR.test(s.imagePrompt) && !CYR.test(s.videoPrompt)));
check('CONTINUITY_STATE kept (character, wardrobe)', scenes.every((s) => s.continuity.character === bundle.continuity.character && s.continuity.wardrobe === bundle.continuity.wardrobe));

const ruSettings: ReelSettings = { ...settings, promptLanguage: 'ru' };
// Drop any existing Russian layer so the model really writes the Russian prompts.
const enOnly = scenes.map(({ ru: _ru, ...s }) => s) as Scene[];
const ru = real(await ai.run('prompts', { idea, settings: ruSettings, scenes: enOnly }), 'prompts (ru)');
const ruScenes = withPrompts(ru, ruSettings);
check('promptLanguage = ru → Russian prompts', ruScenes.every((s) => s.ru && CYR.test(s.ru.imagePrompt) && CYR.test(s.ru.videoPrompt)));

const stronger = real(await ai.run('stronger', { idea, settings, hook: hooks[0], story, scenes: scenes as Scene[], boosts: [] }), 'make it stronger');
check('MAKE IT STRONGER: improvements in Russian, exact duration', stronger.improvements.length > 0 && stronger.improvements.every((i) => CYR.test(i.why)) && isExactTimeline(stronger.scenes, settings.duration), stronger.improvements.map((i) => i.label).join(', '));

const fallback = await new AIService(null).run('analyze', { idea, settings });
check('no key → Demo Mode fallback', fallback.mode === 'demo');

const failed = results.filter((r) => !r[1]).length;
console.log(`\nRequests to ${inner.id}: ${requests}. Checks: ${results.length - failed}/${results.length} passed.`);
process.exit(failed ? 1 : 0);
