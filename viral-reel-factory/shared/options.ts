import type { Duration, ReelSettings, ReelStyle } from './types';

export const DURATIONS: { id: Duration; label: string }[] = [
  { id: 10, label: '10 sec' },
  { id: 15, label: '15 sec' },
  { id: 30, label: '30 sec' },
  { id: 60, label: '60 sec' },
];

export const STYLES: { id: ReelStyle; label: string }[] = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'ugc', label: 'UGC' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'realistic', label: 'Realistic' },
];

export const DEFAULT_SETTINGS: ReelSettings = { duration: 15, format: '9:16', style: 'cinematic' };

export const PIPELINE = ['IDEA', 'ANALYZE', 'HOOK', 'STORY', 'SCENES', 'IMAGE PROMPTS', 'VIDEO PROMPTS'] as const;
