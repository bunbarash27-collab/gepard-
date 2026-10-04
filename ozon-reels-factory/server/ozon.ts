export interface OzonParseResult {
  ok: boolean;
  sku?: string;
  name?: string;
  imageUrl?: string;
  message: string;
}

const MANUAL = 'Заполните данные товара вручную — это займёт пару минут.';

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
      redirect: 'follow',
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
  return { ok: false, sku, message: `Не удалось автоматически получить данные с Ozon${sku ? ` (артикул ${sku} сохранён)` : ''}. ${MANUAL}` };
}
