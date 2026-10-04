import { nameFromOzonUrl } from '../shared/ozonText';

export interface OzonParseResult {
  ok: boolean;
  sku?: string;
  name?: string;
  /** True when the name was only reconstructed from the URL slug. */
  approximate?: boolean;
  imageUrl?: string;
  message: string;
}

const MANUAL = 'Заполните данные товара вручную или вставьте текст карточки ниже.';

/**
 * Best-effort Ozon card lookup. Ozon usually blocks server-side requests (anti-bot),
 * so the UI always falls back to manual input.
 */
export async function parseOzonUrl(input: string): Promise<OzonParseResult> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, message: `Это не похоже на ссылку. ${MANUAL}` };
  }
  if (!/(^|\.)ozon\.(ru|by|kz)$/i.test(url.hostname)) return { ok: false, message: `Ссылка не ведёт на Ozon. ${MANUAL}` };
  const sku = url.pathname.match(/-(\d{5,})\/?$/)?.[1] ?? url.pathname.match(/\/(\d{5,})\/?$/)?.[1];

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'ru-RU,ru;q=0.9' },
      // Ozon answers server requests with an endless 307 anti-bot loop; fail fast instead of following it.
      redirect: 'manual',
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const html = await res.text();
      const meta = (prop: string) => html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)`, 'i'))?.[1];
      const name = meta('og:title')?.replace(/\s*купить.*$/i, '').trim();
      if (name && !/antibot|доступ ограничен/i.test(name)) {
        return { ok: true, sku, name, imageUrl: meta('og:image'), message: 'Название получено со страницы Ozon. Проверьте и дополните остальные поля.' };
      }
    }
  } catch {
    // fall through to manual
  }
  const name = nameFromOzonUrl(url.pathname);
  return {
    ok: false,
    sku,
    name,
    approximate: Boolean(name),
    message: `Ozon закрыл прямой доступ к странице (защита от ботов)${sku ? `, артикул ${sku}` : ''}.${name ? ' Название подставлено из ссылки — проверьте его.' : ''} ${MANUAL}`,
  };
}
