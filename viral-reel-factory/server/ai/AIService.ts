import { analyzeIdea, BOOST_AREAS, boostLabels, generateHooks, generateScenes, generateStory, makeStronger, type StrongerInput } from '../../shared/engine';
import { DEFAULT_LANGUAGE, DEFAULT_PROMPT_LANGUAGE, isLang, MESSAGES } from '../../shared/i18n';
import { texts } from '../../shared/narrative';
import { evolve } from '../../shared/prompts';
import type {
  AIResponse,
  AIStatus,
  AITask,
  BeatName,
  BoostArea,
  ContinuityState,
  Hook,
  HookType,
  IdeaAnalysis,
  Lang,
  ReelSettings,
  Scene,
  SceneBundle,
  Story,
  StoryBeat,
  StrongerResult,
} from '../../shared/types';
import { fitTimeline, isExactTimeline, stripVague, uid } from '../../shared/util';
import type { AIProvider } from './providers';
import { PROMPT_TRANSLATOR, systemPrompt, TASK_INSTRUCTIONS } from './prompts';
import { TASK_SCHEMAS, toWire, validateSchema } from './schemas';

interface Base { idea: string; settings: ReelSettings }
export interface TaskPayloads {
  analyze: Base;
  hooks: Base & { analysis: IdeaAnalysis };
  story: Base & { analysis: IdeaAnalysis; hook: Hook };
  scenes: Base & { analysis: IdeaAnalysis; hook: Hook; story: Story };
  stronger: StrongerInput;
  prompts: Base & { scenes: Scene[] };
}
export interface TaskResults {
  analyze: IdeaAnalysis;
  hooks: Hook[];
  story: Story;
  scenes: SceneBundle;
  stronger: StrongerResult;
  prompts: Scene[];
}

/** Server-log status line; the UI localizes the mode itself. */
export const DEMO_MESSAGE = 'Demo Mode: no AI API connected. Results come from the built-in offline story engine.';

const demo: { [K in AITask]: (p: TaskPayloads[K]) => TaskResults[K] } = {
  analyze: ({ idea, settings }) => analyzeIdea(idea, settings),
  hooks: ({ idea, settings }) => generateHooks(idea, settings),
  story: ({ idea, settings, hook }) => generateStory(idea, settings, hook),
  scenes: ({ idea, settings, hook, story }) => generateScenes(idea, settings, hook, story),
  stronger: (p) => makeStronger(p),
  // Offline scenes already carry the Russian layer; AI-written scenes cannot be translated without a model.
  prompts: ({ scenes }) => scenes,
};

const BEATS: BeatName[] = ['COLD OPEN', 'HOOK', 'SETUP', 'ESCALATION', 'TURN', 'PAYOFF'];
const HOOK_TYPES: HookType[] = ['curiosity', 'shock', 'emotional', 'visual', 'story'];
const AREAS = BOOST_AREAS;
const LOCKED: (keyof ContinuityState)[] = ['character', 'wardrobe', 'cameraStyle', 'visualStyle'];

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? stripVague(v.trim()) || fallback : fallback);
const strArr = (v: unknown, fallback: string[]) => (Array.isArray(v) && v.length ? v.map(String).map((s) => s.trim()).filter(Boolean) : fallback);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(String(v).toUpperCase() as T) ? (String(v).toUpperCase() as T) : list.includes(String(v).toLowerCase() as T) ? (String(v).toLowerCase() as T) : fallback);

function obj<T extends object>(raw: any, fallback: T): T {
  const out = { ...fallback } as any;
  for (const k of Object.keys(fallback)) out[k] = str(raw?.[k], (fallback as any)[k]);
  return out;
}

/** Image spec with the optional per-shot lighting the offline fallback does not carry. */
function imageSpec(raw: any, fallback: Scene['image']): Scene['image'] {
  const out = obj(raw, fallback);
  return typeof raw?.lighting === 'string' && raw.lighting.trim() ? { ...out, lighting: stripVague(raw.lighting.trim()) } : out;
}

/** Model output that is not valid JSON or does not match the task schema. */
export class MalformedOutputError extends Error {
  name = 'MalformedOutputError';
}

/** Attempts per task when the model returns malformed or schema-violating output. */
const OUTPUT_ATTEMPTS = 2;
const HOOK_SET: string[] = ['curiosity', 'shock', 'emotional', 'visual', 'story'];

function parseModelJSON(raw: string): any {
  try {
    return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
  } catch (err) {
    throw new MalformedOutputError(`Invalid JSON from model: ${(err as Error).message.slice(0, 120)}`);
  }
}

/** Final guard on every result: sum(scene durations) === selected duration, before anything is shown. */
function enforceDuration<K extends AITask>(task: K, data: TaskResults[K], total: number): TaskResults[K] {
  if (task === 'story') {
    const s = data as Story;
    return (isExactTimeline(s.beats, total) ? s : { ...s, beats: fitTimeline(s.beats, total) }) as TaskResults[K];
  }
  if (task === 'scenes') {
    const b = data as SceneBundle;
    return (isExactTimeline(b.scenes, total) ? b : { ...b, scenes: fitTimeline(b.scenes, total) }) as TaskResults[K];
  }
  if (task === 'stronger') {
    const r = data as StrongerResult;
    if (isExactTimeline(r.scenes, total) && isExactTimeline(r.story.beats, total)) return data;
    const scenes = fitTimeline(r.scenes, total);
    const beats = scenes.map((s, i) => ({ ...(r.story.beats[i] ?? r.story.beats[r.story.beats.length - 1]), start: s.start, end: s.end }));
    return { ...r, scenes, story: { ...r.story, beats } } as TaskResults[K];
  }
  return data;
}

function normalizeContinuity(raw: any, fallback: ContinuityState): ContinuityState {
  return { ...obj(raw, { ...fallback, objects: '' as any }), objects: strArr(raw?.objects, fallback.objects) };
}

/** Each scene inherits the previous scene's state; character, wardrobe and camera/visual style stay locked. */
function normalizeScenes(raw: unknown, fallback: Scene[], base: ContinuityState, total: number, lang: Lang): Scene[] {
  const none = texts(lang).none;
  if (!Array.isArray(raw) || !raw.length) throw new Error('Model returned no scenes');
  let cont = base;
  const scenes = raw.map((r: any, i: number): Scene => {
    const fb = fallback[Math.min(i, fallback.length - 1)];
    const changes: Partial<ContinuityState> = {};
    const ch = r?.continuityChanges ?? {};
    for (const k of Object.keys(ch) as (keyof ContinuityState)[]) {
      if (LOCKED.includes(k) || !(k in base)) continue;
      if (k === 'objects') changes.objects = strArr(ch.objects, cont.objects);
      else (changes as any)[k] = str(ch[k], cont[k] as string);
    }
    cont = evolve(cont, changes);
    return {
      id: uid('scene'),
      beat: oneOf(r?.beat, BEATS, fb.beat),
      start: num(r?.start, fb.start),
      end: num(r?.end, fb.end),
      purpose: str(r?.purpose, fb.purpose),
      visual: str(r?.visual, fb.visual),
      action: str(r?.action, fb.action),
      camera: str(r?.camera, fb.camera),
      lighting: str(r?.lighting, fb.lighting),
      sound: str(r?.sound, fb.sound),
      onScreenText: str(r?.onScreenText, none.text),
      voiceover: str(r?.voiceover, none.vo),
      image: imageSpec(r?.image, fb.image),
      video: obj(r?.video, fb.video),
      continuity: cont,
      imagePrompt: '',
      videoPrompt: '',
    };
  });
  return fitTimeline(scenes, total);
}

export class AIService {
  constructor(private provider: AIProvider | null) {}

  status(): AIStatus {
    if (!this.provider) return { mode: 'demo', connected: false, message: DEMO_MESSAGE };
    return { mode: this.provider.id, connected: true, model: this.provider.model, message: `Connected: ${this.provider.id === 'openai' ? 'OpenAI' : 'Google Gemini'} (${this.provider.model})` };
  }

  async run<K extends AITask>(task: K, payload: TaskPayloads[K]): Promise<AIResponse<TaskResults[K]>> {
    const lang = validate(task, payload);
    const msg = MESSAGES[lang];
    if (!this.provider) {
      const data = enforceDuration(task, demo[task](payload), payload.settings.duration);
      const missingRu = task === 'prompts' && (data as Scene[]).some((s) => !s.ru);
      return { data, mode: 'demo', notice: missingRu ? msg.ruUnavailable : msg.demo };
    }
    try {
      let data = enforceDuration(task, await this.runModel(task, payload), payload.settings.duration);
      let notice: string | undefined;
      // Prompt language is separate from narrative: build the Russian prompt layer when it is requested.
      const wantsRu = task === 'prompts' || ((task === 'scenes' || task === 'stronger') && payload.settings.promptLanguage === 'ru');
      if (wantsRu) {
        try {
          if (task === 'prompts') data = (await this.localize(data as Scene[])) as TaskResults[K];
          else if (task === 'scenes') data = { ...(data as SceneBundle), scenes: await this.localize((data as SceneBundle).scenes) } as TaskResults[K];
          else data = { ...(data as StrongerResult), scenes: await this.localize((data as StrongerResult).scenes) } as TaskResults[K];
        } catch (err) {
          console.error('[AIService] prompt localization failed:', err);
          notice = msg.ruUnavailable;
        }
      }
      return { data, mode: this.provider.id, notice };
    } catch (err) {
      console.error(`[AIService] ${task} failed:`, err);
      return { data: enforceDuration(task, demo[task](payload), payload.settings.duration), mode: 'demo', notice: msg.providerFailed((err as Error).message.slice(0, 120)) };
    }
  }

  private async localize(scenes: Scene[]): Promise<Scene[]> {
    if (scenes.every((s) => s.ru)) return scenes;
    const input = { scenes: scenes.map((s) => ({ image: s.image, video: s.video, continuity: s.continuity })) };
    const r = await this.askJSON('prompts', PROMPT_TRANSLATOR, `${TASK_INSTRUCTIONS.prompts}\n\nINPUT:\n${JSON.stringify(input, null, 2)}`, (d) =>
      d.scenes.length === scenes.length ? [] : [`expected ${scenes.length} scenes, got ${d.scenes.length}`],
    );
    return scenes.map((s, i) => ({
      ...s,
      ru: { image: imageSpec(r.scenes[i]?.image, s.image), video: obj(r.scenes[i]?.video, s.video), continuity: normalizeContinuity(r.scenes[i]?.continuity, s.continuity), imagePrompt: '', videoPrompt: '' },
    }));
  }

  private async ask(task: AITask, input: { settings: ReelSettings } & Record<string, unknown>): Promise<any> {
    const user = `${TASK_INSTRUCTIONS[task]}\n\nINPUT:\n${JSON.stringify(input, null, 2)}`;
    const check = task === 'hooks' ? (d: any) => (HOOK_SET.every((t) => d.hooks.some((h: any) => String(h.type).toLowerCase() === t)) ? [] : ['hooks must contain each type exactly once']) : undefined;
    return this.askJSON(task, systemPrompt(input.settings.language), user, check);
  }

  /** Structured-output request: schema-constrained, validated, retried once on malformed output. */
  private async askJSON(task: AITask, system: string, user: string, check?: (data: any) => string[]): Promise<any> {
    const schema = TASK_SCHEMAS[task];
    let last: Error = new MalformedOutputError('No output');
    for (let attempt = 1; attempt <= OUTPUT_ATTEMPTS; attempt++) {
      const raw = await this.provider!.completeJSON(system, user, { name: task, schema: toWire(schema) });
      try {
        const data = parseModelJSON(raw);
        const errors = validateSchema(schema, data);
        if (!errors.length && check) errors.push(...check(data));
        if (errors.length) throw new MalformedOutputError(`Model output does not match the ${task} schema: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`);
        return data;
      } catch (err) {
        if (!(err instanceof MalformedOutputError)) throw err;
        last = err;
        console.warn(`[AIService] ${task}: ${err.message} (attempt ${attempt}/${OUTPUT_ATTEMPTS})`);
      }
    }
    throw last;
  }

  private async runModel<K extends AITask>(task: K, payload: TaskPayloads[K]): Promise<TaskResults[K]> {
    const fb = demo[task](payload) as any;
    const { idea, settings } = payload;
    const lang = settings.language;
    switch (task) {
      case 'analyze': {
        const r = await this.ask(task, { idea, settings });
        const d = fb as IdeaAnalysis;
        const weaknesses = strArr(r.weaknesses, []);
        return {
          ...obj(r, { concept: d.concept, mainCharacter: d.mainCharacter, goal: d.goal, conflict: d.conflict, surprise: d.surprise, emotionalDirection: d.emotionalDirection, payoff: d.payoff }),
          score: Math.max(1, Math.min(10, Math.round(num(r.score, d.score)))),
          verdict: oneOf(r.verdict, ['strong', 'needs-work', 'weak'] as const, d.verdict),
          strengths: strArr(r.strengths, []),
          weaknesses,
          improvedIdea: weaknesses.length ? str(r.improvedIdea, d.improvedIdea ?? '') || undefined : undefined,
        } as TaskResults[K];
      }
      case 'hooks': {
        const r = await this.ask(task, { idea, settings, analysis: (payload as TaskPayloads['hooks']).analysis });
        const list: any[] = Array.isArray(r.hooks) ? r.hooks : [];
        // Always exactly one hook per type, in a stable order.
        return (fb as Hook[]).map((d) => {
          const m = list.find((x) => String(x?.type).toLowerCase() === d.type) ?? {};
          return { id: d.id, type: d.type, hook: str(m.hook, d.hook), whyItWorks: str(m.whyItWorks, d.whyItWorks), openingShot: str(m.openingShot, d.openingShot), onScreenText: typeof m.onScreenText === 'string' ? m.onScreenText.trim() : d.onScreenText };
        }) as TaskResults[K];
      }
      case 'story': {
        const { analysis, hook } = payload as TaskPayloads['story'];
        const r = await this.ask(task, { idea, settings, analysis, hook });
        const d = fb as Story;
        const raw: any[] = Array.isArray(r.beats) && r.beats.length >= 3 ? r.beats : d.beats;
        const beats = fitTimeline(raw.map((b: any, i: number): StoryBeat => {
          const f = d.beats[Math.min(i, d.beats.length - 1)];
          return { beat: oneOf(b?.beat, BEATS, f.beat), start: num(b?.start, f.start), end: num(b?.end, f.end), description: str(b?.description, f.description), emotion: str(b?.emotion, f.emotion), tempo: oneOf(b?.tempo, ['fast', 'pause', 'peak', 'steady'] as const, f.tempo), pacing: str(b?.pacing, f.pacing) };
        }), settings.duration);
        return { ...obj(r, { title: d.title, summary: d.summary, structureNote: d.structureNote, emotionalArc: d.emotionalArc, pacing: d.pacing }), beats, additions: strArr(r.additions, []) } as TaskResults[K];
      }
      case 'scenes': {
        const { analysis, hook, story } = payload as TaskPayloads['scenes'];
        const r = await this.ask(task, { idea, settings, analysis, hook, story });
        const d = fb as SceneBundle;
        const continuity = normalizeContinuity(r.continuity, d.continuity);
        return { continuity, scenes: normalizeScenes(r.scenes, d.scenes, continuity, settings.duration, lang) } as TaskResults[K];
      }
      case 'stronger': {
        const p = payload as TaskPayloads['stronger'];
        const r = await this.ask(task, { idea, settings, hook: p.hook, story: p.story, scenes: p.scenes.map(({ imagePrompt, videoPrompt, continuity, ...s }) => s), 'areas already improved': p.boosts, continuity: p.scenes[0]?.continuity });
        const total = settings.duration;
        const scenes = normalizeScenes(r.scenes, p.scenes, p.scenes[0].continuity, total, lang);
        const improvements = (Array.isArray(r.improvements) ? r.improvements : [])
          .map((x: any) => ({ area: oneOf(x?.area, AREAS, 'pacing'), before: str(x?.before, '—'), after: str(x?.after, '—'), why: str(x?.why, '') }))
          .map((x: any) => ({ ...x, label: boostLabels(lang)[x.area as BoostArea] }));
        const story: Story = { ...p.story, summary: str(r.summary, p.story.summary), pacing: str(r.pacing, p.story.pacing), beats: scenes.map((s, i) => ({ ...(p.story.beats[i] ?? p.story.beats[p.story.beats.length - 1]), beat: s.beat, start: s.start, end: s.end, description: s.action })) };
        return { hook: { ...p.hook, onScreenText: str(r.hookOnScreenText, p.hook.onScreenText) }, story, scenes, improvements, message: improvements.length ? undefined : texts(lang).stronger.message } as TaskResults[K];
      }
      case 'prompts':
        // Translation itself happens in run(); here the scenes pass through unchanged.
        return (payload as TaskPayloads['prompts']).scenes as TaskResults[K];
    }
    throw new Error(`Unknown task ${task}`);
  }
}

/** Validates the payload, fills language defaults (ru / en) and returns the language for messages. */
function validate(task: AITask, p: any): Lang {
  const settings = p?.settings;
  const lang: Lang = isLang(settings?.language) ? settings.language : DEFAULT_LANGUAGE;
  const msg = MESSAGES[lang];
  if (typeof p?.idea !== 'string' || !p.idea.trim()) throw new Error(msg.ideaRequired);
  if (p.idea.length > 2000) throw new Error(msg.ideaTooLong);
  if (p.idea.trim().split(/\s+/).length < 2) throw new Error(msg.notEnough);
  if (![10, 15, 30, 60].includes(settings?.duration) || !['cinematic', 'ugc', 'commercial', 'comedy', 'realistic'].includes(settings?.style)) throw new Error(msg.invalidSettings);
  settings.language = lang;
  settings.promptLanguage = isLang(settings.promptLanguage) ? settings.promptLanguage : DEFAULT_PROMPT_LANGUAGE;
  settings.format = '9:16';
  if (task !== 'analyze' && task !== 'hooks' && task !== 'prompts' && !p.hook) throw new Error(msg.hookRequired);
  if ((task === 'scenes' || task === 'stronger') && !Array.isArray(p.story?.beats)) throw new Error(msg.storyRequired);
  if ((task === 'stronger' || task === 'prompts') && (!Array.isArray(p.scenes) || !p.scenes.length)) throw new Error(msg.scenesRequired);
  if (task === 'stronger' && !Array.isArray(p.boosts)) p.boosts = [];
  return lang;
}
