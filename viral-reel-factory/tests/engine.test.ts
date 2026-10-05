import { describe, expect, it } from 'vitest';
import { AIService } from '../server/ai/AIService';
import type { AIProvider } from '../server/ai/providers';
import { buildDemoReel, DEMO_IDEA } from '../shared/demo';
import { analyzeIdea, applyStronger, generateHooks, generateScenes, generateStory, makeStronger } from '../shared/engine';
import { parseIdea } from '../shared/parser';
import { withPrompts } from '../shared/prompts';
import type { Duration, Reel, ReelSettings } from '../shared/types';
import { findVaguePhrases } from '../shared/util';

const S: ReelSettings = { duration: 15, format: '9:16', style: 'cinematic' };

function build(idea: string, settings = S, hookType = 'curiosity') {
  const analysis = analyzeIdea(idea, settings);
  const hooks = generateHooks(idea, settings);
  const hook = hooks.find((h) => h.type === hookType)!;
  const story = generateStory(idea, settings, hook);
  const bundle = generateScenes(idea, settings, hook, story);
  return { analysis, hooks, hook, story, ...bundle, scenes: withPrompts(bundle.scenes, settings) };
}

describe('idea parser', () => {
  it('understands the demo idea', () => {
    const p = parseIdea(DEMO_IDEA);
    expect(p.character.key).toBe('young-woman');
    expect(p.location.key).toBe('car');
    expect(p.world.key).toBe('dinosaurs');
    expect(p.twist).toBe(true);
    expect(p.trigger).toContain('door');
  });

  it('does not mistake common Russian words for characters', () => {
    expect(parseIdea('Человек, который всё время опаздывает').character.key).not.toBe('cat');
  });
});

describe('analysis', () => {
  it('does not blindly agree: the demo idea lacks conflict', () => {
    const a = analyzeIdea(DEMO_IDEA, S);
    expect(a.verdict).toBe('needs-work');
    expect(a.weaknesses.join(' ')).toMatch(/No conflict/);
    expect(a.improvedIdea).toBeTruthy();
    expect(a.improvedIdea).toMatch(/вернуться/);
  });

  it('calls a flat idea weak and proposes a twist', () => {
    const a = analyzeIdea('кот спит', S);
    expect(a.verdict).toBe('weak');
    expect(a.weaknesses.join(' ')).toMatch(/No surprise/);
    expect(a.improvedIdea).toMatch(/^Кот спит, но/);
  });

  it('rates a complete idea as strong', () => {
    const a = analyzeIdea('A tired man gets into the elevator, tries to get to work but is late, and suddenly finds himself in space, scared', S);
    expect(a.verdict).toBe('strong');
    expect(a.improvedIdea).toBeUndefined();
  });
});

describe('hooks', () => {
  it('returns 5 hooks of 5 different types with distinct text', () => {
    const hooks = generateHooks(DEMO_IDEA, S);
    expect(hooks.map((h) => h.type)).toEqual(['curiosity', 'shock', 'emotional', 'visual', 'story']);
    expect(new Set(hooks.map((h) => h.hook)).size).toBe(5);
    hooks.forEach((h) => expect(h.whyItWorks.length).toBeGreaterThan(40));
  });
});

describe('story + scenes', () => {
  it.each([10, 15, 30, 60] as Duration[])('covers exactly %i seconds without gaps', (duration) => {
    const { story, scenes } = build(DEMO_IDEA, { ...S, duration });
    expect(story.beats[0].start).toBe(0);
    expect(scenes[scenes.length - 1].end).toBe(duration);
    scenes.forEach((s, i) => i > 0 && expect(s.start).toBe(scenes[i - 1].end));
    expect(scenes.map((s) => s.beat)).toContain('TURN');
  });

  it('passes CONTINUITY_STATE into every scene and prompt', () => {
    const { scenes, continuity } = build(DEMO_IDEA);
    for (const s of scenes) {
      expect(s.continuity.character).toBe(continuity.character);
      expect(s.continuity.wardrobe).toBe(continuity.wardrobe);
      expect(s.imagePrompt).toContain(continuity.wardrobe);
      expect(s.videoPrompt).toContain(continuity.wardrobe);
    }
    const turn = scenes.find((s) => s.beat === 'TURN')!;
    expect(turn.continuity.location).toMatch(/Cretaceous jungle/);
    expect(scenes[scenes.length - 1].continuity.objects.join(' ')).toMatch(/fern frond/);
  });

  it('image prompts cover every required visual element and avoid empty phrases', () => {
    const { scenes } = build(DEMO_IDEA);
    for (const s of scenes) {
      for (const label of ['Character:', 'Clothing:', 'Environment:', 'Composition:', 'Camera angle:', 'Lens:', 'Lighting:', 'Depth of field:', 'Materials:', 'Textures:', 'Atmosphere:', 'Visual style:']) expect(s.imagePrompt).toContain(label);
      expect(s.imagePrompt).toMatch(/photorealistic/i);
      for (const label of ['Subject movement:', 'Camera movement:', 'Object movement:', 'Facial movement:', 'Environment movement:', 'Timing:', 'Transition:', 'Physical interaction:', 'Ending frame:']) expect(s.videoPrompt).toContain(label);
      expect(findVaguePhrases(s.imagePrompt + s.videoPrompt)).toEqual([]);
    }
  });
});

describe('MAKE IT STRONGER', () => {
  it('improves all 7 areas, keeps the duration and is idempotent', () => {
    const demo = buildDemoReel();
    const hook = demo.hooks!.find((h) => h.id === demo.selectedHookId)!;
    const r = makeStronger({ idea: demo.idea, settings: demo.settings, hook, story: demo.story!, scenes: demo.scenes!, boosts: [] });
    expect(r.improvements.map((i) => i.area).sort()).toEqual(['conflict', 'curiosity', 'escalation', 'opening', 'pacing', 'payoff', 'surprise']);
    expect(r.scenes[0].beat).toBe('COLD OPEN');
    expect(r.scenes[0].end).toBe(1);
    expect(r.scenes[r.scenes.length - 1].end).toBe(15);
    expect(r.story.beats.length).toBe(r.scenes.length);
    r.improvements.forEach((i) => expect(i.before).not.toBe(i.after));

    const next: Reel = applyStronger(demo, { ...r, scenes: withPrompts(r.scenes, demo.settings) });
    expect(next.version).toBe(2);
    const again = makeStronger({ idea: next.idea, settings: next.settings, hook: next.hooks!.find((h) => h.id === next.selectedHookId)!, story: next.story!, scenes: next.scenes!, boosts: next.boosts });
    expect(again.improvements).toEqual([]);
    expect(again.message).toBeTruthy();
  });

  it('skips the cold open when the hook already opens on the turn image', () => {
    const b = build(DEMO_IDEA, S, 'shock');
    const r = makeStronger({ idea: DEMO_IDEA, settings: S, hook: b.hook, story: b.story, scenes: b.scenes, boosts: [] });
    expect(r.improvements.map((i) => i.area)).not.toContain('opening');
  });
});

describe('AIService', () => {
  it('uses the offline engine when no provider is configured', async () => {
    const ai = new AIService(null);
    const r = await ai.run('analyze', { idea: DEMO_IDEA, settings: S });
    expect(r.mode).toBe('demo');
    expect(r.data.concept).toMatch(/dinosaurs/);
  });

  it('normalizes model output and keeps continuity locked', async () => {
    const fake: AIProvider = {
      id: 'openai',
      model: 'fake',
      async completeJSON(_s, user) {
        if (user.includes('TASK: Write 5')) return JSON.stringify({ hooks: [{ type: 'shock', hook: 'Model shock hook', whyItWorks: 'because', openingShot: 'x', onScreenText: '' }] });
        return JSON.stringify({
          continuity: { character: 'Model hero', wardrobe: 'red coat', location: 'garage', objects: ['cup'], lighting: 'neon', time: 'night', weather: 'rain', cameraStyle: 'handheld', visualStyle: 'gritty', colorPalette: 'red' },
          scenes: [
            { beat: 'hook', start: 0, end: 4, purpose: 'p1', image: { subject: 'make it viral, a woman' }, continuityChanges: { wardrobe: 'blue dress', lighting: 'daylight' } },
            { beat: 'TURN', start: 4, end: 9, purpose: 'p2' },
          ],
        });
      },
    };
    const ai = new AIService(fake);
    const hooks = await ai.run('hooks', { idea: DEMO_IDEA, settings: S, analysis: analyzeIdea(DEMO_IDEA, S) });
    expect(hooks.data).toHaveLength(5);
    expect(hooks.data.find((h) => h.type === 'shock')!.hook).toBe('Model shock hook');

    const b = build(DEMO_IDEA);
    const r = await ai.run('scenes', { idea: DEMO_IDEA, settings: S, analysis: b.analysis, hook: b.hook, story: b.story });
    expect(r.mode).toBe('openai');
    const [s1, s2] = r.data.scenes;
    expect(s1.beat).toBe('HOOK');
    expect(s2.end).toBe(15);
    expect(s1.continuity.wardrobe).toBe('red coat');
    expect(s1.continuity.lighting).toBe('daylight');
    expect(s2.continuity.lighting).toBe('daylight');
    expect(s1.image.subject).toBe('a woman');
  });

  it('falls back to the offline engine when the provider fails', async () => {
    const ai = new AIService({ id: 'gemini', model: 'x', completeJSON: async () => { throw new Error('quota'); } });
    const r = await ai.run('hooks', { idea: DEMO_IDEA, settings: S, analysis: analyzeIdea(DEMO_IDEA, S) });
    expect(r.mode).toBe('demo');
    expect(r.notice).toMatch(/quota/);
    expect(r.data).toHaveLength(5);
  });

  it('rejects invalid input', async () => {
    await expect(new AIService(null).run('analyze', { idea: ' ', settings: S })).rejects.toThrow(/Idea is required/);
  });
});
