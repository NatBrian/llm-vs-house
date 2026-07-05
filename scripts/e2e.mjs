// End-to-end driver over the bundled Playwright chromium. Runs a baseline session
// for every game, captures screenshots, exercises the scrubber + replay-verify +
// compare dashboard, and reports any console/page errors.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE = [
  process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  process.env.HOME + '/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
].find(existsSync);

const OUT = process.argv[2] ?? '/tmp';
const URL = process.env.URL ?? 'http://localhost:5173/';
const GAMES = ['Roulette', 'Blackjack', 'Baccarat', 'Sic Bo', 'Slot Machine'];

const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
// Clear any persisted sessions for a clean run.
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

for (const game of GAMES) {
  await page.getByTitle(game, { exact: true }).click();
  await page.getByRole('button', { name: 'Run session' }).click();
  await page.waitForTimeout(3000); // let autoplay animate a few rounds
  const slug = game.toLowerCase().replace(/\s+/g, '');
  await page.screenshot({ path: `${OUT}/game-${slug}.png` });
  console.log(`captured ${game}`);
}

// Replay-verify on the last (Slot) session.
const verifyBtn = page.getByRole('button', { name: /Replay/ });
if (await verifyBtn.count()) {
  await verifyBtn.first().click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT}/reasoning.png` });

// Compare dashboard.
await page.getByRole('button', { name: 'compare' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/compare.png` });

// Report.
const sessionCount = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('llm-vs-house')).state.sessions.length; } catch { return -1; }
});
console.log('SESSIONS_PERSISTED', sessionCount);
console.log('ERRORS', errors.length);
console.log(errors.join('\n'));
await browser.close();
process.exit(errors.length ? 1 : 0);
