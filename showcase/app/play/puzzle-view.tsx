"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { ContextPanel } from "./context-panel";
import { MorphemeBank } from "./morpheme-bank";
import { AnswerSlots, type SlotData } from "./answer-slots";
import {
  getTodaysPuzzle,
  gradeAnswer,
  type Puzzle,
  type QueryGrade,
  type TileGrade,
} from "./puzzle-data";

// ─── Share card generation ──────────────────────────────────────────────────

function generateShareText(
  puzzle: Puzzle,
  grades: QueryGrade[],
  elapsed: number,
  hintsUsed: number,
): string {
  const emojiMap: Record<TileGrade, string> = {
    correct: "🟩",
    misplaced: "🟨",
    wrong: "⬛",
  };

  const lines = grades.map(
    (g) => g.grades.map((t) => emojiMap[t]).join(""),
  );

  const allCorrect = grades.every((g) => g.isCorrect);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const time = `${mins}:${secs.toString().padStart(2, "0")}`;

  return [
    `🧩 Ration — ${puzzle.language}`,
    ...lines,
    `${allCorrect ? "Solved" : "Attempted"} in ${time}${hintsUsed > 0 ? ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}` : ""}`,
    `ratiocine.vercel.app`,
  ].join("\n");
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface PuzzleViewProps {
  onBack?: () => void;
}

export const PuzzleView = ({ onBack }: PuzzleViewProps) => {
  const puzzle = useMemo(() => getTodaysPuzzle(), []);

  // State per query: array of slots
  const [answers, setAnswers] = useState<SlotData[][]>(() =>
    puzzle.queries.map(() => [{ morpheme: null }, { morpheme: null }, { morpheme: null }]),
  );

  const [selectedMorpheme, setSelectedMorpheme] = useState<string | null>(null);
  const [grades, setGrades] = useState<QueryGrade[]>([]);
  const [isGraded, setIsGraded] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [revealedMorphemes, setRevealedMorphemes] = useState<Map<string, string>>(new Map());
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Stop timer on grade
  useEffect(() => {
    if (isGraded && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isGraded]);

  // Morpheme usage tracking (for bank display)
  const usedMorphemes = useMemo(() => {
    const map = new Map<string, number>();
    answers.flat().forEach((slot) => {
      if (slot.morpheme) {
        map.set(slot.morpheme, (map.get(slot.morpheme) || 0) + 1);
      }
    });
    return map;
  }, [answers]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleMorphemeSelect = useCallback((morpheme: string) => {
    setSelectedMorpheme((prev) => (prev === morpheme ? null : morpheme));
  }, []);

  const handleSlotTap = useCallback(
    (queryId: number, slotIndex: number) => {
      if (isGraded || !selectedMorpheme) return;

      setAnswers((prev) => {
        const next = [...prev];
        const queryIdx = queryId - 1;
        const slots = [...next[queryIdx]];

        // If tapping beyond current slots, add a new one
        if (slotIndex >= slots.length) {
          slots.push({ morpheme: selectedMorpheme });
        } else {
          slots[slotIndex] = { morpheme: selectedMorpheme };
        }

        next[queryIdx] = slots;
        return next;
      });

      setSelectedMorpheme(null);
    },
    [isGraded, selectedMorpheme],
  );

  const handleSlotRemove = useCallback(
    (queryId: number, slotIndex: number) => {
      if (isGraded) return;

      setAnswers((prev) => {
        const next = [...prev];
        const queryIdx = queryId - 1;
        const slots = [...next[queryIdx]];
        slots.splice(slotIndex, 1);
        // Keep at least one empty slot
        if (slots.length === 0) {
          slots.push({ morpheme: null });
        }
        next[queryIdx] = slots;
        return next;
      });
    },
    [isGraded],
  );

  const handleSubmit = useCallback(() => {
    const results = puzzle.queries.map((query, i) => {
      const submitted = answers[i]
        .filter((s) => s.morpheme !== null)
        .map((s) => s.morpheme!);
      return gradeAnswer(query, submitted);
    });

    // Apply grades back to slots
    setAnswers((prev) => {
      const next = [...prev];
      results.forEach((result, qi) => {
        const slots = [...next[qi]];
        const filledSlots = slots.filter((s) => s.morpheme !== null);
        let gradeIdx = 0;
        for (let i = 0; i < slots.length; i++) {
          if (slots[i].morpheme !== null && gradeIdx < result.grades.length) {
            slots[i] = { ...slots[i], grade: result.grades[gradeIdx] };
            gradeIdx++;
          }
        }
        next[qi] = slots;
      });
      return next;
    });

    setGrades(results);
    setIsGraded(true);

    // Show share if all correct
    const allCorrect = results.every((r) => r.isCorrect);
    if (allCorrect) {
      setTimeout(() => setShowShare(true), 800);
    }
  }, [puzzle.queries, answers]);

  const handleHint = useCallback(() => {
    if (hintsUsed >= puzzle.hints.length) return;

    const hint = puzzle.hints[hintsUsed];
    setHintsUsed((h) => h + 1);
    setHintMessage(hint.text);

    if (hint.type === "highlight" && hint.highlightRows) {
      setHighlightedRows((prev) => {
        const next = new Set(prev);
        hint.highlightRows!.forEach((r) => next.add(r));
        return next;
      });
    }

    if (hint.type === "reveal" && hint.revealMorpheme) {
      setRevealedMorphemes((prev) => {
        const next = new Map(prev);
        next.set(hint.revealMorpheme!.morpheme, hint.revealMorpheme!.meaning);
        return next;
      });
    }

    // Auto-dismiss hint message after 5s
    setTimeout(() => setHintMessage(null), 5000);
  }, [hintsUsed, puzzle.hints]);

  const handleShare = useCallback(async () => {
    const text = generateShareText(puzzle, grades, elapsed, hintsUsed);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select a textarea
      prompt("Copy your result:", text);
    }
  }, [puzzle, grades, elapsed, hintsUsed]);

  const handleReset = useCallback(() => {
    setAnswers(puzzle.queries.map(() => [{ morpheme: null }, { morpheme: null }, { morpheme: null }]));
    setSelectedMorpheme(null);
    setGrades([]);
    setIsGraded(false);
    setHintsUsed(0);
    setHighlightedRows(new Set());
    setRevealedMorphemes(new Map());
    setHintMessage(null);
    setShowShare(false);
    setCopied(false);
    setElapsed(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [puzzle.queries]);

  // ─── Format timer ─────────────────────────────────────────────────────────

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  // ─── Render ───────────────────────────────────────────────────────────────

  const allCorrect = grades.length > 0 && grades.every((g) => g.isCorrect);
  const hasContent = answers.some((a) => a.some((s) => s.morpheme !== null));

  return (
    <div className="relative flex flex-col h-svh w-full overflow-hidden bg-[#0d0f14] text-white">
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-white/40 hover:text-white/70 transition-colors text-sm"
                aria-label="Back"
              >
                ←
              </button>
            )}
            <div>
              <h1 className="text-base font-bold leading-tight">
                {puzzle.language}
                <span className="text-white/40 font-normal"> — {puzzle.title}</span>
              </h1>
              <p className="text-[11px] text-white/40 font-mono">
                {puzzle.family} · {puzzle.region}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer */}
            <span className="font-mono text-sm text-white/50 tabular-nums">
              {timeStr}
            </span>

            {/* Hint button */}
            {!isGraded && (
              <button
                onClick={handleHint}
                disabled={hintsUsed >= puzzle.hints.length}
                className="px-2.5 py-1.5 rounded-md border border-white/15 text-[11px] font-mono text-amber-300/70 hover:text-amber-300 hover:border-amber-300/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Hint ({puzzle.hints.length - hintsUsed})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Instruction */}
          <p className="text-sm text-white/60 leading-relaxed">
            {puzzle.instruction}
          </p>

          {/* Hint message */}
          <AnimatePresence>
            {hintMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-200/80"
              >
                💡 {hintMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Context */}
          <ContextPanel pairs={puzzle.pairs} highlightedRows={highlightedRows} />

          {/* Answers */}
          <div className="space-y-3">
            <span className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
              Your Answers
            </span>
            {puzzle.queries.map((query, i) => (
              <AnswerSlots
                key={query.id}
                queryId={query.id}
                prompt={query.prompt}
                slots={answers[i]}
                isGraded={isGraded}
                isCorrect={grades[i]?.isCorrect ?? false}
                selectedMorpheme={selectedMorpheme}
                onSlotTap={handleSlotTap}
                onSlotRemove={handleSlotRemove}
              />
            ))}
          </div>

          {/* Morpheme Bank */}
          {!isGraded && (
            <MorphemeBank
              morphemes={puzzle.morphemeBank}
              usedMorphemes={usedMorphemes}
              selectedMorpheme={selectedMorpheme}
              onSelect={handleMorphemeSelect}
              revealedMorphemes={revealedMorphemes}
            />
          )}

          {/* Success message */}
          <AnimatePresence>
            {allCorrect && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4"
              >
                <p className="text-lg font-bold text-emerald-400">
                  You cracked {puzzle.language}!
                </p>
                <p className="text-sm text-white/50 mt-1">
                  Solved in {timeStr} with {hintsUsed} hint{hintsUsed !== 1 ? "s" : ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom action bar */}
      <footer className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {!isGraded ? (
            <>
              <button
                onClick={handleReset}
                disabled={!hasContent}
                className="px-3 py-2 rounded-md text-sm text-white/40 hover:text-white/70 disabled:opacity-0 transition-all"
              >
                Clear
              </button>
              <button
                onClick={handleSubmit}
                disabled={!hasContent}
                className="px-5 py-2.5 rounded-md bg-amber-500/90 text-sm font-semibold text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
              >
                Submit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-md text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={handleShare}
                className="px-5 py-2.5 rounded-md border border-white/20 bg-white/[0.06] text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
              >
                {copied ? "Copied!" : "Share result"}
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
