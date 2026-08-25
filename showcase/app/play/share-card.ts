// Generates a visual share card as a canvas-rendered PNG blob.
// 1200×630 (OG image dimensions) with:
// - Language name + theme accent
// - Card-flip grid (✓/✗ colored boxes)
// - Human vs AI comparison
// - URL

import type { Puzzle, QueryGrade } from "./puzzle-data";
import type { AiResult } from "./ai-comparison";

const W = 1200;
const H = 630;

export async function generateShareCard(
  puzzle: Puzzle,
  grades: Map<number, QueryGrade>,
  elapsed: number,
  hintsUsed: number,
  aiResult: AiResult | null,
): Promise<Blob | null> {
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

  // ─── Background ─────────────────────────────────────────────────────────
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, W, H);

  // Subtle radial gradient from theme
  const grad = ctx.createRadialGradient(W / 2, H, 100, W / 2, H, 500);
  grad.addColorStop(0, `${theme.bgTint}30`);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Faint scan lines
  ctx.fillStyle = "rgba(255,255,255,0.015)";
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }

  // ─── Language name ──────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(puzzle.language, W / 2, 100);

  // Accent underline
  const nameWidth = ctx.measureText(puzzle.language).width;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(W / 2 - nameWidth / 2, 130, nameWidth, 3);

  // Region subtitle
  ctx.font = "16px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(puzzle.region, W / 2, 160);

  // ─── Result grid (centered) ─────────────────────────────────────────────
  const boxSize = 56;
  const boxGap = 12;
  const gridWidth = total * boxSize + (total - 1) * boxGap;
  const gridX = (W - gridWidth) / 2;
  const gridY = 220;

  for (let i = 0; i < total; i++) {
    const q = puzzle.queries[i];
    const correct = grades.get(q.id)?.isCorrect;
    const x = gridX + i * (boxSize + boxGap);

    // Box
    ctx.fillStyle = correct ? `${theme.accent}35` : "rgba(248,113,113,0.2)";
    roundRect(ctx, x, gridY, boxSize, boxSize, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = correct ? `${theme.accent}80` : "rgba(248,113,113,0.5)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, gridY, boxSize, boxSize, 8);
    ctx.stroke();

    // Symbol
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = correct ? theme.accent : "rgba(248,113,113,0.8)";
    ctx.textAlign = "center";
    ctx.fillText(correct ? "✓" : "✗", x + boxSize / 2, gridY + boxSize / 2);
  }

  // ─── Comparison ─────────────────────────────────────────────────────────
  const compY = 340;

  // Human
  ctx.textAlign = "center";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillStyle = theme.accent;
  ctx.fillText(`${humanCorrect}/${total}`, W / 2 - 180, compY);

  ctx.font = "14px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("YOU", W / 2 - 180, compY + 36);
  ctx.fillText(`${timeStr} · ${hintsUsed > 0 ? `${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}` : "no hints"}`, W / 2 - 180, compY + 56);

  // VS
  ctx.font = "16px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText("vs", W / 2, compY);

  // AI
  if (aiResult) {
    const aiCorrect = puzzle.queries.filter((q, i) =>
      (aiResult.pred[i] || "").trim().toLowerCase() === q.answerJoined.toLowerCase()
    ).length;

    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.fillStyle = "rgba(56,189,248,0.9)"; // sky-400
    ctx.fillText(`${aiCorrect}/${total}`, W / 2 + 180, compY);

    ctx.font = "14px ui-monospace, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("MACHINE", W / 2 + 180, compY + 36);
    ctx.fillText(`${aiResult.elapsed_s}s · ${aiResult.model.split("/").pop()}`, W / 2 + 180, compY + 56);
  }

  // ─── Verdict ────────────────────────────────────────────────────────────
  const verdictY = 470;
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";

  if (aiResult) {
    const aiCorrect = puzzle.queries.filter((q, i) =>
      (aiResult.pred[i] || "").trim().toLowerCase() === q.answerJoined.toLowerCase()
    ).length;
    if (humanCorrect > aiCorrect) {
      ctx.fillText("Beat the machine.", W / 2, verdictY);
    } else if (humanCorrect === aiCorrect) {
      ctx.fillText("Tied.", W / 2, verdictY);
    } else {
      ctx.fillText("The machine got more — this time.", W / 2, verdictY);
    }
  }

  // ─── Footer ─────────────────────────────────────────────────────────────
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("ratiocine.vercel.app/play", W / 2, H - 50);

  ctx.font = "12px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillText("Same puzzle. Same grading. Honest comparison.", W / 2, H - 28);

  // ─── Export ─────────────────────────────────────────────────────────────
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
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
