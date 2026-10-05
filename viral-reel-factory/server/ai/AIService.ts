import { analyzeIdea, BOOST_LABELS, generateHooks, generateScenes, generateStory, makeStronger, type StrongerInput } from '../../shared/engine';
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
  ReelSettings,
  Scene,
  SceneBundle,
  Story,
  StoryBeat,
  StrongerResult,
} from '../../shared/types';
import { stripVague, uid } from '../../shared/util';
import type { AIProvider } from './providers';
import { SYSTEM_BASE, TASK_INSTRUCTIONS } from './prompts';

interface Base { idea: string; settings: ReelSettings }
export interface TaskPayloads {
  analyze: Base;
  hooks: Base & { analysis: IdeaAnalysis };
  story: Base & { analysis: IdeaAnalysis; hook: Hook };
  scenes: Base & { analysis: IdeaAnalysis; hook: Hook; story: Story };
  stronger: StrongerInput;
}
export interface TaskResults {
  analyze: IdeaAnalysis;
  hooks: Hook[];
  story: Story;
  scenes: SceneBundle;
  stronger: StrongerResult;
}

export const DEMO_MESSAGE = 'Demo Mode: no AI API connected. Results come from the built-in offline story engine.';

const demo: { [K in AITask]: (p: TaskPayloads[K]) => TaskResults[K] } = {
  analyze: ({ idea, settings }) => analyzeIdea(idea, settings),
  hooks: ({ idea, settings }) => generateHooks(idea, settings),
  story: ({ idea, settings, hook }) => generateStory(idea, settings, hook),
  scenes: ({ idea, settings, hook, story }) => generateScenes(idea, settings, hook, story),
  stronger: (p) => makeStronger(p),
};

const BEATS: BeatName[] = ['COLD OPEN', 'HOOK', 'SETUP', 'ESCALATION', 'TURN', 'PAYOFF'];
const HOOK_TYPES: HookType[] = ['curiosity', 'shock', 'emotional', 'visual', 'story'];
const AREAS = Object.keys(BOOST_LABELS) as BoostArea[];
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

/** Models rarely hit exact totals: rescale to [0, total] and keep integer-ish boundaries. */
function retimeTo<T extends { start: number; end: number }>(items: T[], total: number): T[] {
  const durs = items.map((x) => Math.max(0.5, num(x.end, 0) - num(x.start, 0)));
  const sum = durs.reduce((a, b) => a + b, 0);
  let t = 0;
  return items.map((x, i) => {
    const d = i === items.length - 1 ? total - t : Math.round(((durs[i] * total) / sum) * 2) / 2;
    const out = { ...x, start: t, end: Math.round((t + d) * 10) / 10 };
    t = out.end;
    return out;
  });
}

function normalizeContinuity(raw: any, fallback: ContinuityState): ContinuityState {
  return { ...obj(raw, { ...fallback, objects: '' as any }), objects: strArr(raw?.objects, fallback.objects) };
}

/** Each scene inherits the previous scene's state; character, wardrobe and camera/visual style stay locked. */
function normalizeScenes(raw: unknown, fallback: Scene[], base: ContinuityState, total: number): Scene[] {
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
      onScreenText: str(r?.onScreenText, '— (none)'),
      voiceover: str(r?.voiceover, '— (no voiceover)'),
      image: obj(r?.image, fb.image),
      video: obj(r?.video, fb.video),
      continuity: cont,
      imagePrompt: '',
      videoPrompt: '',
    };
  });
  return retimeTo(scenes, total);
}

export class AIService {
  constructor(private provider: AIProvider | null) {}

  status(): AIStatus {
    if (!this.provider) return { mode: 'demo', connected: false, message: DEMO_MESSAGE };
    return { mode: this.provider.id, connected: true, model: this.provider.model, message: `Connected: ${this.provider.id === 'openai' ? 'OpenAI' : 'Google Gemini'} (${this.provider.model})` };
  }

  async run<K extends AITask>(task: K, payload: TaskPayloads[K]): Promise<AIResponse<TaskResults[K]>> {
    validate(task, payload);
    if (!this.provider) return { data: demo[task](payload), mode: 'demo', notice: DEMO_MESSAGE };
    try {
      return { data: await this.runModel(task, payload), mode: this.provider.id };
    } catch (err) {
      console.error(`[AIService] ${task} failed:`, err);
      return { data: demo[task](payload), mode: 'demo', notice: `The AI provider failed (${(err as Error).message.slice(0, 120)}). Showing the offline engine result instead.` };
    }
  }

  private async ask(task: AITask, input: unknown): Promise<any> {
    const user = `${TASK_INSTRUCTIONS[task]}\n\nINPUT:\n${JSON.stringify(input, null, 2)}`;
    const raw = await this.provider!.completeJSON(SYSTEM_BASE, user);
    return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
  }

  private async runModel<K extends AITask>(task: K, payload: TaskPayloads[K]): Promise<TaskResults[K]> {
    const fb = demo[task](payload) as any;
    const { idea, settings } = payload;
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
        const beats = retimeTo(raw.map((b: any, i: number): StoryBeat => {
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
        return { continuity, scenes: normalizeScenes(r.scenes, d.scenes, continuity, settings.duration) } as TaskResults[K];
      }
      case 'stronger': {
        const p = payload as TaskPayloads['stronger'];
        const r = await this.ask(task, { idea, settings, hook: p.hook, story: p.story, scenes: p.scenes.map(({ imagePrompt, videoPrompt, continuity, ...s }) => s), 'areas already improved': p.boosts, continuity: p.scenes[0]?.continuity });
        const total = p.scenes.reduce((a, s) => Math.max(a, s.end), 0);
        const scenes = normalizeScenes(r.scenes, p.scenes, p.scenes[0].continuity, total);
        const improvements = (Array.isArray(r.improvements) ? r.improvements : [])
          .map((x: any) => ({ area: oneOf(x?.area, AREAS, 'pacing'), before: str(x?.before, '—'), after: str(x?.after, '—'), why: str(x?.why, '') }))
          .map((x: any) => ({ ...x, label: BOOST_LABELS[x.area as BoostArea] }));
        const story: Story = { ...p.story, summary: str(r.summary, p.story.summary), pacing: str(r.pacing, p.story.pacing), beats: scenes.map((s, i) => ({ ...(p.story.beats[i] ?? p.story.beats[p.story.beats.length - 1]), beat: s.beat, start: s.start, end: s.end, description: s.action })) };
        return { hook: { ...p.hook, onScreenText: str(r.hookOnScreenText, p.hook.onScreenText) }, story, scenes, improvements, message: improvements.length ? undefined : 'The model found nothing to improve.' } as TaskResults[K];
      }
    }
    throw new Error(`Unknown task ${task}`);
  }
}

function validate(task: AITask, p: any) {
  if (typeof p?.idea !== 'string' || !p.idea.trim()) throw new Error('Idea is required');
  if (p.idea.length > 2000) throw new Error('Idea is too long (max 2000 characters)');
  if (![10, 15, 30, 60].includes(p?.settings?.duration) || !['cinematic', 'ugc', 'commercial', 'comedy', 'realistic'].includes(p?.settings?.style)) throw new Error('Invalid settings');
  if (task !== 'analyze' && task !== 'hooks' && !p.hook) throw new Error('A selected hook is required');
  if ((task === 'scenes' || task === 'stronger') && !Array.isArray(p.story?.beats)) throw new Error('A story is required');
  if (task === 'stronger' && (!Array.isArray(p.scenes) || !p.scenes.length)) throw new Error('Scenes are required');
  if (task === 'stronger' && !Array.isArray(p.boosts)) p.boosts = [];
}
