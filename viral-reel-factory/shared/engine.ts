// Offline story engine used in Demo Mode and as a fallback when an AI provider fails.
// Deterministic and rule-based: it parses the idea against a knowledge base (lexicon.ts / lexicon.ru.ts)
// and composes the reel from dramaturgy templates. This file owns structure, timing, scoring, continuity
// and the Make It Stronger edits; all wording comes from the language packs in ./narrative.
// A real model plugs in through server/ai/AIService.ts.
import { texts, type Core, type Ctx, type Strength, type Texts, type Weakness } from './narrative';
import { noDot } from './narrative/common';
import { parseIdea } from './parser';
import { evolve, withPrompts } from './prompts';
import type {
  BeatName,
  BoostArea,
  ContinuityState,
  Duration,
  Hook,
  HookType,
  IdeaAnalysis,
  Improvement,
  Lang,
  PromptLayer,
  Reel,
  ReelSettings,
  Scene,
  SceneBundle,
  Story,
  StoryBeat,
  StrongerResult,
} from './types';
import { uid } from './util';

const ctx = (idea: string, settings: Pick<ReelSettings, 'style'>): Ctx => ({ p: parseIdea(idea), style: settings.style });

// ───────── ANALYZE ─────────

export function analyzeIdea(idea: string, settings: ReelSettings): IdeaAnalysis {
  const x = ctx(idea, settings);
  const { p } = x;
  const T = texts(settings.language);
  const S: Strength[] = [];
  const W: Weakness[] = [];
  if (p.characterFound) S.push('hero');
  else W.push('noHero');
  if (p.locationFound) S.push('location');
  else W.push('noLocation');
  if (p.twist) S.push(p.worldFound ? 'surprise' : 'twist');
  else W.push('noSurprise');
  if (p.twist && !p.worldFound) W.push('notVisual');
  if (p.conflict) S.push('conflict');
  else W.push('noConflict');
  if (!p.emotion) W.push('noEmotion');
  if (p.words < 5) W.push('tooShort');

  let score = 1 + (p.characterFound ? 2 : 0) + (p.locationFound ? 1 : 0) + (p.twist ? 2 : 0) + (p.worldFound ? 1 : 0) + (p.conflict ? 2 : 0) + (p.emotion ? 1 : 0);
  if (p.words < 5) score -= 2;
  score = Math.max(1, Math.min(10, score));
  const verdict = score >= 8 && p.twist && p.conflict ? 'strong' : score >= 5 ? 'needs-work' : 'weak';

  return {
    ...T.analysis(x),
    score,
    verdict,
    strengths: S.map((code) => T.strength(code, x)),
    weaknesses: W.map((code) => T.weakness(code, x)),
    // The improved idea rewrites the user's own text, so it follows the language the idea is written in.
    improvedIdea: W.length ? texts(p.lang).improveIdea(p) : undefined,
  };
}

// ───────── HOOKS ─────────

export const HOOK_TYPES: HookType[] = ['curiosity', 'shock', 'emotional', 'visual', 'story'];

export function generateHooks(idea: string, settings: ReelSettings): Hook[] {
  const h = texts(settings.language).hooks(ctx(idea, settings));
  return HOOK_TYPES.map((type) => ({ id: `hook-${type}`, type, ...h[type] }));
}

// ───────── STORY ─────────

const STRUCTURES: Record<Duration, [BeatName, number][]> = {
  10: [['HOOK', 2], ['SETUP', 4], ['TURN', 7], ['PAYOFF', 10]],
  15: [['HOOK', 2], ['SETUP', 5], ['ESCALATION', 8], ['TURN', 11], ['PAYOFF', 15]],
  30: [['HOOK', 2], ['SETUP', 6], ['SETUP', 10], ['ESCALATION', 15], ['ESCALATION', 19], ['TURN', 24], ['PAYOFF', 30]],
  60: [['HOOK', 3], ['SETUP', 9], ['SETUP', 15], ['ESCALATION', 22], ['ESCALATION', 29], ['ESCALATION', 35], ['TURN', 42], ['TURN', 49], ['PAYOFF', 55], ['PAYOFF', 60]],
};

const TEMPO: Record<BeatName, StoryBeat['tempo']> = { 'COLD OPEN': 'fast', HOOK: 'fast', SETUP: 'steady', ESCALATION: 'pause', TURN: 'peak', PAYOFF: 'pause' };
/** Tempo of a repeated beat (second ESCALATION / TURN / PAYOFF shot). */
const TEMPO_VARIANT: Partial<Record<BeatName, StoryBeat['tempo']>> = { ESCALATION: 'fast', TURN: 'pause', PAYOFF: 'fast' };

export function generateStory(idea: string, settings: ReelSettings, hook: Hook): Story {
  const x = ctx(idea, settings);
  const { p } = x;
  const T = texts(settings.language);
  const comedy = settings.style === 'comedy';
  const plan = STRUCTURES[settings.duration];
  const hasEsc = plan.some(([b]) => b === 'ESCALATION');
  const seen: Partial<Record<BeatName, number>> = {};
  let start = 0;
  const beats: StoryBeat[] = plan.map(([beat, end]) => {
    const k = seen[beat] ?? 0;
    seen[beat] = k + 1;
    const variant = k > 0 && Boolean(TEMPO_VARIANT[beat]);
    const b: StoryBeat = { beat, start, end, description: T.story.beat(x, beat, k, hook, hasEsc), emotion: T.story.emotion(beat, comedy), tempo: variant ? TEMPO_VARIANT[beat]! : TEMPO[beat], pacing: T.story.pacing(beat, variant) };
    start = end;
    return b;
  });
  const turn = beats.find((b) => b.beat === 'TURN')!;
  const notes: string[] = [];
  if (hook.type === 'shock') notes.push(T.story.notes.shock);
  if (!hasEsc) notes.push(T.story.notes.noEsc);
  if (settings.duration >= 30) notes.push(T.story.notes.long(settings.duration));
  const additions: string[] = [];
  if (!p.twist) additions.push(T.story.twistAdded(x));
  if (!p.characterFound) additions.push(T.story.heroAdded(x));
  return {
    title: T.story.title(x),
    summary: T.story.summary(x),
    structureNote: notes.length ? notes.join(' ') : T.story.notes.classic,
    beats,
    emotionalArc: beats.map((b) => b.emotion.split(' — ')[0]).filter((e, i, a) => a.indexOf(e) === i).join(' → '),
    pacing: T.story.overview(beats[0].end, turn.start, beats[beats.length - 1].start),
    additions,
  };
}

// ───────── SCENES + CONTINUITY ─────────

type Phase = 'normal' | 'omen' | 'other' | 'after';

function phaseOf(beat: BeatName, hook: Hook): Phase {
  if (beat === 'COLD OPEN' || beat === 'TURN' || (beat === 'HOOK' && hook.type === 'shock')) return 'other';
  if (beat === 'ESCALATION') return 'omen';
  if (beat === 'PAYOFF') return 'after';
  return 'normal';
}

/** Each scene receives the previous scene's CONTINUITY_STATE and changes only what the story changes. */
function nextContinuity(prev: ContinuityState, base: ContinuityState, phase: Phase, x: Ctx, T: Texts): ContinuityState {
  const normal = { location: base.location, objects: base.objects, lighting: base.lighting, time: base.time, weather: base.weather, colorPalette: base.colorPalette };
  switch (phase) {
    case 'normal':
      return evolve(prev, normal);
    case 'omen':
      return evolve(prev, { ...normal, lighting: T.continuity.omenLighting(base.lighting, x) });
    case 'other':
      return evolve(prev, T.continuity.other(x));
    case 'after':
      return evolve(prev, { ...normal, objects: [...base.objects, T.continuity.artifact(x)] });
  }
}

/** Builds every scene in one language: narrative fields, image/video specs and the continuity chain. */
function buildLanguage(x: Ctx, T: Texts, hook: Hook, story: Story) {
  const hasEsc = story.beats.some((b) => b.beat === 'ESCALATION');
  const base = T.continuity.base(x);
  let cont = base;
  const seen: Partial<Record<BeatName, number>> = {};
  const shots = story.beats.map((beat, i): { core: Core; cont: ContinuityState } => {
    const k = seen[beat.beat] ?? 0;
    seen[beat.beat] = k + 1;
    cont = nextContinuity(cont, base, phaseOf(beat.beat, hook), x, T);
    return { core: T.scene(x, { beat, k, hook, cont, isLast: i === story.beats.length - 1, hasEsc }), cont };
  });
  return { base, shots };
}

const LAYER_LANGS: Lang[] = ['en', 'ru'];

export function generateScenes(idea: string, settings: ReelSettings, hook: Hook, story: Story): SceneBundle {
  const x = ctx(idea, settings);
  // Narrative comes from the reel's language; the English and Russian prompt layers are built side by side
  // from the same deterministic plan, so switching prompt language never changes the story.
  const built = Object.fromEntries(LAYER_LANGS.map((l) => [l, buildLanguage(x, texts(l), hook, story)])) as Record<Lang, ReturnType<typeof buildLanguage>>;
  const layer = (l: Lang, i: number): PromptLayer => ({ image: built[l].shots[i].core.image, video: built[l].shots[i].core.video, continuity: built[l].shots[i].cont, imagePrompt: '', videoPrompt: '' });
  const scenes = story.beats.map((beat, i): Scene => {
    const { image: _image, video: _video, ...narrative } = built[settings.language].shots[i].core;
    return { id: uid('scene'), beat: beat.beat, start: beat.start, end: beat.end, ...narrative, ...layer('en', i), ru: layer('ru', i) };
  });
  return { continuity: built.en.base, scenes };
}

// ───────── MAKE IT STRONGER ─────────

export const BOOST_AREAS: BoostArea[] = ['opening', 'curiosity', 'pacing', 'conflict', 'escalation', 'surprise', 'payoff'];
export const boostLabels = (lang: Lang) => texts(lang).stronger.labels;
/** English labels, kept for callers that predate language support. */
export const BOOST_LABELS = boostLabels('en');

export interface StrongerInput {
  idea: string;
  settings: ReelSettings;
  hook: Hook;
  story: Story;
  scenes: Scene[];
  boosts: BoostArea[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function retime(scenes: Scene[], durations: number[]) {
  let t = 0;
  scenes.forEach((s, i) => {
    s.start = t;
    t += durations[i];
    s.end = t;
  });
}

/** Applies a prompt-layer edit to every language layer the scene has, phrased by that layer's pack. */
function eachLayer(s: Scene, fn: (layer: PromptLayer, T: Texts) => void) {
  fn(s, texts('en'));
  if (s.ru) fn(s.ru, texts('ru'));
}
const layerIn = (s: Scene, lang: Lang): PromptLayer => (lang === 'ru' && s.ru ? s.ru : s);

/** Which strength areas the current version already covers (applied boosts or a hook that solves it). */
export function strengthChecklist(r: Pick<StrongerInput, 'hook' | 'boosts'>, lang: Lang = 'en'): { area: BoostArea; label: string; ok: boolean }[] {
  const labels = boostLabels(lang);
  return BOOST_AREAS.map((area) => ({ area, label: labels[area], ok: r.boosts.includes(area) || (area === 'opening' && r.hook.type === 'shock') }));
}

export function makeStronger(input: StrongerInput): StrongerResult {
  const lang = input.settings.language;
  const x = ctx(input.idea, input.settings);
  const T = texts(lang);
  const TS = T.stronger;
  const scenes = clone(input.scenes);
  const story = clone(input.story);
  const hook = clone(input.hook);
  const done = new Set(input.boosts);
  const out: Improvement[] = [];
  const add = (area: BoostArea, before: string, after: string) => out.push({ area, label: TS.labels[area], before, after, why: TS.why[area] });
  const durations = () => scenes.map((s) => s.end - s.start);
  const turnScene = () => scenes.find((s) => s.beat === 'TURN');

  // 1. First 1–2 seconds: a flash-forward cold open, unless the hook already opens on the turn image.
  const turn0 = turnScene();
  if (!done.has('opening') && hook.type !== 'shock' && turn0 && scenes[0].beat !== 'COLD OPEN') {
    const before = TS.openingBefore(scenes[0].end, scenes[0].visual);
    const d = durations();
    const setupIdx = scenes.map((s, i) => (s.beat === 'SETUP' ? i : -1)).filter((i) => i >= 0 && d[i] > 1);
    const from = setupIdx.length ? setupIdx.reduce((a, b) => (d[b] > d[a] ? b : a)) : d.indexOf(Math.max(...d));
    d[from] -= 1;
    const cold: Scene = { ...clone(turn0), id: uid('scene'), beat: 'COLD OPEN', ...TS.coldOpen(x), voiceover: T.none.vo };
    eachLayer(cold, (L, TL) => {
      Object.assign(L.image, TL.stronger.coldImage(x));
      Object.assign(L.video, TL.stronger.coldVideo);
    });
    scenes.unshift(cold);
    retime(scenes, [1, ...d]);
    story.beats.unshift({ beat: 'COLD OPEN', start: 0, end: 1, description: cold.visual, emotion: T.story.emotion('COLD OPEN', false), tempo: 'fast', pacing: T.story.pacing('COLD OPEN', false) });
    add('opening', before, TS.openingAfter(x));
  }

  // 2. Curiosity gap: the first caption asks a question and withholds the answer.
  if (!done.has('curiosity')) {
    const opener = scenes.find((s) => s.beat === 'HOOK') ?? scenes[0];
    const before = opener.onScreenText;
    opener.onScreenText = TS.caption(x, hook.type);
    hook.onScreenText = opener.onScreenText;
    add('curiosity', TS.onScreen(before), TS.onScreen(opener.onScreenText));
  }

  // 3. Pacing: compress setup/escalation, give the time to the turn and the payoff.
  if (!done.has('pacing')) {
    const before = TS.timeline(scenes);
    const d = durations();
    let freed = 0;
    scenes.forEach((s, i) => {
      if ((s.beat === 'SETUP' || s.beat === 'ESCALATION') && d[i] > 2) {
        d[i] -= 1;
        freed += 1;
      }
    });
    if (freed > 0) {
      d[scenes.findIndex((s) => s.beat === 'TURN')] += Math.ceil(freed / 2);
      d[scenes.length - 1] += Math.floor(freed / 2);
      retime(scenes, d);
    }
    scenes.filter((s) => s.beat === 'SETUP').forEach((s) => {
      eachLayer(s, (L, TL) => (L.video.transition = TL.stronger.setupTransition));
      s.camera += TS.setupCameraSuffix;
    });
    add('pacing', before, `${TS.timeline(scenes)}${freed ? '' : TS.pacingTight}`);
  }

  // 4. Conflict: the hero tries to undo it and fails — or, if the idea already had conflict, the stakes rise.
  const esc = [...scenes].reverse().find((s) => s.beat === 'ESCALATION') ?? [...scenes].reverse().find((s) => s.beat === 'SETUP');
  if (!done.has('conflict') && esc) {
    const before = esc.action;
    const c = TS.conflict(x);
    esc.action = `${noDot(esc.action)}. ${c.extra}`;
    eachLayer(esc, (L, TL) => (L.video.physicalInteraction = TL.stronger.conflictPhysical(x)));
    esc.purpose = c.purpose;
    add('conflict', before, esc.action);
  }

  // 5. Emotional escalation: the reaction grows in visible steps toward the turn.
  const turnA = turnScene();
  if (!done.has('escalation') && turnA) {
    const before = layerIn(turnA, lang).video.facialMovement;
    scenes.filter((s) => s.beat === 'ESCALATION').forEach((s, i) => {
      eachLayer(s, (L, TL) => (L.video.facialMovement = TL.stronger.escalationSteps[Math.min(i, 2)]));
      s.sound += TS.heartbeat;
    });
    eachLayer(turnA, (L, TL) => (L.video.facialMovement = TL.stronger.turnFacial));
    turnA.sound = TS.turnSound(x);
    add('escalation', TS.turnReaction(before), TS.turnReaction(layerIn(turnA, lang).video.facialMovement));
  }

  // 6. Visual surprise: reveal through scale.
  const turnB = turnScene();
  if (!done.has('surprise') && turnB) {
    const before = turnB.camera;
    turnB.camera = TS.surpriseCamera(x);
    eachLayer(turnB, (L, TL) => {
      const sp = TL.stronger.surpriseSpec(x);
      L.image.composition = sp.composition;
      L.image.cameraAngle = sp.cameraAngle;
      L.video.cameraMovement = sp.cameraMovement;
    });
    add('surprise', before, turnB.camera);
  }

  // 7. Payoff: a second twist and a seamless loop.
  if (!done.has('payoff')) {
    const last = scenes[scenes.length - 1];
    const before = last.action;
    last.action = `${noDot(last.action)}. ${TS.payoffAction(x)}`;
    eachLayer(last, (L, TL) => (L.video.endingFrame = TL.stronger.payoffEndingFrame));
    last.onScreenText = TS.payoffText;
    add('payoff', before, last.action);
  }

  // Keep story beats in sync with the re-timed scenes.
  story.beats = scenes.map((s, i) => ({ ...(story.beats[i] ?? story.beats[story.beats.length - 1]), beat: s.beat, start: s.start, end: s.end, description: s.action }));
  const t = turnScene();
  if (out.length && t) story.pacing = TS.storyPacing(scenes[0].beat === 'COLD OPEN', t.start);

  return { hook, story, scenes, improvements: out, message: out.length ? undefined : TS.message };
}

export const applyStronger = (reel: Reel, r: StrongerResult): Reel => ({
  ...reel,
  hooks: reel.hooks?.map((h) => (h.id === r.hook.id ? r.hook : h)),
  story: r.story,
  scenes: r.scenes,
  boosts: Array.from(new Set([...reel.boosts, ...r.improvements.map((i) => i.area)])),
  version: reel.version + 1,
});

/**
 * Re-renders an offline reel in another narrative language. The engine is deterministic, so replaying the
 * same idea, hook choice and applied boosts produces the same reel, phrased in `language`.
 */
export function rebuildReel(reel: Reel, language: Lang): Reel {
  const settings: ReelSettings = { ...reel.settings, language };
  const next: Reel = { ...reel, settings, analysis: undefined, hooks: undefined, story: undefined, continuity: undefined, scenes: undefined };
  if (!reel.analysis) return next;
  next.analysis = analyzeIdea(reel.idea, settings);
  if (!reel.hooks) return next;
  next.hooks = generateHooks(reel.idea, settings);
  const hook = next.hooks.find((h) => h.id === reel.selectedHookId);
  if (!hook || !reel.story) return next;
  next.story = generateStory(reel.idea, settings, hook);
  const bundle = generateScenes(reel.idea, settings, hook, next.story);
  next.continuity = bundle.continuity;
  next.scenes = withPrompts(bundle.scenes, settings);
  if (!reel.boosts.length || !reel.scenes) return next;
  const r = makeStronger({ idea: reel.idea, settings, hook, story: next.story, scenes: next.scenes, boosts: BOOST_AREAS.filter((a) => !reel.boosts.includes(a)) });
  return { ...applyStronger(next, { ...r, scenes: withPrompts(r.scenes, settings) }), boosts: reel.boosts, version: reel.version };
}
