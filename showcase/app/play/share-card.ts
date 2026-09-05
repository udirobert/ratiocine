// Generates a visual share card as a canvas-rendered PNG blob (1200×630).
// Art direction matches the game: manuscript serif, per-puzzle generative
// motif at low opacity, wax-seal result chips, you-vs-machine duel panel.

import type { Puzzle, QueryGrade } from "./puzzle-data";
import type { AiResult } from "./ai-comparison";

const W = 1200;
const H = 630;

const SERIF = '"Fraunces", Georgia, "Times New Roman", serif';
const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// ─── Generative motif painters (canvas twins of play/motifs.tsx) ─────────────

function paintRiver(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y0 = 60 + i * 100;
    const amp = 22 + (i % 3) * 12;
    const phase = i * 1.7;
    ctx.globalAlpha = 0.08 + (i % 3) * 0.03;
    ctx.beginPath();
    for (let x = -80; x <= 1600; x += 20) {
      const y = y0 + Math.sin(phase + x / 180) * amp;
      if (x === -80) ctx.moveTo((x / 1440) * W, (y / 900) * H);
      else ctx.lineTo((x / 1440) * W, (y / 900) * H);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintSwell(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const corners: Array<[number, number]> = [
    [(-40 / 1440) * W, (940 / 900) * H],
    [(1480 / 1440) * W, (940 / 900) * H],
  ];
  let k = 0;
  for (let r = 140; r <= 1060; r += 100, k++) {
    ctx.globalAlpha = 0.07 + (k % 3) * 0.025;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, (r / 1440) * W, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function paintLattice(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.09;
  const s = 44;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 13; col++) {
      const x = ((col * 124 + (row % 2 ? 62 : 0) + 20) / 1440) * W;
      const y = ((row * 124 + 44) / 900) * H;
      const sx = (s / 1440) * W;
      const sy = (s / 900) * H;
      ctx.beginPath();
      ctx.moveTo(x, y - sy);
      ctx.lineTo(x + sx, y);
      ctx.lineTo(x, y + sy);
      ctx.lineTo(x - sx, y);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function paintTerrace(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y0 = 110 + i * 122;
    const dir = i % 2 === 0 ? 1 : -1;
    ctx.globalAlpha = 0.08 + (i % 2) * 0.03;
    ctx.beginPath();
    let x = -60;
    let y = y0;
    ctx.moveTo((x / 1440) * W, (y / 900) * H);
    for (let s = 0; s < 12; s++) {
      x += 128;
      ctx.lineTo((x / 1440) * W, (y / 900) * H);
      y += 15 * dir;
      ctx.lineTo((x / 1440) * W, (y / 900) * H);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintMeander(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.1;
  const u = 13;
  for (const bandY of [140, 430, 700]) {
    for (let x = -20; x < 1500; x += 4 * u + 26) {
      const px = (v: number) => (v / 1440) * W;
      const py = (v: number) => (v / 900) * H;
      ctx.beginPath();
      ctx.moveTo(px(x), py(bandY));
      ctx.lineTo(px(x + 4 * u), py(bandY));
      ctx.lineTo(px(x + 4 * u), py(bandY + 2 * u));
      ctx.lineTo(px(x + u), py(bandY + 2 * u));
      ctx.lineTo(px(x + u), py(bandY + u));
      ctx.lineTo(px(x + 3 * u), py(bandY + u));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

type MotifKind = "river" | "swell" | "lattice" | "terrace" | "meander";

const MOTIF_BY_PUZZLE: Record<string, MotifKind> = {
  "apurina-verb-agreement": "river",
  "maori-pronouns": "river",
  "swahili-person-tense": "swell",
  "indonesian-plurals": "swell",
  "turkish-vowel-harmony": "lattice",
  "esperanto-tense": "lattice",
  "zulu-noun-class": "lattice",
  "quechua-person-endings": "terrace",
  "finnish-harmony": "terrace",
  "nahuatl-both-ends": "meander",
};

function paintMotif(ctx: CanvasRenderingContext2D, puzzleId: string, color: string) {
  const kind = MOTIF_BY_PUZZLE[puzzleId] ?? "river";
  if (kind === "river") paintRiver(ctx, color);
  else if (kind === "swell") paintSwell(ctx, color);
  else if (kind === "lattice") paintLattice(ctx, color);
  else if (kind === "terrace") paintTerrace(ctx, color);
  else paintMeander(ctx, color);
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export async function generateShareCard(
  puzzle: Puzzle,
  grades: Map<number, QueryGrade>,
  elapsed: number,
  hintsUsed: number,
  aiResult: AiResult | null,
  streak = 0,
): Promise<Blob | null> {
  // Use the brand fonts if they've loaded in the page; fall back silently.
  try {
    await Promise.all([
      document.fonts.load('700 84px Fraunces'),
      document.fonts.load('italic 500 44px Fraunces'),
      document.fonts.load('500 20px "Geist Mono"'),
    ]);
  } catch {
    /* system fallbacks below */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { theme } = puzzle;
  const humanCorrect = puzzle.queries.filter((q) => grades.get(q.id)?.isCorrect).length;
  const total = puzzle.queries.length;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  // ─── Background: place-tint glow + motif + vignette ──
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.3, H * 1.1, 60, W * 0.3, H * 1.1, 620);
  glow.addColorStop(0, `${theme.bgTint ?? theme.accent}cc`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const glowTop = ctx.createRadialGradient(W * 0.85, -40, 20, W * 0.85, -40, 420);
  glowTop.addColorStop(0, `${theme.accent}26`);
  glowTop.addColorStop(1, "transparent");
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);

  paintMotif(ctx, puzzle.id, theme.accent);

  // Scan lines + grain whisper
  ctx.fillStyle = "rgba(255,255,255,0.014)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  // Vignette to hold the edges
  const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.95);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const LEFT = 84;

  // ─── Eyebrow ──
  ctx.fillStyle = theme.accent;
  ctx.fillRect(LEFT, 76, 12, 12);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 21px ${MONO}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`RATIOCINE  ·  ${puzzle.language.toUpperCase()}  ·  ${puzzle.region.toUpperCase()}`, LEFT + 26, 88);

  // ─── Language name, manuscript serif ──
  ctx.font = `700 88px ${SERIF}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(puzzle.language, LEFT, 190);

  // Accent rule under the name
  const nameWidth = ctx.measureText(puzzle.language).width;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(LEFT, 208, Math.min(nameWidth, 320), 4);

  // Task frame, italic
  ctx.font = `italic 500 30px ${SERIF}`;
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(puzzle.taskFrame, LEFT, 258);

  // ─── Result seals — wax for correct, ash for missed ──
  const chip = 64;
  const gap = 14;
  const gridY = 312;
  puzzle.queries.forEach((q, i) => {
    const g = grades.get(q.id);
    const x = LEFT + i * (chip + gap);
    const correct = g?.isCorrect ?? false;
    const revealed = g?.revealed ?? false;

    ctx.beginPath();
    ctx.roundRect(x, gridY, chip, chip, 10);
    if (correct) {
      ctx.fillStyle = `${theme.accent}2e`;
      ctx.fill();
      ctx.strokeStyle = `${theme.accent}90`;
    } else {
      ctx.fillStyle = revealed ? "rgba(255,255,255,0.05)" : "rgba(248,113,113,0.14)";
      ctx.fill();
      ctx.strokeStyle = revealed ? "rgba(255,255,255,0.25)" : "rgba(248,113,113,0.5)";
    }
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = `700 26px ${SANS}`;
    ctx.fillStyle = correct ? theme.accent : revealed ? "rgba(255,255,255,0.6)" : "rgba(248,113,113,0.85)";
    ctx.fillText(correct ? "✓" : revealed ? "🔍" : "✗", x + chip / 2, gridY + 42);
  });

  // ─── Duel line ──
  ctx.textAlign = "left";
  const duelY = 452;
  ctx.font = `700 52px ${SANS}`;
  ctx.fillStyle = theme.accent;
  ctx.fillText(`${humanCorrect}/${total}`, LEFT, duelY);
  const youW = ctx.measureText(`${humanCorrect}/${total}`).width;

  ctx.font = `500 22px ${MONO}`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("YOU", LEFT, duelY + 34);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillText(`${timeStr} · ${hintsUsed > 0 ? `${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}` : "no hints"}`, LEFT + 90, duelY + 34);

  ctx.font = `500 22px ${MONO}`;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  const vsX = LEFT + youW + 36;
  ctx.fillText("vs", vsX, duelY);

  let verdict: string;
  if (aiResult) {
    const aiCorrect = puzzle.queries.filter((q, i) =>
      (aiResult.pred[i] || "").trim().toLowerCase() === q.answerJoined.toLowerCase(),
    ).length;
    const aiX = vsX + 70;
    ctx.font = `700 52px ${SANS}`;
    ctx.fillStyle = "rgba(56,189,248,0.92)";
    ctx.textAlign = "left";
    ctx.fillText(`${aiCorrect}/${total}`, aiX, duelY);
    ctx.font = `500 22px ${MONO}`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("MACHINE", aiX, duelY + 34);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    const modelShort = aiResult.model.split("/").pop() ?? aiResult.model;
    ctx.fillText(`${aiResult.elapsed_s}s · ${modelShort}`, aiX + 150, duelY + 34);

    verdict =
      humanCorrect > aiCorrect
        ? "Beat the machine."
        : humanCorrect === aiCorrect
          ? "A tie — rematch tomorrow."
          : "The machine got more — this time.";
  } else {
    ctx.font = `500 22px ${MONO}`;
    ctx.fillStyle = "rgba(56,189,248,0.7)";
    ctx.fillText("MACHINE: PENDING — CAN IT DO IT TOO?", vsX + 70, duelY - 14);
    verdict = "Can the machine do it too?";
  }

  // Verdict, manuscript italic
  ctx.textAlign = "left";
  ctx.font = `italic 500 34px ${SERIF}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(verdict, LEFT, 548);

  // ─── Right rail: streak pill + wordmark ──
  ctx.textAlign = "right";
  if (streak > 1) {
    const pill = `🔥 ${streak}-day streak`;
    ctx.font = `500 24px ${MONO}`;
    const pw = ctx.measureText(pill).width;
    const px = W - 84 - pw - 44;
    ctx.beginPath();
    ctx.roundRect(px, 64, pw + 44, 52, 26);
    ctx.fillStyle = `${theme.accent}1f`;
    ctx.fill();
    ctx.strokeStyle = `${theme.accent}66`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.fillText(pill, W - 84 - 22, 98);
  }

  ctx.font = `700 30px ${SERIF}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("ratiocine", W - 84, H - 88);
  ctx.font = `500 19px ${MONO}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("same puzzle · same grading", W - 84, H - 58);

  // ─── Export ──
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
