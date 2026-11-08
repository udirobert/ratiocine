// Re-record specific scenes at corrected durations.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(HERE, "scenes");
const OUT = resolve(HERE, "footage");
mkdirSync(OUT, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const JOBS = [
  ["06-contagion.html", 9.5],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const [f, dur] of JOBS) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  await page.goto("file://" + resolve(SCENES, f));
  await page.waitForTimeout(dur * 1000);
  const video = page.video();
  await ctx.close();
  if (video) console.log(f, "->", await video.path());
}
await browser.close();
console.log("DONE");
