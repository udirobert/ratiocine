// CRT screen renderer — draws the hero content onto the 562x408 canvas
// that gets sampled as a THREE.CanvasTexture by the Mac GLB scene.

export const SCREEN_W = 562;
export const SCREEN_H = 408;

// ─── Hero content for the CRT ───────────────────────────────────────────────

const TITLE = "ratiocine";
const TAGLINE = "Crack the pattern.";
const TAGLINE_2 = "Then watch the machine try.";
const FOOTER = "IOL-AI 2026 Competitor";
const SCORE = "0.1141";

// Typewriter state
let charCount = 0;
let lastFrame = 0;
const CHARS_PER_SEC = 18;
let skipMode = false;

// Solved state
export interface SolvedData {
  language: string;
  score: number;
  total: number;
  verdict: string;
  accentColor: string;
  timeStr: string;
}
let solvedState: SolvedData | null = null;

export function setSkipTypewriter(skip: boolean) {
  skipMode = skip;
  if (skip) {
    charCount = 9999;
  }
}

export function setSolvedState(data: SolvedData | null) {
  solvedState = data;
}

export const drawScreen = (
  ctx: CanvasRenderingContext2D,
  _lineIndex: number,
  _scoreIndex: number,
): void => {
  const now = performance.now();

  // If solved, draw the result screen instead
  if (solvedState) {
    drawSolvedScreen(ctx, solvedState, now);
    return;
  }

  // Advance typewriter
  if (lastFrame === 0) lastFrame = now;
  const dt = now - lastFrame;
  lastFrame = now;
  if (!skipMode) {
    charCount += (dt / 1000) * CHARS_PER_SEC;
  }

  const totalChars = TITLE.length + TAGLINE.length + TAGLINE_2.length;
  const progress = Math.min(charCount, totalChars);

  // Background
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Subtle scan lines
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let y = 0; y < SCREEN_H; y += 3) {
    ctx.fillRect(0, y, SCREEN_W, 1);
  }

  // ─── Title ────────────────────────────────────────────────────────────────
  const centerX = SCREEN_W / 2;
  const titleY = 145;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 42px ui-sans-serif, system-ui, -apple-system, sans-serif";

  const titleVisible = Math.min(progress, TITLE.length);
  const titleText = TITLE.slice(0, titleVisible);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(titleText, centerX, titleY);

  // Cursor after title
  if (titleVisible < TITLE.length) {
    const metrics = ctx.measureText(titleText);
    const cursorX = centerX + metrics.width / 2 + 2;
    ctx.fillStyle = blink() ? "#e5a84b" : "transparent";
    ctx.fillRect(cursorX, titleY - 16, 2, 32);
  }

  // ─── Tagline ──────────────────────────────────────────────────────────────
  const tagY = 205;
  const tag2Y = 228;

  if (progress > TITLE.length) {
    const tagProgress = Math.min(progress - TITLE.length, TAGLINE.length);
    const tagText = TAGLINE.slice(0, tagProgress);
    ctx.font = "15px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(tagText, centerX, tagY);

    if (tagProgress >= TAGLINE.length && progress > TITLE.length + TAGLINE.length) {
      const tag2Progress = Math.min(
        progress - TITLE.length - TAGLINE.length,
        TAGLINE_2.length,
      );
      const tag2Text = TAGLINE_2.slice(0, tag2Progress);
      ctx.fillText(tag2Text, centerX, tag2Y);

      // Cursor after second line
      if (tag2Progress < TAGLINE_2.length) {
        const m2 = ctx.measureText(tag2Text);
        const cx = centerX + m2.width / 2 + 2;
        ctx.fillStyle = blink() ? "#e5a84b" : "transparent";
        ctx.fillRect(cx, tag2Y - 7, 2, 14);
      }
    } else if (tagProgress < TAGLINE.length) {
      // Cursor after first tagline
      const m1 = ctx.measureText(tagText);
      const cx = centerX + m1.width / 2 + 2;
      ctx.fillStyle = blink() ? "#e5a84b" : "transparent";
      ctx.fillRect(cx, tagY - 7, 2, 14);
    }
  }

  // ─── Play prompt (appears after typewriter completes) ─────────────────────
  if (progress >= totalChars) {
    const playY = 285;
    const pulse = 0.6 + Math.sin(now / 600) * 0.2;

    // Play button outline
    ctx.strokeStyle = `rgba(229, 168, 75, ${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, centerX - 60, playY - 16, 120, 32, 16);
    ctx.stroke();

    // Fill
    ctx.fillStyle = `rgba(229, 168, 75, ${pulse * 0.08})`;
    ctx.beginPath();
    roundRect(ctx, centerX - 60, playY - 16, 120, 32, 16);
    ctx.fill();

    // Text
    ctx.font = "bold 13px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.fillStyle = `rgba(229, 168, 75, ${pulse + 0.2})`;
    ctx.textAlign = "center";
    ctx.fillText("▶  P L A Y", centerX, playY);
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  if (progress >= totalChars) {
    ctx.font = "9px ui-monospace, 'SF Mono', Menlo, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    ctx.fillText(`${FOOTER}  ·  Score ${SCORE}`, centerX, SCREEN_H - 30);
  }

  ctx.textAlign = "left";
};

// ─── Solved screen ──────────────────────────────────────────────────────────

function drawSolvedScreen(ctx: CanvasRenderingContext2D, data: SolvedData, now: number): void {
  const centerX = SCREEN_W / 2;

  // Background
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Subtle scan lines
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let y = 0; y < SCREEN_H; y += 3) {
    ctx.fillRect(0, y, SCREEN_W, 1);
  }

  // Faint accent glow at bottom
  const grad = ctx.createRadialGradient(centerX, SCREEN_H, 20, centerX, SCREEN_H, 200);
  grad.addColorStop(0, `${data.accentColor}15`);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Score — big
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 64px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = data.score === data.total ? data.accentColor : "#ffffff";
  ctx.fillText(`${data.score}/${data.total}`, centerX, 140);

  // Verdict
  ctx.font = "16px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(data.verdict, centerX, 195);

  // Language
  ctx.font = "12px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = `${data.accentColor}99`;
  ctx.fillText(data.language.toUpperCase(), centerX, 235);

  // Time
  ctx.font = "11px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText(data.timeStr, centerX, 260);

  // "Play again" prompt (pulsing)
  const playY = 320;
  const pulse = 0.5 + Math.sin(now / 700) * 0.2;

  ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.3})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, centerX - 55, playY - 14, 110, 28, 14);
  ctx.stroke();

  ctx.font = "bold 11px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.5 + 0.2})`;
  ctx.fillText("P L A Y  A G A I N", centerX, playY);

  // Footer
  ctx.font = "9px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("ratiocine · same puzzle, same grading", centerX, SCREEN_H - 30);

  ctx.textAlign = "left";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function blink(): boolean {
  return Math.floor(performance.now() / 530) % 2 === 0;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
