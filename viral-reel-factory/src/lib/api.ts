import type { StrongerInput } from '../../shared/engine';
import type { AIResponse, AIStatus, Hook, IdeaAnalysis, ReelSettings, Scene, SceneBundle, Story, StrongerResult } from '../../shared/types';

/** An error message written by the server (already in the request's language). */
export class ApiError extends Error {}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json.error ? new ApiError(json.error) : new Error(`Request failed (${res.status})`);
  return json as T;
}

export const api = {
  status: async (): Promise<AIStatus> => (await fetch('/api/status')).json(),
  analyze: (idea: string, settings: ReelSettings) => post<AIResponse<IdeaAnalysis>>('/api/ai/analyze', { idea, settings }),
  hooks: (idea: string, settings: ReelSettings, analysis: IdeaAnalysis) => post<AIResponse<Hook[]>>('/api/ai/hooks', { idea, settings, analysis }),
  story: (idea: string, settings: ReelSettings, analysis: IdeaAnalysis, hook: Hook) => post<AIResponse<Story>>('/api/ai/story', { idea, settings, analysis, hook }),
  scenes: (idea: string, settings: ReelSettings, analysis: IdeaAnalysis, hook: Hook, story: Story) => post<AIResponse<SceneBundle>>('/api/ai/scenes', { idea, settings, analysis, hook, story }),
  stronger: (input: StrongerInput) => post<AIResponse<StrongerResult>>('/api/ai/stronger', input),
  prompts: (idea: string, settings: ReelSettings, scenes: Scene[]) => post<AIResponse<Scene[]>>('/api/ai/prompts', { idea, settings, scenes }),
};
