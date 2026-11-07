// Record each HTML scene to WebM via Playwright + system Chrome.
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(HERE, "scenes");
const OUT = resolve(HERE, "footage");
mkdirSync(OUT, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// scene number -> duration seconds (narration + padding)
const DURS = { 1: 14.5, 2: 23.5, 3: 21.5, 4: 18.0, 5: 26.5, 6: 24.0, 7: 17.5, 8: 19.5 };

const files = readdirSync(SCENES).filter((f) => f.endsWith(".html")).sort();
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const f of files) {
  const n = parseInt(f.slice(0, 2), 10);
  const dur = DURS[n] ?? 15;
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  await page.goto("file://" + resolve(SCENES, f));
  await page.waitForTimeout(dur * 1000);
  const video = page.video();
  await ctx.close();
  if (video) {
    const p = await video.path();
    console.log(f, "->", p);
  }
}
await browser.close();
console.log("DONE");
