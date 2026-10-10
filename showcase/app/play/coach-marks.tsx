"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/button";

const COACH_KEY = "ratiocine-seen-coach";

export const hasSeenCoach = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COACH_KEY) === "1";
  } catch {
    return false;
  }
};

const WARMUP_KEY = "ratiocine-seen-warmup";

export const hasSeenWarmup = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WARMUP_KEY) === "1";
  } catch {
    return false;
  }
};

export const markWarmupSeen = () => {
  try {
    window.localStorage.setItem(WARMUP_KEY, "1");
  } catch {}
};

interface CoachMarksProps {
  onDismiss: () => void;
  accent: string;
}

// Invented micro-language for the three-step demo: mi- = "my", su- = "your",
// -ka = "dog", -tu = "cat". Tiny enough to teach the whole loop in one card.
const DEMO_PAIRS = [
  { source: "mi-ka", target: "my dog" },
  { source: "mi-tu", target: "my cat" },
  { source: "su-ka", target: "your dog" },
];

const DemoSource = ({ text, highlight }: { text: string; highlight: boolean }) => (
  <span className="font-mono">
    {text.split("-").map((part, i, arr) => (
      <span key={i}>
        <span
          className={
            highlight && part === "mi"
              ? "pa-bg-20 pa-text rounded px-0.5"
              : undefined
          }
        >
          {part}
        </span>
        {i < arr.length - 1 ? "-" : ""}
      </span>
    ))}
  </span>
);

const STEP_TITLES = ["Compare", "Isolate", "Test"];

export const CoachMarks = ({ onDismiss, accent }: CoachMarksProps) => {
  const [step, setStep] = useState(0);
  const [miSelected, setMiSelected] = useState(false);
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = "coach-marks-title";

  const finish = () => {
    try {
      window.localStorage.setItem(COACH_KEY, "1");
    } catch {}
    onDismiss();
  };

  // Move focus into the dialog, trap Tab inside it, Escape skips, and hand
  // focus back to whatever opened the card.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const focusables = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = step === STEP_TITLES.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="archive-card relative w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl"
      >
        <button
          onClick={finish}
          className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Skip intro"
        >
          ×
        </button>

        <h3
          id={headingId}
          className="font-display text-xl font-bold text-white mb-4 leading-tight text-center"
        >
          {STEP_TITLES[step]}
        </h3>

        <div className="min-h-[190px] flex flex-col justify-center">
          {step === 0 && (
            <div className="space-y-2">
              {DEMO_PAIRS.map((p) => (
                <div
                  key={p.source}
                  className="archive-card rounded-lg px-4 py-2.5 flex items-center gap-3 text-[13px]"
                >
                  <span className="font-mono text-sky-300 flex-1">{p.source}</span>
                  <span className="text-white/40" aria-hidden="true">→</span>
                  <span className="text-white/70 flex-1">{p.target}</span>
                </div>
              ))}
              <p className="text-[11px] text-white/55 font-mono text-center pt-1">
                Two words share a piece. Two meanings share a word.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {DEMO_PAIRS.map((p) => (
                <button
                  key={p.source}
                  type="button"
                  onClick={() => setMiSelected((s) => !s)}
                  className="archive-card w-full rounded-lg px-4 py-2.5 flex items-center gap-3 text-[13px] text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                >
                  <span className="text-sky-300 flex-1">
                    <DemoSource text={p.source} highlight={miSelected} />
                  </span>
                  <span className="text-white/40" aria-hidden="true">→</span>
                  <span className="text-white/70 flex-1">{p.target}</span>
                </button>
              ))}
              <p className="text-[11px] font-mono text-center pt-1">
                {miSelected ? (
                  <span className="pa-text">&ldquo;mi&rdquo; is in both rows — and both mean &ldquo;my&rdquo;. So mi = my.</span>
                ) : (
                  <span className="text-white/55">tap a row to highlight the shared piece</span>
                )}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                {["su", "tu"].map((tile, i) => (
                  <motion.span
                    key={tile}
                    initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: reduceMotion ? 0 : 0.35 + i * 0.45, type: "spring", stiffness: 320, damping: 22 }}
                    className="tablet px-3 py-2 rounded font-mono text-[13px] border border-white/10 text-white/85"
                  >
                    {tile}
                  </motion.span>
                ))}
              </div>
              <motion.p
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 1.4 }}
                className="font-mono text-[13px] text-white/70"
              >
                su-tu = <span className="pa-text">your cat</span>
              </motion.p>
              <p className="text-[11px] text-white/55 font-mono text-center">
                Build your answer from the pieces you proved.
              </p>
            </div>
          )}
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mt-4" aria-hidden="true">
          {STEP_TITLES.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i === step ? accent : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="tertiary" size="md" onClick={finish}>
            Skip
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
          >
            {last ? "Start playing" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
