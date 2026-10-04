import {
  analyzeProduct,
  buildProductLock,
  continueStory,
  generateAngles,
  generateScript,
  generateSocial,
  makeViral,
  PRODUCT_LOCK_PHRASE,
} from '../../shared/engine';
import type { AdAngle, AIResponse, AIStatus, AITask, GenContext, ProductAnalysis, ProductInput, Scene, SocialPackage, ViralResult } from '../../shared/types';
import { uid } from '../../shared/util';
import type { AIProvider } from './providers';
import { SYSTEM_BASE, TASK_INSTRUCTIONS } from './prompts';

export interface TaskPayloads {
  analyze: { product: ProductInput };
  angles: { product: ProductInput; analysis: ProductAnalysis };
  script: { ctx: GenContext };
  viral: { ctx: GenContext; scenes: Scene[] };
  continue: { ctx: GenContext; scenes: Scene[] };
  social: { ctx: GenContext };
}

export interface TaskResults {
  analyze: ProductAnalysis;
  angles: AdAngle[];
  script: Scene[];
  viral: ViralResult;
  continue: Scene;
  social: SocialPackage;
}

export const DEMO_MESSAGE = 'AI API не подключен. Используется демонстрационный режим.';

const demo: { [K in AITask]: (p: TaskPayloads[K]) => TaskResults[K] } = {
  analyze: ({ product }) => analyzeProduct(product),
  angles: ({ product, analysis }) => generateAngles(product, analysis),
  script: ({ ctx }) => generateScript(ctx),
  viral: ({ ctx, scenes }) => makeViral(ctx, scenes),
  continue: ({ ctx, scenes }) => continueStory(ctx, scenes),
  social: ({ ctx }) => generateSocial(ctx),
};

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strArr = (v: unknown, fallback: string[]) => (Array.isArray(v) && v.length ? v.map(String).filter(Boolean) : fallback);

function withoutImage(product: ProductInput) {
  const { imageDataUrl, ...rest } = product;
  return { ...rest, hasReferenceImage: Boolean(imageDataUrl) };
}

function ctxForModel(ctx: GenContext) {
  return { product: withoutImage(ctx.product), analysis: ctx.analysis, angle: ctx.angle, settings: ctx.settings, productLock: buildProductLock(ctx.product).clause };
}

function normalizeScene(raw: any, fallback: Scene, lockClause: string): Scene {
  const ensureLock = (p: string) => (p.toLowerCase().includes(PRODUCT_LOCK_PHRASE) ? p : `${p}\nProduct lock: ${lockClause}`);
  const duration = Number(raw?.duration);
  return {
    id: uid('scene'),
    goal: str(raw?.goal, fallback.goal).toUpperCase(),
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 10) / 10 : fallback.duration,
    action: str(raw?.action, fallback.action),
    onScreenText: str(raw?.onScreenText, fallback.onScreenText),
    voiceover: str(raw?.voiceover, fallback.voiceover),
    camera: str(raw?.camera, fallback.camera),
    lighting: str(raw?.lighting, fallback.lighting),
    sound: str(raw?.sound, fallback.sound),
    imagePrompt: ensureLock(str(raw?.imagePrompt, fallback.imagePrompt)),
    videoPrompt: ensureLock(str(raw?.videoPrompt, fallback.videoPrompt)),
    endingFrame: str(raw?.endingFrame, fallback.endingFrame),
  };
}

function normalizeScenes(raw: unknown, fallback: Scene[], lockClause: string, total?: number): Scene[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('Модель не вернула сцены');
  const scenes = raw.map((s, i) => normalizeScene(s, fallback[Math.min(i, fallback.length - 1)], lockClause));
  if (total) {
    // Models often miss the exact total; rescale proportionally and fix rounding on the last scene.
    const sum = scenes.reduce((a, s) => a + s.duration, 0);
    if (Math.abs(sum - total) > 0.01) {
      scenes.forEach((s) => (s.duration = Math.max(1, Math.round((s.duration * total) / sum))));
      const diff = total - scenes.reduce((a, s) => a + s.duration, 0);
      scenes[scenes.length - 1].duration = Math.max(1, scenes[scenes.length - 1].duration + diff);
    }
  }
  return scenes;
}

export class AIService {
  constructor(private provider: AIProvider | null) {}

  status(): AIStatus {
    if (!this.provider) return { mode: 'demo', connected: false, message: DEMO_MESSAGE };
    return { mode: this.provider.id, connected: true, model: this.provider.model, message: `Подключено: ${this.provider.id === 'openai' ? 'OpenAI' : 'Google Gemini'} (${this.provider.model})` };
  }

  async run<K extends AITask>(task: K, payload: TaskPayloads[K]): Promise<AIResponse<TaskResults[K]>> {
    const fallback = () => demo[task](payload);
    if (!this.provider) return { data: fallback(), mode: 'demo', notice: DEMO_MESSAGE };
    try {
      const data = await this.runModel(task, payload);
      return { data, mode: this.provider.id };
    } catch (err) {
      console.error(`[AIService] ${task} failed:`, err);
      return {
        data: fallback(),
        mode: 'demo',
        notice: `AI-провайдер вернул ошибку (${(err as Error).message.slice(0, 120)}). Показан результат демонстрационного движка.`,
      };
    }
  }

  private async ask(task: AITask, input: unknown, image?: string): Promise<any> {
    const user = `${TASK_INSTRUCTIONS[task]}\n\nINPUT:\n${JSON.stringify(input, null, 2)}`;
    const raw = await this.provider!.completeJSON(SYSTEM_BASE, user, image);
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  }

  private async runModel<K extends AITask>(task: K, payload: TaskPayloads[K]): Promise<TaskResults[K]> {
    const fb = demo[task](payload) as any;
    switch (task) {
      case 'analyze': {
        const { product } = payload as TaskPayloads['analyze'];
        // Only raster photos are useful to vision models; the demo SVG is skipped.
        const image = product.imageDataUrl?.startsWith('data:image/svg') ? undefined : product.imageDataUrl;
        const r = await this.ask(task, { product: withoutImage(product) }, image);
        const base = fb as ProductAnalysis;
        const risks = Array.isArray(r.risks) ? r.risks.filter((x: any) => x?.phrase).map((x: any) => ({ phrase: String(x.phrase), source: str(x.source, 'AI'), reason: str(x.reason, ''), safeAlternative: str(x.safeAlternative, '') })) : [];
        return {
          name: str(r.name, base.name), category: str(r.category, base.category), audience: str(r.audience, base.audience),
          pain: str(r.pain, base.pain), desire: str(r.desire, base.desire), mainBenefit: str(r.mainBenefit, base.mainBenefit),
          sellingPoint: str(r.sellingPoint, base.sellingPoint), objections: strArr(r.objections, base.objections), reasonsNow: strArr(r.reasonsNow, base.reasonsNow),
          // Local rule-based checks always apply on top of the model's findings.
          risks: [...base.risks, ...risks.filter((x: any) => !base.risks.some((b) => b.phrase === x.phrase))],
          rules: Array.from(new Set([...base.rules, ...strArr(r.rules, [])])),
        } as TaskResults[K];
      }
      case 'angles': {
        const { product, analysis } = payload as TaskPayloads['angles'];
        const r = await this.ask(task, { product: withoutImage(product), analysis });
        const list: any[] = Array.isArray(r.angles) ? r.angles : [];
        return (fb as AdAngle[]).map((d) => {
          const m = list.find((x) => String(x?.type).toLowerCase() === d.type) ?? {};
          return { ...d, title: str(m.title, d.title), hook: str(m.hook, d.hook), idea: str(m.idea, d.idea), emotion: str(m.emotion, d.emotion), whyItWorks: str(m.whyItWorks, d.whyItWorks), audience: str(m.audience, d.audience) };
        }) as TaskResults[K];
      }
      case 'script': {
        const { ctx } = payload as TaskPayloads['script'];
        const r = await this.ask(task, ctxForModel(ctx));
        return normalizeScenes(r.scenes, fb, buildProductLock(ctx.product).clause, ctx.settings.duration) as TaskResults[K];
      }
      case 'viral': {
        const { ctx, scenes } = payload as TaskPayloads['viral'];
        const r = await this.ask(task, { ...ctxForModel(ctx), scenes });
        const total = scenes.reduce((a, s) => a + s.duration, 0);
        const changes = Array.isArray(r.changes) ? r.changes.map((c: any) => ({ area: str(c?.area, '—'), before: str(c?.before, '—'), after: str(c?.after, '—') })) : [];
        return { scenes: normalizeScenes(r.scenes, scenes, buildProductLock(ctx.product).clause, total), changes } as TaskResults[K];
      }
      case 'continue': {
        const { ctx, scenes } = payload as TaskPayloads['continue'];
        const r = await this.ask(task, { ...ctxForModel(ctx), scenes });
        return normalizeScene(r.scene ?? r, fb, buildProductLock(ctx.product).clause) as TaskResults[K];
      }
      case 'social': {
        const { ctx } = payload as TaskPayloads['social'];
        const r = await this.ask(task, ctxForModel(ctx));
        const d = fb as SocialPackage;
        const vars: any[] = Array.isArray(r.variations) ? r.variations : [];
        return {
          caption: str(r.caption, d.caption), hook: str(r.hook, d.hook), cta: str(r.cta, d.cta),
          hashtags: strArr(r.hashtags, d.hashtags).map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 15),
          keywords: strArr(r.keywords, d.keywords),
          variations: d.variations.map((v) => ({ ...v, caption: str(vars.find((x) => x?.id === v.id)?.caption, v.caption) })),
        } as TaskResults[K];
      }
    }
    throw new Error(`Unknown task ${task}`);
  }
}
