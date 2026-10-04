import type { AIMode, Project, ProductInput } from '../../shared/types';
import { api } from './api';

export type Notify = (text: string, kind?: 'ok' | 'info' | 'warn' | 'error') => void;

export function reportMode(r: { mode: AIMode; notice?: string }, toast: Notify) {
  // Demo mode is already shown as a persistent banner; only surface provider failures.
  if (r.notice && r.notice.startsWith('AI-провайдер')) toast(r.notice, 'warn');
}

/** PRODUCT → ANALYZE → 5 ANGLES, used by "Создать рекламную кампанию" and "Обновить анализ". */
export async function runAnalysis(project: Project, product: ProductInput, toast: Notify, onStep: (i: number) => void): Promise<Project> {
  onStep(0);
  const a = await api.analyze(product);
  reportMode(a, toast);
  onStep(1);
  const g = await api.angles(product, a.data);
  reportMode(g, toast);
  onStep(2);
  return { ...project, product, analysis: a.data, angles: g.data, selectedAngleId: project.selectedAngleId, generatedBy: g.mode };
}
