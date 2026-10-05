import { DEFAULT_LANGUAGE, DEFAULT_PROMPT_LANGUAGE } from './i18n';
import type { Duration, ReelSettings, ReelStyle } from './types';

export const DURATIONS: Duration[] = [10, 15, 30, 60];

export const STYLES: ReelStyle[] = ['cinematic', 'ugc', 'commercial', 'comedy', 'realistic'];

export const DEFAULT_SETTINGS: ReelSettings = { duration: 15, format: '9:16', style: 'cinematic', language: DEFAULT_LANGUAGE, promptLanguage: DEFAULT_PROMPT_LANGUAGE };
