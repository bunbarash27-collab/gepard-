import { describe, expect, it, vi } from 'vitest';
import { AIService } from '../server/ai/AIService';
import { DEFAULT_GEMINI_MODEL, geminiProvider, openAIProvider, providerFromEnv, type AIProvider } from '../server/ai/providers';
import { TASK_SCHEMAS, validateSchema } from '../server/ai/schemas';
import { DEMO_IDEA } from '../shared/demo';
import { analyzeIdea, generateHooks, generateScenes, generateStory } from '../shared/engine';
import { withPrompts } from '../shared/prompts';
import type { Duration, ReelSettings, Scene } from '../shared/types';
import { fitTimeline, isExactTimeline } from '../shared/util';
import { modelImage, modelVideo } from './fixtures';

const RU: ReelSettings = { duration: 15, format: '9:16', style: 'cinematic', language: 'ru', promptLanguage: 'en' };
const SECRET = 'AQ.test-secret-key-value';
const CYR = /[а-яё]/i;

const okGemini = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] }), { status: 200 });

function base(settings = RU) {
  const analysis = analyzeIdea(DEMO_IDEA, settings);
  const hook = generateHooks(DEMO_IDEA, settings)[0];
  const story = generateStory(DEMO_IDEA, settings, hook);
  return { analysis, hook, story, bundle: generateScenes(DEMO_IDEA, settings, hook, story) };
}

const ruScene = (i: number, start: number, end: number, beat = 'SETUP') => ({
  beat, start, end, purpose: `Задача сцены ${i}`, visual: 'Девушка за рулём, за окном туман', action: 'Она закрывает дверь', camera: 'Медленный наезд', lighting: 'Холодный свет приборной панели',
  sound: 'Щелчок замка', onScreenText: 'Она просто хотела домой', voiceover: 'Она просто хотела доехать домой.', image: modelImage(), video: modelVideo(),
});
const ruContinuity = { character: 'woman, 28, dark bob', location: 'parking lot', objects: ['car keys'], wardrobe: 'red coat', lighting: 'sodium streetlight', time: 'night', weather: 'light rain', cameraStyle: 'handheld', visualStyle: 'cinematic realism', colorPalette: 'teal and orange' };
const inputScenes = (user: string) => JSON.parse(user.slice(user.indexOf('INPUT:') + 6)).scenes as any[];

/** Fake provider that answers by task schema name and records calls. */
function scripted(answers: Partial<Record<string, (user: string) => unknown>>) {
  const calls: { system: string; user: string; format?: string }[] = [];
  const p: AIProvider = {
    id: 'gemini',
    model: 'fake',
    async completeJSON(system, user, format) {
      calls.push({ system, user, format: format?.name });
      const a = answers[format?.name ?? ''];
      if (!a) throw new Error(`unexpected ${format?.name}`);
      const out = a(user);
      return typeof out === 'string' ? out : JSON.stringify(out);
    },
  };
  return { p, calls };
}

describe('real provider configuration', () => {
  it('picks the provider from env and defaults to Demo Mode without a key', () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ GEMINI_API_KEY: '   ' })).toBeNull();
    const g = providerFromEnv({ GEMINI_API_KEY: SECRET })!;
    expect(g.id).toBe('gemini');
    expect(g.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(providerFromEnv({ GEMINI_API_KEY: SECRET, GEMINI_MODEL: 'gemini-3.5-flash' })!.model).toBe('gemini-3.5-flash');
    expect(providerFromEnv({ GEMINI_API_KEY: SECRET, AI_PROVIDER: 'demo' })).toBeNull();
    expect(providerFromEnv({ GEMINI_API_KEY: SECRET, OPENAI_API_KEY: 'sk-x', AI_PROVIDER: 'gemini' })!.id).toBe('gemini');
  });

  it('status never exposes the key', () => {
    const s = new AIService(providerFromEnv({ GEMINI_API_KEY: SECRET })).status();
    expect(s).toMatchObject({ mode: 'gemini', connected: true, model: DEFAULT_GEMINI_MODEL });
    expect(JSON.stringify(s)).not.toContain(SECRET);
    expect(new AIService(null).status()).toMatchObject({ mode: 'demo', connected: false });
  });

  it('calls Gemini generateContent with structured output and the key in a header', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => okGemini({ ok: true }));
    const out = await geminiProvider(SECRET, 'gemini-3.8-flash', { fetch: fetch as any }).completeJSON('sys', 'user', { name: 'analyze', schema: { type: 'object' } });
    expect(out).toBe('{"ok":true}'); // thought parts are dropped
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(url).not.toContain(SECRET);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(SECRET);
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseFormat).toEqual({ text: { mimeType: 'application/json', schema: { type: 'object' } } });
    expect(body.systemInstruction.parts[0].text).toBe('sys');
  });

  it('uses json_schema structured output for OpenAI', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] })));
    await openAIProvider('sk-x', 'gpt-4o-mini', undefined, { fetch: fetch as any }).completeJSON('s', 'u', { name: 'hooks', schema: { type: 'object' } });
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'hooks', schema: { type: 'object' }, strict: false } });
  });
});

describe('API errors', () => {
  it('retries transient errors (429/5xx) and then succeeds', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('{"error":{"message":"overloaded"}}', { status: 503 })).mockResolvedValueOnce(okGemini({ ok: 1 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await geminiProvider(SECRET, 'gemini-3.8-flash', { fetch, baseDelayMs: 0 }).completeJSON('s', 'u');
    warn.mockRestore();
    expect(out).toBe('{"ok":1}');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors and never leaks the key in the message', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: `API key not valid: ${SECRET}` } }), { status: 400 }));
    const err = await geminiProvider(SECRET, 'gemini-3.8-flash', { fetch, baseDelayMs: 0 }).completeJSON('s', 'u').catch((e) => e);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(err.message).toMatch(/HTTP 400: INVALID_ARGUMENT: API key not valid/);
    expect(err.message).not.toContain(SECRET);
  });

  it('gives up after the retry budget and falls back to Demo Mode with a Russian notice', async () => {
    const fetch = vi.fn(async () => new Response('{"error":{"message":"quota exceeded"}}', { status: 429 }));
    const ai = new AIService(geminiProvider(SECRET, 'gemini-3.8-flash', { fetch, baseDelayMs: 0 }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await ai.run('analyze', { idea: DEMO_IDEA, settings: RU });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(r.mode).toBe('demo');
    expect(r.notice).toMatch(/^AI-провайдер вернул ошибку \(HTTP 429: quota exceeded\)/);
    expect(errSpy).toHaveBeenCalled(); // the real error reaches the developer log
    expect(JSON.stringify([errSpy.mock.calls, warn.mock.calls].map(String))).not.toContain(SECRET);
    errSpy.mockRestore();
    warn.mockRestore();
  });
});

describe('malformed responses', () => {
  it('retries once on invalid JSON, then falls back', async () => {
    const { p, calls } = scripted({ analyze: () => 'not json {' });
    const r = await new AIService(p).run('analyze', { idea: DEMO_IDEA, settings: RU });
    expect(calls).toHaveLength(2);
    expect(r.mode).toBe('demo');
    expect(r.notice).toMatch(/Invalid JSON/);
  });

  it('rejects schema violations (wrong hook count) and accepts the corrected retry', async () => {
    let n = 0;
    const good = { hooks: ['curiosity', 'shock', 'emotional', 'visual', 'story'].map((type) => ({ type, hook: `Хук ${type}`, whyItWorks: 'Потому что', openingShot: 'Кадр', onScreenText: '' })) };
    const { p, calls } = scripted({ hooks: () => (n++ === 0 ? { hooks: good.hooks.slice(0, 2) } : good) });
    const r = await new AIService(p).run('hooks', { idea: DEMO_IDEA, settings: RU, analysis: analyzeIdea(DEMO_IDEA, RU) });
    expect(calls).toHaveLength(2);
    expect(r.mode).toBe('gemini');
    expect(r.data.map((h) => h.hook)).toEqual(good.hooks.map((h) => h.hook));
  });

  it('validates required, non-empty strings and types', () => {
    expect(validateSchema(TASK_SCHEMAS.analyze, { concept: '' })).toEqual(expect.arrayContaining(['$.concept: empty', '$.goal: missing']));
    expect(validateSchema(TASK_SCHEMAS.story, { beats: 'x' })).toContain('$.beats: expected array');
    const scene = { ...ruScene(1, 0, 5), image: { ...modelImage(), lens: '' } };
    expect(validateSchema(TASK_SCHEMAS.scenes, { continuity: ruContinuity, scenes: [scene] })).toEqual(['$.scenes[0].image.lens: empty']);
  });
});

describe('real AI pipeline: language, prompts, duration', () => {
  it('runs every step with Russian narrative and English prompts by default', async () => {
    const { analysis, hook, story } = base();
    const { p, calls } = scripted({
      analyze: () => ({ concept: 'Ролик о сломе реальности', mainCharacter: 'Девушка 28 лет', goal: 'Доехать домой', conflict: 'Мир вокруг меняется', surprise: 'Динозавр за окном', emotionalDirection: 'От скуки к ужасу', payoff: 'Она заводит мотор', score: 7, verdict: 'needs-work', strengths: ['Сильный визуал'], weaknesses: ['Нет ставки'], improvedIdea: 'Девушка опаздывает…' }),
      story: () => ({ title: 'Дверь', summary: 'Кратко', structureNote: 'Классика', emotionalArc: 'Скука → шок', pacing: 'Быстро', additions: [], beats: [['HOOK', 0, 3], ['SETUP', 3, 6], ['TURN', 6, 12], ['PAYOFF', 12, 15]].map(([beat, start, end]) => ({ beat, start, end, description: 'Описание', emotion: 'Тревога', tempo: 'fast', pacing: 'Резко' })) }),
      scenes: () => ({ continuity: ruContinuity, scenes: [ruScene(1, 0, 3, 'HOOK'), ruScene(2, 3, 6), ruScene(3, 6, 12, 'TURN'), ruScene(4, 12, 15, 'PAYOFF')] }),
    });
    const ai = new AIService(p);
    const a = await ai.run('analyze', { idea: DEMO_IDEA, settings: RU });
    expect(a.mode).toBe('gemini');
    expect(a.data.concept).toMatch(CYR);
    const s = await ai.run('story', { idea: DEMO_IDEA, settings: RU, analysis, hook });
    expect(s.data.beats.every((b) => CYR.test(b.description))).toBe(true);
    const sc = await ai.run('scenes', { idea: DEMO_IDEA, settings: RU, analysis, hook, story });
    expect(calls.map((c) => c.format)).toEqual(['analyze', 'story', 'scenes']); // no translation call for EN prompts
    expect(calls[0].system).toMatch(/Narrative language = Russian/);
    const scenes = withPrompts(sc.data.scenes, RU);
    expect(scenes[0].voiceover).toMatch(CYR);
    expect(scenes[0].onScreenText).toMatch(CYR);
    expect(scenes[3].continuity.wardrobe).toBe('red coat'); // CONTINUITY_STATE carried through every scene
    for (const x of scenes) {
      expect(x.imagePrompt).toMatch(/^Vertical 9:16 frame\./);
      expect(x.imagePrompt).not.toMatch(CYR);
      expect(x.videoPrompt.length).toBeGreaterThan(100);
      expect(x.videoPrompt).not.toMatch(CYR);
    }
  });

  it('generates Russian prompts when promptLanguage = ru, without touching the narrative', async () => {
    const { analysis, hook, story } = base();
    const settings: ReelSettings = { ...RU, promptLanguage: 'ru' };
    const { p, calls } = scripted({
      scenes: () => ({ continuity: ruContinuity, scenes: [ruScene(1, 0, 5, 'HOOK'), ruScene(2, 5, 15, 'PAYOFF')] }),
      prompts: (user) => ({ scenes: inputScenes(user).map((x) => ({ image: { ...x.image, subject: 'девушка за рулём в красном пальто' }, video: { ...x.video, cameraMovement: 'медленный наезд' }, continuity: { ...x.continuity, wardrobe: 'красное пальто' } })) }),
    });
    const r = await new AIService(p).run('scenes', { idea: DEMO_IDEA, settings, analysis, hook, story });
    expect(calls.map((c) => c.format)).toEqual(['scenes', 'prompts']);
    const scenes = withPrompts(r.data.scenes, settings);
    expect(scenes[0].ru!.imagePrompt).toMatch(/^Вертикальный кадр 9:16\. Девушка за рулём в красном пальто\./);
    expect(scenes[0].ru!.videoPrompt).toContain('медленный наезд');
    expect(scenes[0].voiceover).toBe('Она просто хотела доехать домой.');
    expect(scenes[0].imagePrompt).toMatch(/^Vertical/); // English layer kept for switching back
  });

  it('MAKE IT STRONGER through the model keeps the exact duration and localizes labels', async () => {
    const settings: ReelSettings = { ...RU, duration: 10 };
    const { hook, story, bundle } = base(settings);
    const { p } = scripted({
      stronger: () => ({
        hookOnScreenText: 'Не открывай эту дверь', summary: 'Сильнее', pacing: 'Быстрее',
        scenes: [ruScene(1, 0, 4, 'COLD OPEN'), ruScene(2, 4, 9, 'SETUP'), ruScene(3, 9, 14, 'TURN'), ruScene(4, 14, 20, 'PAYOFF')], // model overshoots to 20 s
        improvements: [{ area: 'curiosity', before: 'Было', after: 'Стало', why: 'Зритель ждёт ответа' }],
      }),
    });
    const r = await new AIService(p).run('stronger', { idea: DEMO_IDEA, settings, hook, story, scenes: bundle.scenes, boosts: [] });
    expect(r.mode).toBe('gemini');
    expect(isExactTimeline(r.data.scenes, 10)).toBe(true);
    expect(isExactTimeline(r.data.story.beats, 10)).toBe(true);
    expect(r.data.improvements[0].label).toBe('Разрыв любопытства');
  });

  it('fixes model timings so sum(scene.duration) === selected duration', async () => {
    for (const duration of [10, 15, 30, 60] as Duration[]) {
      const settings = { ...RU, duration };
      const { analysis, hook, story } = base(settings);
      const { p } = scripted({ scenes: () => ({ continuity: ruContinuity, scenes: [ruScene(1, 0, 7), ruScene(2, 7, 20), ruScene(3, 25, 90), ruScene(4, 90, 91)] }) });
      const r = await new AIService(p).run('scenes', { idea: DEMO_IDEA, settings, analysis, hook, story });
      const sum = r.data.scenes.reduce((a, s) => a + (s.end - s.start), 0);
      expect(sum).toBe(duration);
      expect(isExactTimeline(r.data.scenes, duration)).toBe(true);
      expect(r.data.scenes.every((s) => Number.isInteger(s.start) && s.end <= duration)).toBe(true);
    }
  });
});

describe('scene duration validation', () => {
  it('fitTimeline is exact, contiguous and proportional', () => {
    const items = [{ start: 0, end: 3 }, { start: 3, end: 3 }, { start: 5, end: 11 }];
    for (const total of [10, 15, 30, 60]) {
      const out = fitTimeline(items, total);
      expect(isExactTimeline(out, total)).toBe(true);
      expect(out.every((x) => x.end - x.start >= 1)).toBe(true);
    }
    const many = Array.from({ length: 14 }, (_, i) => ({ start: i, end: i + 1 }));
    expect(isExactTimeline(fitTimeline(many, 10), 10)).toBe(true);
    const exact = [{ start: 0, end: 4 }, { start: 4, end: 10 }];
    expect(fitTimeline(exact, 10)).toBe(exact);
  });

  it('Demo Mode output matches every duration, also after MAKE IT STRONGER', async () => {
    const ai = new AIService(null);
    for (const duration of [10, 15, 30, 60] as Duration[]) {
      const settings = { ...RU, duration };
      const { analysis, hook, story } = base(settings);
      const r = await ai.run('scenes', { idea: DEMO_IDEA, settings, analysis, hook, story });
      expect(r.mode).toBe('demo');
      expect(isExactTimeline(r.data.scenes, duration)).toBe(true);
      const st = await ai.run('stronger', { idea: DEMO_IDEA, settings, hook, story, scenes: r.data.scenes as Scene[], boosts: [] });
      expect(isExactTimeline(st.data.scenes, duration)).toBe(true);
    }
  });
});
