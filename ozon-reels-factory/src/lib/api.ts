import type { ExtractedProduct } from '../../shared/ozonText';
import type { AdAngle, AIResponse, AIStatus, GenContext, ProductAnalysis, ProductInput, Scene, SocialPackage, ViralResult } from '../../shared/types';

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Ошибка сервера (${res.status})`);
  return json as T;
}

export const api = {
  status: async (): Promise<AIStatus> => (await fetch('/api/status')).json(),
  parseOzon: (url: string) => post<{ ok: boolean; name?: string; approximate?: boolean; sku?: string; message: string }>('/api/ozon/parse', { url }),
  extract: (text: string, url: string) => post<AIResponse<ExtractedProduct>>('/api/ai/extract', { text, url }),
  analyze: (product: ProductInput) => post<AIResponse<ProductAnalysis>>('/api/ai/analyze', { product }),
  angles: (product: ProductInput, analysis: ProductAnalysis) => post<AIResponse<AdAngle[]>>('/api/ai/angles', { product, analysis }),
  script: (ctx: GenContext) => post<AIResponse<Scene[]>>('/api/ai/script', { ctx }),
  viral: (ctx: GenContext, scenes: Scene[]) => post<AIResponse<ViralResult>>('/api/ai/viral', { ctx, scenes }),
  continueStory: (ctx: GenContext, scenes: Scene[]) => post<AIResponse<Scene>>('/api/ai/continue', { ctx, scenes }),
  social: (ctx: GenContext) => post<AIResponse<SocialPackage>>('/api/ai/social', { ctx }),
};
