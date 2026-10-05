// End-to-end check of the Phase 1 workflow against a running server (default http://localhost:3000).
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
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

try {
  // 0. First visit shows the ready demo project.
  await page.goto(BASE);
  await page.getByTestId('scene').first().waitFor();
  assert(await page.getByText('Demo project').first().isVisible(), 'demo badge');
  assert((await page.getByTestId('scene').count()) === 5, 'demo has 5 scenes');
  await page.getByTestId('ai-status').getByText('Demo Mode').waitFor();
  await shot('00-demo-home');
  log('first visit → demo project with 5 scenes, Demo Mode pill');

  // 1–2. Enter an idea, pick settings, CREATE REEL.
  await page.getByLabel('What do you want to create?').fill('Парень заходит в лифт, двери закрываются, и внезапно он оказывается в космосе');
  await page.getByRole('radio', { name: '30 sec' }).click();
  await page.getByRole('radio', { name: 'UGC' }).click();
  await btn('CREATE REEL').click();

  // 3. Analysis.
  await page.getByRole('heading', { name: 'IDEA ANALYSIS' }).waitFor();
  for (const k of ['Concept', 'Main character', 'Goal', 'Conflict', 'Surprise', 'Emotional direction', 'Ending / Payoff']) assert(await page.locator('dt', { hasText: new RegExp(`^${k}$`) }).isVisible(), `analysis field ${k}`);
  assert(await page.getByTestId('weaknesses').isVisible(), 'weaknesses are called out');
  assert(await page.getByTestId('improved-idea').isVisible(), 'improved idea offered');
  assert((await page.locator('#analysis').innerText()).includes('surface of an alien planet'), 'analysis understood the idea');
  log('analysis →', await page.getByTestId('score').innerText(), '| weaknesses + improved idea shown');

  // 4. Five hooks.
  await page.locator('.hook').nth(4).waitFor();
  assert((await page.locator('.hook').count()) === 5, '5 hooks');
  assert((await page.getByRole('button', { name: 'SELECT', exact: true }).count()) === 5, '5 SELECT buttons');
  await page.locator('#analysis').scrollIntoViewIfNeeded();
  await shot('01-analysis-hooks', { fullPage: true });
  log('5 hooks with SELECT');

  // 5–9. Select a hook → story, scenes, image + video prompts.
  await page.getByTestId('hook-shock').getByRole('button', { name: 'SELECT' }).click();
  // Role-based: getByText would also match the "offline story engine" Demo Mode note.
  await page.getByRole('heading', { name: 'STORY ENGINE' }).waitFor();
  await page.getByTestId('scene').first().waitFor();
  assert(await page.getByTestId('hook-shock').getByRole('button', { name: '✓ SELECTED' }).isVisible(), 'hook marked selected');
  for (const t of ['EMOTIONAL ARC', 'PACING']) assert(await page.locator('#story h4', { hasText: t }).isVisible(), `story ${t}`);
  const scenes = await page.getByTestId('scene').count();
  assert(scenes === 7, `30s → 7 scenes, got ${scenes}`);
  assert(await page.getByText('Time: 24–30 sec').isVisible(), 'last scene ends at 30s');
  for (const k of ['REEL CONCEPT', 'SELECTED HOOK']) assert(await page.locator('#scenes dt', { hasText: k }).isVisible(), k);
  assert((await page.getByRole('button', { name: 'COPY IMAGE PROMPT' }).count()) === 7, 'copy image buttons');
  assert((await page.getByRole('button', { name: 'COPY VIDEO PROMPT' }).count()) === 7, 'copy video buttons');
  for (const k of ['pipe-idea', 'pipe-hook', 'pipe-story', 'pipe-scenes', 'pipe-prompts']) assert((await page.getByTestId(k).getAttribute('class')).includes('pipe-done'), `${k} done`);
  await page.locator('#story').scrollIntoViewIfNeeded();
  await shot('02-story');
  log('selected SHOCK hook → story + 7 scenes, workflow all done');

  // 10. Copy prompts.
  await page.getByRole('button', { name: 'COPY IMAGE PROMPT' }).nth(2).click();
  const img = await clipboard();
  assert(img.startsWith('Vertical 9:16 frame.') && img.includes('Lens:') && img.includes('iPhone 15 Pro'), 'image prompt copied (UGC style): ' + img.slice(0, 120));
  await page.getByRole('button', { name: 'COPY VIDEO PROMPT' }).nth(5).click();
  const vid = await clipboard();
  assert(vid.includes('Camera movement:') && vid.includes('Ending frame:') && vid.includes('olive bomber jacket'), 'video prompt copied with continuity');
  await page.getByRole('button', { name: 'COPY ALL' }).click();
  const all = await clipboard();
  assert(all.includes('## REEL CONCEPT') && all.includes('SCENE 07') && (all.match(/IMAGE PROMPT:/g) ?? []).length === 7, 'copy all');
  await page.getByTestId('scene').nth(5).scrollIntoViewIfNeeded();
  await shot('03-scenes');
  log('COPY IMAGE / VIDEO / ALL → clipboard verified');

  // 11–12. MAKE IT STRONGER → BEFORE / AFTER / WHY, apply.
  await page.getByRole('button', { name: '🔥 MAKE IT STRONGER' }).click();
  await page.getByRole('dialog').waitFor();
  for (const t of ['BEFORE', 'AFTER']) assert(await page.getByRole('dialog').locator('h4', { hasText: new RegExp(`^${t}$`) }).isVisible(), t);
  const impr = await page.getByTestId('improvement').count();
  assert(impr >= 5, `improvements: ${impr}`);
  assert((await page.getByText('WHY IT IS STRONGER').count()) === impr, 'why for each improvement');
  await shot('04-stronger');
  await page.getByRole('button', { name: 'Use stronger version' }).click();
  await page.getByText('v2 · stronger').waitFor();
  const lastTime = await page.getByTestId('scene').last().locator('.scene-time').innerText();
  assert(lastTime.endsWith('30 sec'), 'duration kept: ' + lastTime);
  log(`MAKE IT STRONGER → ${impr} improvements, applied as v2 (${lastTime})`);

  // A second pass has nothing structural left.
  await page.getByRole('button', { name: '🔥 MAKE IT STRONGER' }).click();
  await page.getByText(/no further structural improvements/).waitFor();
  log('second pass → honest "nothing left" message');

  // Reload keeps the reel; demo project can be reopened.
  await page.reload();
  await page.getByText('v2 · stronger').waitFor();
  await btn('Open demo project').click();
  await page.getByText('Demo project').first().waitFor();
  assert((await page.getByLabel('What do you want to create?').inputValue()).includes('динозавров'), 'demo idea restored');
  log('reload keeps the reel; demo project reopens');

  // Weak idea → blunt critique, "Use improved idea" reruns.
  await page.getByLabel('What do you want to create?').fill('кот спит');
  await btn('CREATE REEL').click();
  await page.getByTestId('improved-idea').waitFor();
  assert((await page.getByText('Weak idea').count()) === 1, 'weak verdict');
  await page.getByRole('button', { name: 'Use improved idea' }).click();
  await page.locator('.hook').nth(4).waitFor();
  assert((await page.getByLabel('What do you want to create?').inputValue()).startsWith('Кот спит, но'), 'improved idea placed in the field');
  log('weak idea → verdict + improved idea re-run');

  assert(errors.length === 0, 'browser errors:\n' + errors.join('\n'));
  console.log('\nE2E PASSED');
} finally {
  await browser.close();
}
