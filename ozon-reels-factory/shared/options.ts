import type { AngleType, Duration, Platform, VisualStyle, VoiceGender, VoiceSpeed, VoiceTone } from './types';

export const DURATIONS: Duration[] = [10, 15, 20, 30, 45, 60];

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'reels', label: 'Instagram Reels' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'shorts', label: 'YouTube Shorts' },
  { id: 'vk', label: 'VK Клипы' },
];

export const STYLES: { id: VisualStyle; label: string }[] = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'ugc', label: 'Realistic UGC' },
  { id: 'commercial', label: 'Product commercial' },
  { id: 'funny', label: 'Funny' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'expert', label: 'Expert' },
  { id: 'viral', label: 'Fast viral' },
];

export const CTA_PRESETS = ['Купить', 'Подробнее', 'Смотреть товар', 'Перейти к товару'];

export const ANGLE_META: Record<AngleType, { label: string; short: string; icon: string }> = {
  pain: { label: 'PAIN', short: 'Продажа через проблему', icon: '🩹' },
  result: { label: 'RESULT', short: 'Желаемый результат', icon: '🎯' },
  emotion: { label: 'EMOTION', short: 'Эмоциональная история', icon: '💛' },
  humor: { label: 'HUMOR', short: 'Неожиданная ситуация', icon: '😄' },
  expert: { label: 'EXPERT', short: 'Объяснение простым языком', icon: '🧠' },
};

export const VOICES: { id: VoiceGender; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

export const TONES: { id: VoiceTone; label: string; direction: string }[] = [
  { id: 'energetic', label: 'Energetic', direction: 'бодро, с улыбкой в голосе, акцент на первых словах фраз' },
  { id: 'calm', label: 'Calm', direction: 'спокойно и мягко, длинные паузы между фразами' },
  { id: 'expert', label: 'Expert', direction: 'уверенно и размеренно, чёткая дикция, без эмоциональных всплесков' },
  { id: 'friendly', label: 'Friendly', direction: 'тепло, по-дружески, как совет знакомому' },
  { id: 'dramatic', label: 'Dramatic', direction: 'низко и напряжённо в начале, облегчение и подъём к финалу' },
  { id: 'funny', label: 'Funny', direction: 'иронично, с комичными паузами перед панчлайном' },
];

/** Average speaking rate for Russian voiceover, words per second. */
export const SPEEDS: { id: VoiceSpeed; label: string; wps: number; rate: string }[] = [
  { id: 'slow', label: 'Slow', wps: 1.8, rate: '0.9x' },
  { id: 'normal', label: 'Normal', wps: 2.3, rate: '1.0x' },
  { id: 'fast', label: 'Fast', wps: 2.8, rate: '1.15x' },
];

export const STATUS_LABEL = { draft: 'Draft', generated: 'Generated', ready: 'Ready' } as const;
