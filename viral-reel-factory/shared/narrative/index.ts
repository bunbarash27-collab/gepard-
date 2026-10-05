import type { Lang } from '../types';
import { en } from './en';
import { ru } from './ru';
import type { Texts } from './types';

export type { Ctx, Core, SceneArgs, Strength, Texts, Weakness } from './types';

const PACKS: Record<Lang, Texts> = { en, ru };

export const texts = (lang: Lang): Texts => PACKS[lang] ?? PACKS.ru;
