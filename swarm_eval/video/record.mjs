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

// scene file -> duration seconds (narration + padding)
const DURS = {
  "01-title.html": 15,
  "02-testbed.html": 26,
  "03-conditions.html": 22,
  "05-poison.html": 26,
  "06-failures.html": 30,
  "07-monitor.html": 24,
  "08-close.html": 20,
};

const files = readdirSync(SCENES).filter((f) => f.endsWith(".html")).sort();
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const f of files) {
  const dur = DURS[f] ?? 15;
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
