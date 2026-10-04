import type { GeneratorSettings, Project, ProductInput, ProjectStatus, VoiceSettings } from './types';
import { uid } from './util';

export const DEFAULT_SETTINGS: GeneratorSettings = { format: '9:16', duration: 30, platform: 'reels', style: 'cinematic', cta: 'Смотреть товар' };
export const DEFAULT_VOICE: VoiceSettings = { voice: 'female', tone: 'friendly', speed: 'normal' };

export const emptyProduct = (): ProductInput => ({
  ozonUrl: '', name: '', category: '', price: '', specs: '', benefits: '', audience: '', restrictions: '', appearance: '',
});

export function newProject(product: ProductInput): Project {
  const now = new Date().toISOString();
  return { id: uid('prj'), createdAt: now, updatedAt: now, status: 'draft', product, settings: { ...DEFAULT_SETTINGS }, scenes: [], voice: { ...DEFAULT_VOICE } };
}

export function computeStatus(p: Pick<Project, 'scenes' | 'social'>): ProjectStatus {
  if (p.scenes.length && p.social) return 'ready';
  if (p.scenes.length) return 'generated';
  return 'draft';
}
