import { describe, expect, it } from 'vitest';
import { analyzeProduct, continueStory, generateAngles, generateScript, generateSocial, makeViral, PRODUCT_LOCK_PHRASE, SCENE_COUNT } from '../shared/engine';
import { buildDemoProject, DEMO_PRODUCT, DEMO_SETTINGS } from '../shared/demo';
import { projectToJSON } from '../shared/export';
import { DURATIONS } from '../shared/options';
import { totalDuration } from '../shared/util';
import { AIService } from '../server/ai/AIService';

const analysis = analyzeProduct(DEMO_PRODUCT);
const angles = generateAngles(DEMO_PRODUCT, analysis);

describe('demo engine', () => {
  it('flags risky claims and keeps them out of generated text', () => {
    expect(analysis.risks.some((r) => r.phrase.includes('100'))).toBe(true);
    const d = buildDemoProject();
    const all = JSON.stringify({ scenes: d.scenes, social: d.social, angles: d.angles });
    expect(all).not.toMatch(/100\s*%|с первой ночи/);
    expect(analysis.rules.join(' ')).toMatch(/лекарств/);
  });

  it('creates exactly 5 angles in the required order', () => {
    expect(angles.map((a) => a.type)).toEqual(['pain', 'result', 'emotion', 'humor', 'expert']);
  });

  it.each(DURATIONS)('script for %ss matches duration and scene count for every angle', (duration) => {
    for (const angle of angles) {
      const scenes = generateScript({ product: DEMO_PRODUCT, analysis, angle, settings: { ...DEMO_SETTINGS, duration } });
      expect(scenes).toHaveLength(SCENE_COUNT[duration]);
      expect(totalDuration(scenes)).toBe(duration);
      expect(scenes[0].goal).toBe('HOOK');
      expect(scenes.at(-1)!.goal).toBe('CTA');
    }
  });

  it('product-visible prompts carry the product lock and avoid vague words', () => {
    const scenes = generateScript({ product: DEMO_PRODUCT, analysis, angle: angles[1], settings: DEMO_SETTINGS });
    for (const s of scenes) {
      expect(s.imagePrompt.toLowerCase()).not.toMatch(/viral|amazing/);
      if (!s.imagePrompt.includes('not shown')) expect(s.imagePrompt.toLowerCase()).toContain(PRODUCT_LOCK_PHRASE);
      expect(s.videoPrompt).toMatch(/Camera movement:.*\n[\s\S]*Ending frame:/);
    }
  });

  it('make viral keeps total duration and reports changes', () => {
    const ctx = { product: DEMO_PRODUCT, analysis, angle: angles[0], settings: DEMO_SETTINGS };
    const scenes = generateScript(ctx);
    const v = makeViral(ctx, scenes);
    expect(totalDuration(v.scenes)).toBe(totalDuration(scenes));
    expect(v.changes.map((c) => c.area)).toEqual(expect.arrayContaining(['Hook', 'Первые 1–3 секунды', 'Визуальный конфликт', 'Curiosity gap', 'Pacing', 'Эмоциональная динамика', 'CTA']));
    expect(scenes[0].onScreenText).not.toBe(v.scenes[0].onScreenText);
  });

  it('continue story starts from the previous ending frame', () => {
    const ctx = { product: DEMO_PRODUCT, analysis, angle: angles[0], settings: DEMO_SETTINGS };
    const scenes = generateScript(ctx);
    const next = continueStory(ctx, scenes);
    expect(next.videoPrompt).toContain(scenes.at(-1)!.endingFrame);
    expect(next.videoPrompt).toMatch(/Continuity with scene/);
  });

  it('social package has 10-15 hashtags and 3 variations', () => {
    const s = generateSocial({ product: DEMO_PRODUCT, analysis, angle: angles[0], settings: DEMO_SETTINGS });
    expect(s.hashtags.length).toBeGreaterThanOrEqual(10);
    expect(s.hashtags.length).toBeLessThanOrEqual(15);
    expect(s.variations.map((v) => v.id)).toEqual(['A', 'B', 'C']);
  });

  it('json export contains the required keys', () => {
    const json = projectToJSON(buildDemoProject());
    for (const k of ['product', 'audience', 'concept', 'hook', 'scenes', 'voiceover', 'image_prompts', 'video_prompts', 'caption', 'hashtags', 'cta']) expect(json).toHaveProperty(k);
  });
});

describe('AIService', () => {
  it('falls back to demo mode without a provider', async () => {
    const r = await new AIService(null).run('analyze', { product: DEMO_PRODUCT });
    expect(r.mode).toBe('demo');
    expect(r.notice).toBe('AI API не подключен. Используется демонстрационный режим.');
  });

  it('normalizes model output and enforces product lock + duration', async () => {
    const fake = { id: 'openai' as const, model: 'fake', completeJSON: async () => JSON.stringify({ scenes: [{ goal: 'hook', duration: 5, imagePrompt: 'a', videoPrompt: 'b' }, { goal: 'cta', duration: 5 }] }) };
    const ctx = { product: DEMO_PRODUCT, analysis, angle: angles[0], settings: { ...DEMO_SETTINGS, duration: 15 as const } };
    const r = await new AIService(fake).run('script', { ctx });
    expect(r.mode).toBe('openai');
    expect(totalDuration(r.data)).toBe(15);
    expect(r.data[0].imagePrompt.toLowerCase()).toContain(PRODUCT_LOCK_PHRASE);
  });

  it('reports provider errors and falls back honestly', async () => {
    const broken = { id: 'gemini' as const, model: 'x', completeJSON: async () => { throw new Error('HTTP 401'); } };
    const r = await new AIService(broken).run('analyze', { product: DEMO_PRODUCT });
    expect(r.mode).toBe('demo');
    expect(r.notice).toMatch(/HTTP 401/);
  });
});

describe('compliance', () => {
  it('detects Cyrillic risky words in full', async () => {
    const { detectRisks } = await import('../shared/compliance');
    const r = detectRisks('Гарантированно лучший в мире органайзер №1, лечит навсегда', 'test');
    expect(r.map((x) => x.phrase)).toEqual(expect.arrayContaining(['Гарантированно', 'лучший в мире', 'навсегда', 'лечит']));
  });

  it('does not flag harmless words containing risky stems', async () => {
    const { detectRisks } = await import('../shared/compliance');
    expect(detectRisks('Улучшает комфорт, не излечение, а уход', 'test').map((x) => x.phrase)).toEqual(['излечение']);
    expect(detectRisks('Улучшает комфорт и облегчает уход', 'test')).toEqual([]);
  });
});

describe('gemini provider', () => {
  it('falls back to the next model when the primary is overloaded', async () => {
    const { geminiProvider } = await import('../server/ai/providers');
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url).match(/models\/([^:]+)/)![1]);
      if (calls.at(-1) === 'primary') return new Response('{"error":{"message":"high demand"}}', { status: 503 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const out = await geminiProvider('k', ['primary', 'backup']).completeJSON('s', 'u');
      expect(out).toBe('{"ok":true}');
      expect(calls).toEqual(['primary', 'primary', 'backup']);
    } finally {
      globalThis.fetch = orig;
    }
  }, 10_000);
});
