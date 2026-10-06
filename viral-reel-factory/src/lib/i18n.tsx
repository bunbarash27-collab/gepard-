import { createContext, useContext, type ReactNode } from 'react';
import { UI, type Dict } from '../../shared/i18n';
import type { Lang } from '../../shared/types';

const I18nCtx = createContext<{ lang: Lang; t: Dict }>({ lang: 'ru', t: UI.ru });

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <I18nCtx.Provider value={{ lang, t: UI[lang] }}>{children}</I18nCtx.Provider>;
}

export const useT = () => useContext(I18nCtx);
