// Headless screenshot + console/error capture using the bundled Playwright chromium.
// Usage: node scripts/shot.mjs <url> <outPng> [waitMs]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE_CANDIDATES = [
  process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  process.env.HOME + '/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
];
const executablePath = EXE_CANDIDATES.find(existsSync);
if (!executablePath) { console.error('no chromium found'); process.exit(2); }

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'shot.png';
const waitMs = Number(process.argv[4] ?? 1500);

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
} catch (e) {
  logs.push(`[goto-error] ${e.message}`);
}
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out, fullPage: false });
console.log('SHOT', out);
console.log('--- console ---');
console.log(logs.join('\n') || '(no console output)');
await browser.close();
