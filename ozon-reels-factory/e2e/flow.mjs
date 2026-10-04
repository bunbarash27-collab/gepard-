// End-to-end check of the full user path against a running server (default http://localhost:3000).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.SHOTS ?? 'e2e/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
process.on('exit', () => errors.length && console.log('BROWSER ERRORS:', errors.join('\n')));
const log = (...a) => console.log('✓', ...a);
const assert = (cond, msg) => { if (!cond) throw new Error(`ASSERT: ${msg}`); };
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const btn = (name) => page.getByRole('button', { name }).first();
const f = (label) => page.locator('.field', { hasText: label }).locator('input, textarea').first();
const footNext = (name) => page.locator('.ws-foot').getByRole('button', { name }).click();
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

// 1. First run opens the demo project
await page.goto(BASE);
await page.waitForURL(/#\/p\/demo\/script/);
await page.getByTestId('scene').first().waitFor();
assert((await page.getByTestId('scene').count()) === 6, 'demo has 6 scenes');
await shot('01-demo-script');
log('first run → demo project script with 6 scenes');

// 2. Home: product form
await page.goto(`${BASE}/#/`);
await page.getByLabel('Ссылка на Ozon').fill('https://www.ozon.ru/product/organayzer-dlya-kuhni-987654321/');
await btn('Получить').click();
await page.getByText(/Ozon закрыл прямой доступ/).waitFor();
assert((await f('Название товара').inputValue()) === 'Органайзер для кухни', 'name restored from slug');
await page.getByLabel('Текст карточки Ozon').fill('Каталог\nОрганайзер\n1 290 ₽\nХарактеристики\nМатериал: пластик\nЯрусов: 3');
await btn('Заполнить поля').click();
await page.waitForFunction(() => [...document.querySelectorAll('.field')].some((f) => f.textContent.includes('Цена') && f.querySelector('input')?.value === '1290'));
assert((await f('Главные характеристики').inputValue()).includes('Материал: пластик'), 'specs from pasted text');
await shot('02a-ozon-paste');
log('ozon link → blocked notice, name from slug, paste text fills price/specs');
await page.locator('input[type=file]').first().setInputFiles(`${OUT}/01-demo-script.png`);
await page.locator('.upload img').waitFor();
await f('Название товара').fill('Органайзер для кухни «Порядок»');
await f('Категория').fill('Товары для кухни');
await f('Цена').fill('1290');
await f('Главные характеристики').fill('Пластик без запаха\n3 яруса\nРазмер 30×20×25 см');
await f('Преимущества').fill('Экономит место на столешнице\nЛегко мыть\nГарантированно лучший органайзер №1');
await f('Что нельзя обещать').fill('Не сравнивать с конкурентами');
await f('Внешний вид товара').fill('белый трёхъярусный органайзер с серыми полками, логотип «Порядок» на боковой стенке');
await shot('02-home-form');
await btn('СОЗДАТЬ РЕКЛАМНУЮ КАМПАНИЮ').click();
await page.waitForURL(/\/analysis$/);
await page.getByText('PRODUCT ANALYSIS').waitFor();
assert(await page.getByText('РЕКЛАМНЫЕ ОГРАНИЧЕНИЯ').isVisible(), 'restrictions block');
const risks = await page.locator('.risks li').count();
assert(risks >= 2, 'risky claims detected');
assert(await page.locator('.risks').getByText('«Гарантированно»').isVisible(), 'full risky word shown');
await shot('03-analysis');
log('create campaign → analysis with', risks, 'risk flags');

// 3. Angles
await btn('Смотреть 5 рекламных концепций').click();
await page.waitForURL(/\/angles$/);
await page.locator('.angle-card').nth(4).waitFor();
assert((await page.locator('.angle-card').count()) === 5, '5 angles');
await shot('04-angles');
await page.getByTestId('angle-humor').getByRole('button', { name: 'СОЗДАТЬ РОЛИК' }).click();
await page.waitForURL(/\/script$/);
log('5 angles → selected HUMOR');

// 4. Script
await page.getByRole('radio', { name: '15 сек' }).click();
await page.getByRole('radio', { name: 'TikTok' }).click();
await page.getByRole('radio', { name: 'Funny' }).click();
await page.getByRole('radio', { name: 'Выбрать свой вариант' }).click();
await f('Свой CTA').fill('Заказать на Ozon');
await btn('Сгенерировать сценарий').click();
await page.getByTestId('scene').first().waitFor();
assert((await page.getByTestId('scene').count()) === 4, '15s → 4 scenes');
assert(await page.getByText('Итого 15 сек').isVisible(), 'total 15s');
assert((await page.getByRole('button', { name: 'COPY IMAGE PROMPT' }).count()) === 4, 'copy image buttons');
assert((await page.getByRole('button', { name: 'COPY VIDEO PROMPT' }).count()) === 4, 'copy video buttons');
await page.getByRole('button', { name: 'COPY VIDEO PROMPT' }).nth(1).click();
const vclip = await clipboard(); assert(vclip.includes('preserve the exact product design'), 'video prompt copied with product lock: ' + vclip.slice(0, 300));
await shot('05-script');
log('script: 4 scenes, 15s, copy prompt works');

await btn('MAKE IT VIRAL').click();
await page.locator('.compare').waitFor();
const rows = await page.locator('.compare tbody tr').count();
assert(rows >= 7, `viral changes rows ${rows}`);
await page.waitForTimeout(300);
await shot('06-viral');
await btn('Оставить улучшения').click();
assert(await page.getByText('Итого 15 сек').isVisible(), 'viral kept duration');
log('make it viral →', rows, 'before/after rows, duration preserved');

// 5. Storyboard
await footNext(/Storyboard/);
await page.waitForURL(/\/storyboard$/);
const cards = () => page.getByTestId('board-card').count();
await page.getByTestId('board-card').first().waitFor();
assert((await cards()) === 4, 'storyboard 4');
await btn('CONTINUE STORY').click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid=board-card]').length === 5);
const lastVideo = await page.getByTestId('board-card').last().locator('details pre').nth(1).textContent();
assert(lastVideo.includes('continues seamlessly from the previous shot'), 'continuation prompt');
log('continue story → 5 cards, continuation references previous ending frame');
await btn('ДОБАВИТЬ СЦЕНУ').click();
await page.getByRole('dialog').locator('.field', { hasText: 'Текст на экране' }).locator('textarea').fill('Моя новая сцена');
await page.getByRole('button', { name: 'Сохранить сцену' }).click();
assert((await cards()) === 6, 'added scene');
const card = (i) => page.getByTestId('board-card').nth(i);
const firstText = await card(0).locator('.thumb-text').textContent();
await card(0).getByRole('button', { name: 'Переместить ниже' }).click();
assert((await card(1).locator('.thumb-text').textContent()) === firstText, 'move down');
await card(1).getByRole('button', { name: 'Переместить выше' }).click();
assert((await card(0).locator('.thumb-text').textContent()) === firstText, 'move up');
await card(0).getByRole('button', { name: /РЕДАКТИРОВАТЬ/ }).click();
await page.getByRole('dialog').locator('.field', { hasText: 'Текст на экране' }).locator('textarea').fill('Отредактированный хук');
await page.getByRole('button', { name: 'Сохранить сцену' }).click();
assert((await card(0).locator('.thumb-text').textContent()) === 'Отредактированный хук', 'edit');
await card(5).getByRole('button', { name: /УДАЛИТЬ/ }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();
assert((await cards()) === 5, 'deleted');
await shot('07-storyboard');
log('storyboard: add, edit, move ↑↓, delete');

// 6. Prompts
await footNext(/Prompts/);
await page.getByRole('heading', { name: /PRODUCT LOCK/ }).waitFor();
assert(await page.getByText('Reference photo подключено').isVisible(), 'reference connected');
await page.locator('.lock textarea').fill('белый органайзер, серые полки, логотип «Порядок» — ОБНОВЛЕНО');
await btn('Применить ко всем промптам').click();
assert((await page.locator('.prompt pre', { hasText: 'ОБНОВЛЕНО' }).count()) > 0, 'lock refreshed');
await shot('08-prompts');
log('prompts: product lock refresh applied');

// 7. Voiceover
await footNext(/Voiceover/);
await page.getByRole('radio', { name: 'Male', exact: true }).click();
await page.getByRole('radio', { name: 'Energetic' }).click();
await page.getByRole('radio', { name: 'Fast' }).click();
assert(await page.getByText(/мужской, тон Energetic/).isVisible(), 'direction updated');
await page.getByRole('button', { name: 'COPY VOICEOVER' }).click();
assert((await clipboard()).length > 20, 'voiceover copied');
assert(await page.getByRole('button', { name: /Coming soon/ }).isDisabled(), 'TTS marked coming soon');
await shot('09-voiceover');
log('voiceover settings + copy');

// 8. Social
await footNext(/Social/);
await btn('Создать social package').click();
await page.getByText('3 VARIATIONS').waitFor();
const tags = await page.locator('.tag:not(.tag-alt)').count();
assert(tags >= 10 && tags <= 15, `hashtags ${tags}`);
await page.getByRole('tab', { name: /Вариант B/ }).click();
assert(await page.getByRole('button', { name: 'COPY ВАРИАНТ B' }).isVisible(), 'variation B');
await shot('10-social');
log('social package:', tags, 'hashtags, variations switch');

// 9. Export
await footNext(/Export/);
assert(await page.locator('.ws-head').getByText('Ready').isVisible(), 'status ready');
for (const [label, ext] of [['EXPORT JSON', 'json'], ['EXPORT TXT', 'txt'], ['EXPORT MARKDOWN', 'md']]) {
  const [dl] = await Promise.all([page.waitForEvent('download'), btn(label).click()]);
  const p = `${OUT}/export.${ext}`;
  await dl.saveAs(p);
  assert(fs.statSync(p).size > 500, `${ext} size`);
}
const json = JSON.parse(fs.readFileSync(`${OUT}/export.json`, 'utf8'));
for (const k of ['product', 'audience', 'concept', 'hook', 'scenes', 'voiceover', 'image_prompts', 'video_prompts', 'caption', 'hashtags', 'cta']) assert(k in json, `json key ${k}`);
assert(json.scenes.length === 5 && json.cta.includes('Заказать на Ozon'), 'json content');
assert(!/№1|Гарантированно/.test(JSON.stringify({ s: json.scenes, c: json.caption, v: json.caption_variations })), 'risky claims not in output');
await btn('COPY ALL').click();
assert((await clipboard()).includes('SCENE 01'), 'copy all');
await shot('11-export');
log('export: JSON/TXT/MD downloaded, JSON keys ok, status Ready');

// 10. Projects
await page.goto(`${BASE}/#/projects`);
await page.getByTestId('project-card').first().waitFor();
assert((await page.getByTestId('project-card').count()) === 2, '2 projects');
await page.getByTestId('project-card').first().getByRole('button', { name: 'Duplicate' }).click();
assert((await page.getByTestId('project-card').count()) === 3, 'duplicated');
await page.getByTestId('project-card').first().getByRole('button', { name: 'Delete' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();
assert((await page.getByTestId('project-card').count()) === 2, 'deleted project');
await page.reload();
await page.getByTestId('project-card').first().waitFor();
assert((await page.getByTestId('project-card').count()) === 2, 'persisted after reload');
await shot('12-projects');
await page.getByTestId('project-card').first().getByRole('button', { name: 'Open' }).click();
await page.waitForURL(/\/script$/);
log('projects: open, duplicate, delete, persistence');

// 11. Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/#/`);
await page.getByText('Новый проект').first().waitFor();
await shot('13-mobile-home');
await page.goto(`${BASE}/#/p/demo/storyboard`);
await page.getByTestId('board-card').first().waitFor();
await shot('14-mobile-storyboard');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
assert(overflow <= 1, `no horizontal page overflow on mobile (${overflow}px)`);
log('mobile layout without horizontal overflow');

assert(errors.length === 0, `browser errors:\n${errors.join('\n')}`);
console.log('\nALL E2E CHECKS PASSED');
await browser.close();
