// End-to-end check of the workflow (Russian by default, RU/EN switches) against a running server.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.SHOTS ?? 'e2e/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
const log = (...a) => console.log('✓', ...a);
const assert = (cond, msg) => { if (!cond) throw new Error(`ASSERT: ${msg}`); };
const shot = (n, opts = {}) => page.screenshot({ path: `${OUT}/${n}.png`, ...opts });
const btn = (name) => page.getByRole('button', { name, exact: true }).first();
const radio = (group, name) => page.getByRole('radiogroup', { name: group }).getByRole('radio', { name, exact: true });
const heading = (name) => page.getByRole('heading', { name });
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
const idea = () => page.locator('#idea-input');
const CYR = /[а-яё]/i;
// UI chrome text with prompts and the user's own idea removed; whatever Latin words remain must be allowed brand/tech names.
const ALLOWED = new Set(['VIRAL', 'REEL', 'FACTORY', 'UGC', 'POV', 'API', 'OpenAI', 'Gemini', 'env']);
const latinInUi = () => page.evaluate((allowed) => {
  const root = document.querySelector('.app').cloneNode(true);
  root.querySelectorAll('pre, textarea, .toasts').forEach((n) => n.remove());
  return (root.innerText.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.includes(w));
}, [...ALLOWED]);

try {
  // 0. First visit: Russian UI, demo project, Demo Mode.
  await page.goto(BASE);
  await page.getByTestId('scene').first().waitFor();
  assert((await page.locator('html').getAttribute('lang')) === 'ru', 'html lang ru');
  for (const text of ['Преврати идею в сильный короткий ролик', 'Что вы хотите создать?', 'ДЕМО-ПРОЕКТ', 'ДЕМО-РЕЖИМ']) assert(await page.getByText(text, { exact: true }).first().isVisible(), `visible: ${text}`);
  assert((await page.getByTestId('demo-note').innerText()).includes('AI API не подключён. Сейчас используется демонстрационный режим'), 'demo note');
  assert((await page.getByTestId('demo-note').innerText()).includes('офлайн-движок'), 'offline engine disclosed');
  const pipe = { idea: 'ИДЕЯ', hook: 'ХУК', story: 'ИСТОРИЯ', scenes: 'СЦЕНЫ', prompts: 'ПРОМПТЫ' };
  for (const [id, k] of Object.entries(pipe)) assert((await page.getByTestId(`pipe-${id}`).innerText()).includes(k), `pipeline ${k}`);
  assert((await idea().getAttribute('placeholder')).startsWith('Например: девушка садится в машину'), 'placeholder');
  assert((await page.getByTestId('scene').count()) === 5, 'demo has 5 scenes');
  const leftovers = await latinInUi();
  assert(leftovers.length === 0, 'English left in the Russian UI: ' + leftovers.join(', '));
  await shot('00-ru-home');
  log('first visit → Russian UI, demo project (5 scenes), ДЕМО-РЕЖИМ; no English UI text');

  // 1. Empty idea and too-short idea produce Russian messages.
  await idea().fill('');
  await btn('СОЗДАТЬ РОЛИК').click();
  await page.locator('.toast', { hasText: 'Введите идею' }).waitFor();
  await idea().fill('кот');
  await btn('СОЗДАТЬ РОЛИК').click();
  await page.locator('.toast', { hasText: 'Недостаточно данных для анализа' }).waitFor();
  // The one-word idea is rejected by the server with HTTP 400 on purpose; Chrome logs that response as a console error.
  errors.splice(0, errors.length, ...errors.filter((e) => !e.includes('status of 400')));
  log('validation → «Введите идею», «Недостаточно данных для анализа»');

  // 2–3. Idea → analysis in Russian.
  await idea().fill('Парень заходит в лифт, двери закрываются, и внезапно он оказывается в космосе');
  await radio('Длительность', '30 сек').click();
  await radio('Стиль', 'UGC').click();
  await btn('СОЗДАТЬ РОЛИК').click();
  await heading('АНАЛИЗ ИДЕИ').waitFor();
  for (const k of ['Концепция', 'Главный персонаж', 'Цель', 'Конфликт', 'Неожиданность', 'Эмоциональное направление', 'Финал / Развязка']) assert(await page.locator('#analysis dt', { hasText: new RegExp(`^${k}$`) }).isVisible(), `field ${k}`);
  assert(await page.locator('#analysis').getByText('Слабые места').isVisible(), 'weak points');
  assert(await page.getByTestId('improved-idea').getByText('Улучшенная идея').isVisible(), 'improved idea');
  const concept = await page.locator('#analysis dd').first().innerText();
  assert(concept.startsWith('Ролик о сломе реальности') && concept.includes('поверхности чужой планеты'), 'analysis in Russian: ' + concept);
  log('analysis →', await page.getByTestId('score').innerText(), '| Russian, weak points + improved idea');

  // 4. Five Russian hooks.
  await page.locator('.hook').nth(4).waitFor();
  assert((await page.getByRole('button', { name: 'ВЫБРАТЬ', exact: true }).count()) === 5, '5 ВЫБРАТЬ buttons');
  for (const k of ['Любопытство', 'Шок', 'Эмоция', 'Визуальный хук', 'История']) assert(await page.locator('.hook-type', { hasText: k }).isVisible(), `hook type ${k}`);
  assert((await page.locator('.hook h4', { hasText: 'Почему это работает' }).count()) === 5, 'why it works');
  for (const t of await page.locator('.hook-text').allInnerTexts()) assert(CYR.test(t), 'hook text Russian: ' + t);
  await page.locator('#analysis').scrollIntoViewIfNeeded();
  await shot('01-ru-analysis-hooks', { fullPage: true });
  log('5 hooks in Russian with «Почему это работает» / ВЫБРАТЬ');

  // 5–7. Story and scenes in Russian.
  await page.getByTestId('hook-shock').getByRole('button', { name: 'ВЫБРАТЬ' }).click();
  await heading('ИСТОРИЯ').waitFor();
  await page.getByTestId('scene').first().waitFor();
  for (const k of ['ЭМОЦИОНАЛЬНАЯ ДУГА', 'ТЕМП']) assert(await page.locator('#story h4', { hasText: k }).isVisible(), `story ${k}`);
  for (const k of ['ХУК', 'ЗАВЯЗКА', 'РАЗВИТИЕ', 'ПОВОРОТ', 'РАЗВЯЗКА']) assert(await page.locator('.beat-head b', { hasText: new RegExp(`^${k}$`) }).first().isVisible(), `beat ${k}`);
  assert(CYR.test(await page.locator('.story-top p').nth(1).innerText()), 'story summary Russian');
  assert((await page.getByTestId('scene').count()) === 7, '30 сек → 7 scenes');
  assert(await page.getByText('Время: 24–30 сек').isVisible(), 'last scene 24–30 сек');
  assert(await page.getByRole('heading', { name: 'СЦЕНА 01' }).isVisible(), 'СЦЕНА 01');
  for (const k of ['Задача сцены', 'Визуал', 'Действие', 'Камера', 'Освещение', 'Звук', 'Текст на экране', 'Закадровый голос']) assert(await page.getByTestId('scene').first().locator('dt', { hasText: new RegExp(`^${k}$`) }).isVisible(), `scene field ${k}`);
  const s0 = await page.getByTestId('scene').first().locator('dd').allInnerTexts();
  assert(s0.every((t) => CYR.test(t) || t.startsWith('—')), 'scene 1 narrative Russian: ' + s0.join(' | '));
  const onScreen = await page.getByTestId('scene').last().locator('dt', { hasText: /^Текст на экране$/ }).locator('xpath=..').locator('dd').innerText();
  assert(onScreen.includes('по-настоящему'), 'on-screen text Russian: ' + onScreen);
  await page.locator('#story').scrollIntoViewIfNeeded();
  await shot('02-ru-story');
  log('ШОК hook → story + 7 Russian scenes (ХУК/ЗАВЯЗКА/РАЗВИТИЕ/ПОВОРОТ/РАЗВЯЗКА)');

  // 8–10. Prompts: English by default, RU on request; copy.
  assert(await page.getByText('Английская версия — оптимизирована для AI-генераторов').first().isVisible(), 'EN prompt note');
  await page.getByRole('button', { name: 'КОПИРОВАТЬ ПРОМПТ ИЗОБРАЖЕНИЯ' }).nth(2).click();
  await page.locator('.toast', { hasText: 'Скопировано в буфер обмена' }).first().waitFor();
  const imgEn = await clipboard();
  assert(imgEn.startsWith('Vertical 9:16 frame.') && !CYR.test(imgEn) && imgEn.includes('iPhone 15 Pro'), 'EN image prompt: ' + imgEn.slice(0, 120));
  await page.getByRole('button', { name: 'КОПИРОВАТЬ ПРОМПТ ВИДЕО' }).nth(5).click();
  const vidEn = await clipboard();
  assert(vidEn.startsWith('Vertical 9:16 video') && !CYR.test(vidEn) && vidEn.includes('olive bomber jacket'), 'EN video prompt with continuity');
  await radio('ЯЗЫК ПРОМПТОВ', '🇷🇺 RU').click();
  await page.getByText('Русская версия — для генераторов, которые понимают русский язык').first().waitFor();
  await page.getByRole('button', { name: 'КОПИРОВАТЬ ПРОМПТ ИЗОБРАЖЕНИЯ' }).nth(2).click();
  const imgRu = await clipboard();
  assert(imgRu.startsWith('Вертикальный кадр 9:16.') && imgRu.includes('Одежда: оливковый бомбер'), 'RU image prompt: ' + imgRu.slice(0, 160));
  await page.getByRole('button', { name: 'КОПИРОВАТЬ ПРОМПТ ВИДЕО' }).nth(5).click();
  assert((await clipboard()).startsWith('Вертикальное видео 9:16'), 'RU video prompt');
  await btn('КОПИРОВАТЬ ВСЁ').click();
  const all = await clipboard();
  assert(all.includes('## КОНЦЕПЦИЯ РОЛИКА') && all.includes('СЦЕНА 07') && (all.match(/ПРОМПТ ДЛЯ ИЗОБРАЖЕНИЯ:\nВертикальный кадр/g) ?? []).length === 7 && all.includes('Текст диктора:'), 'copy all (RU)');
  await page.getByTestId('scene').nth(1).scrollIntoViewIfNeeded();
  await shot('03-ru-scenes-ru-prompts');
  log('prompts EN by default → RU switch works; КОПИРОВАТЬ ПРОМПТ / ВСЁ → clipboard verified');

  // 11–12. УСИЛИТЬ РОЛИК in Russian.
  await btn('🔥 УСИЛИТЬ РОЛИК').click();
  await page.getByRole('dialog', { name: '🔥 УСИЛЕНИЕ РОЛИКА' }).waitFor();
  for (const k of ['БЫЛО', 'СТАЛО']) assert(await page.getByRole('dialog').locator('h4', { hasText: new RegExp(`^${k}$`) }).isVisible(), k);
  assert(await page.getByRole('dialog').getByText('Чек-лист улучшений').isVisible(), 'checklist');
  const impr = await page.getByTestId('improvement').count();
  assert(impr >= 5, `improvements: ${impr}`);
  assert((await page.getByText('ПОЧЕМУ СТАЛО СИЛЬНЕЕ').count()) === impr, 'why for each');
  for (const t of await page.getByTestId('improvement').locator('h4').allInnerTexts()) assert(CYR.test(t), 'improvement label Russian: ' + t);
  assert(await btn('ОСТАВИТЬ ТЕКУЩУЮ ВЕРСИЮ').isVisible(), 'keep button');
  await shot('04-ru-stronger');
  await btn('ИСПОЛЬЗОВАТЬ УСИЛЕННУЮ ВЕРСИЮ').click();
  await page.getByText('v2 · усилен').waitFor();
  const lastTime = await page.getByTestId('scene').last().locator('.scene-time').innerText();
  assert(lastTime.endsWith('30 сек'), 'duration kept: ' + lastTime);
  await btn('🔥 УСИЛИТЬ РОЛИК').click();
  await page.locator('.toast', { hasText: 'Нечего улучшать' }).waitFor();
  log(`УСИЛИТЬ РОЛИК → ${impr} improvements, v2 applied (${lastTime}); second pass → «Нечего улучшать»`);

  // 13. UI language EN: interface and narrative switch, prompt language stays independent (RU).
  const scenesBefore = await page.getByTestId('scene').count();
  await radio('Язык интерфейса', '🇬🇧 EN').click();
  await heading('IDEA ANALYSIS').waitFor();
  assert(await btn('CREATE REEL').isVisible(), 'CREATE REEL');
  assert(await page.getByText('v2 · stronger').isVisible(), 'v2 kept after language switch');
  assert((await page.locator('html').getAttribute('lang')) === 'en', 'html lang en');
  for (const t of await page.locator('.hook-text').allInnerTexts()) assert(!CYR.test(t), 'hook text English: ' + t);
  assert(!CYR.test(await page.locator('#analysis dd').first().innerText()), 'analysis English');
  assert((await page.getByTestId('scene').count()) === scenesBefore, 'same scenes after the switch');
  await page.getByRole('button', { name: 'COPY IMAGE PROMPT' }).nth(2).click();
  assert((await clipboard()).startsWith('Вертикальный кадр'), 'prompt language stayed RU');
  await radio('PROMPT LANGUAGE', '🇬🇧 EN').click();
  await page.getByRole('button', { name: 'COPY IMAGE PROMPT' }).nth(2).click();
  assert((await clipboard()).startsWith('Vertical 9:16 frame.'), 'prompt language back to EN');
  // The improved idea rewrites the user's own (Russian) text, so it intentionally keeps the idea's language.
  const leftoversEn = await page.evaluate(() => {
    const root = document.querySelector('.app').cloneNode(true);
    root.querySelectorAll('pre, textarea, .toasts, [data-testid=improved-idea] p').forEach((n) => n.remove());
    return (root.innerText.match(/[а-яё]+/gi) ?? []);
  });
  assert(leftoversEn.length === 0, 'Russian left in the English UI: ' + leftoversEn.slice(0, 10).join(', '));
  await page.locator('#scenes').scrollIntoViewIfNeeded();
  await shot('05-en-switch');
  log('UI → EN: interface + narrative English, v2 kept, prompt language independent');

  // Back to RU; reload keeps language and reel.
  await radio('Interface language', '🇷🇺 RU').click();
  await heading('АНАЛИЗ ИДЕИ').waitFor();
  await page.reload();
  await page.getByText('v2 · усилен').waitFor();
  assert(await btn('СОЗДАТЬ РОЛИК').isVisible(), 'RU after reload');
  log('back to RU; reload keeps language, reel v2 and settings');

  // Demo project + weak idea → improved idea.
  await btn('Открыть демо-проект').click();
  await page.getByText('ДЕМО-ПРОЕКТ').first().waitFor();
  assert((await idea().inputValue()).includes('динозавров'), 'demo idea restored');
  await idea().fill('кот спит');
  await btn('СОЗДАТЬ РОЛИК').click();
  await page.getByTestId('improved-idea').waitFor();
  assert((await page.getByText('Слабая идея').count()) === 1, 'weak verdict');
  await btn('Использовать улучшенную идею').click();
  await page.locator('.hook').nth(4).waitFor();
  assert((await idea().inputValue()).startsWith('Кот спит, но'), 'improved idea placed in the field');
  log('demo project reopens; weak idea → «Слабая идея» → improved idea re-run');

  assert(errors.length === 0, 'browser errors:\n' + errors.join('\n'));
  console.log('\nE2E PASSED');
} finally {
  await browser.close();
}
