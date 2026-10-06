import { DEFAULT_LANGUAGE, DEFAULT_PROMPT_LANGUAGE, isLang } from '../../shared/i18n';
import type { Lang, Reel } from '../../shared/types';

// v2: reels carry language settings and a Russian prompt layer; v1 reels are ignored and the demo opens instead.
const KEY = 'vrf:reel:v2';
const LANG_KEY = 'vrf:lang';
const PROMPT_LANG_KEY = 'vrf:promptLang';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or disabled: the session still works, it just won't survive a reload.
  }
};

export function loadReel(): Reel | null {
  try {
    const raw = read(KEY);
    const r = raw ? (JSON.parse(raw) as Reel) : null;
    return r && typeof r.idea === 'string' && isLang(r.settings?.language) ? r : null;
  } catch {
    return null;
  }
}

export const saveReel = (reel: Reel) => write(KEY, JSON.stringify(reel));

export function loadLang(): Lang {
  const v = read(LANG_KEY);
  return isLang(v) ? v : DEFAULT_LANGUAGE;
}
export const saveLang = (l: Lang) => write(LANG_KEY, l);

export function loadPromptLang(): Lang {
  const v = read(PROMPT_LANG_KEY);
  return isLang(v) ? v : DEFAULT_PROMPT_LANGUAGE;
}
export const savePromptLang = (l: Lang) => write(PROMPT_LANG_KEY, l);
