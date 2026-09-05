// ─── Field FX bus ─────────────────────────────────────────────────────────────
// Tiny decoupled channel so game rituals (correct / wrong / solve) can trigger
// moments in the AmbientWorld shader without prop-drilling through phases.
// Coordinates are viewport-normalized (0..1, y down as emitted by DOM events).

export type FieldRippleKind = "correct" | "wrong" | "bloom";

type RippleHandler = (x: number, y: number, kind: FieldRippleKind) => void;

let handler: RippleHandler | null = null;

export const onFieldRipple = (cb: RippleHandler): (() => void) => {
  handler = cb;
  return () => {
    if (handler === cb) handler = null;
  };
};

export const emitFieldRipple = (
  x = 0.5,
  y = 0.55,
  kind: FieldRippleKind = "correct",
) => {
  handler?.(x, y, kind);
};
