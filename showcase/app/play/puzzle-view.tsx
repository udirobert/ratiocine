"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { ContextPanel } from "./context-panel";
import { MorphemeBank } from "./morpheme-bank";
import { AnswerSlots, type SlotData } from "./answer-slots";
import { LorePanel } from "./lore-panel";
import { SuccessReveal } from "./success-reveal";
import {
  getTodaysPuzzle,
  gradeAnswer,
  loadProgress,
  recordSolve,
  type Puzzle,
  type PuzzleProgress,
  type QueryGrade,
  type TileGrade,
} from "./puzzle-data";

// ─── Share card generation ──────────────────────────────────────────────────

function generateShareText(
  puzzle: Puzzle,
  grades: Map<number, QueryGrade>,
  elapsed: number,
  hintsUsed: number,
  contextReveals: number,
): string {
  const emojiMap: Record<TileGrade, string> = {
    correct: "🟩",
    misplaced: "🟨",
    wrong: "⬛",
  };

  const lines = puzzle.queries.map((q) => {
    const g = grades.get(q.id);
    if (!g) return "⬜⬜⬜";
    const emoji = g.grades.map((t) => emojiMap[t]).join("");
    const attempts = g.attempt > 1 ? ` (×${g.attempt})` : "";
    return emoji + attempts;
  });

  const allCorrect = puzzle.queries.every((q) => grades.get(q.id)?.isCorrect);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const time = `${mins}:${secs.toString().padStart(2, "0")}`;

  const stats: string[] = [];
  if (hintsUsed > 0) stats.push(`${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}`);
  if (contextReveals > 0) stats.push(`${contextReveals} reveal${contextReveals > 1 ? "s" : ""}`);

  return [
    `🧩 Ration — ${puzzle.language} (${puzzle.title})`,
    ...lines,
    `${allCorrect ? "Cracked" : "Attempted"} in ${time}${stats.length ? " · " + stats.join(", ") : ""}`,
    `ratiocine.vercel.app`,
  ].join("\n");
}

// ─── Per-query state ────────────────────────────────────────────────────────

interface QueryState {
  slots: SlotData[];
  attempts: number;
  locked: boolean; // locked after 2 attempts or correct
  grade: QueryGrade | null;
  showHintOnFail: boolean;
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface PuzzleViewProps {
  onBack?: () => void;
}

export const PuzzleView = ({ onBack }: PuzzleViewProps) => {
  const puzzle = useMemo(() => getTodaysPuzzle(), []);

  // Per-query state
  const [queryStates, setQueryStates] = useState<QueryState[]>(() =>
    puzzle.queries.map(() => ({
      slots: [{ morpheme: null }, { morpheme: null }, { morpheme: null }],
      attempts: 0,
      locked: false,
      grade: null,
      showHintOnFail: false,
    })),
  );

  const [selectedMorpheme, setSelectedMorpheme] = useState<string | null>(null);
  const [activeQueryId, setActiveQueryId] = useState<number>(1); // which query is focused
  const [hintsUsed, setHintsUsed] = useState(0);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [revealedMorphemes, setRevealedMorphemes] = useState<Map<string, string>>(new Map());
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [contextReveals, setContextReveals] = useState(0);
  const [gatedRevealed, setGatedRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [progress, setProgress] = useState<PuzzleProgress | null>(null);

  // All queries completed?
  const allDone = queryStates.every((qs) => qs.locked);
  const allCorrect = queryStates.every((qs) => qs.grade?.isCorrect);

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

  // Stop timer when all done
  useEffect(() => {
    if (allDone && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;

      // Record solve if all correct
      if (allCorrect) {
        const p = recordSolve(puzzle, elapsed);
        setProgress(p);
        // Show lore after a short delay
        setTimeout(() => setShowLore(true), 1200);
      }
    }
  }, [allDone, allCorrect, puzzle, elapsed]);

  // Load progress on mount
  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // Morpheme usage tracking
  const usedMorphemes = useMemo(() => {
    const map = new Map<string, number>();
    queryStates.forEach((qs) => {
      qs.slots.forEach((slot) => {
        if (slot.morpheme) {
          map.set(slot.morpheme, (map.get(slot.morpheme) || 0) + 1);
        }
      });
    });
    return map;
  }, [queryStates]);

  // Grades map for share text
  const gradesMap = useMemo(() => {
    const map = new Map<number, QueryGrade>();
    queryStates.forEach((qs, i) => {
      if (qs.grade) map.set(puzzle.queries[i].id, qs.grade);
    });
    return map;
  }, [queryStates, puzzle.queries]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleMorphemeSelect = useCallback((morpheme: string) => {
    setSelectedMorpheme((prev) => (prev === morpheme ? null : morpheme));
  }, []);

  const handleSlotTap = useCallback(
    (queryId: number, slotIndex: number) => {
      const qIdx = queryId - 1;
      if (queryStates[qIdx].locked || !selectedMorpheme) return;

      setQueryStates((prev) => {
        const next = [...prev];
        const qs = { ...next[qIdx] };
        const slots = [...qs.slots];

        if (slotIndex >= slots.length) {
          slots.push({ morpheme: selectedMorpheme });
        } else {
          slots[slotIndex] = { morpheme: selectedMorpheme };
        }

        qs.slots = slots;
        // Clear any previous grade (they're retrying)
        qs.grade = null;
        qs.showHintOnFail = false;
        next[qIdx] = qs;
        return next;
      });

      setSelectedMorpheme(null);
      setActiveQueryId(queryId);
    },
    [queryStates, selectedMorpheme],
  );

  const handleSlotRemove = useCallback(
    (queryId: number, slotIndex: number) => {
      const qIdx = queryId - 1;
      if (queryStates[qIdx].locked) return;

      setQueryStates((prev) => {
        const next = [...prev];
        const qs = { ...next[qIdx] };
        const slots = [...qs.slots];
        slots.splice(slotIndex, 1);
        if (slots.length === 0) slots.push({ morpheme: null });
        qs.slots = slots;
        qs.grade = null;
        qs.showHintOnFail = false;
        next[qIdx] = qs;
        return next;
      });
    },
    [queryStates],
  );

  // Submit a single query
  const handleSubmitQuery = useCallback(
    (queryId: number) => {
      const qIdx = queryId - 1;
      const qs = queryStates[qIdx];
      if (qs.locked) return;

      const query = puzzle.queries[qIdx];
      const submitted = qs.slots
        .filter((s) => s.morpheme !== null)
        .map((s) => s.morpheme!);

      if (submitted.length === 0) return;

      const attempt = qs.attempts + 1;
      const result = gradeAnswer(query, submitted, attempt);

      setQueryStates((prev) => {
        const next = [...prev];
        const updated = { ...next[qIdx] };
        updated.attempts = attempt;
        updated.grade = result;

        // Apply grades to slots
        const slots = [...updated.slots];
        let gradeIdx = 0;
        for (let i = 0; i < slots.length; i++) {
          if (slots[i].morpheme !== null && gradeIdx < result.grades.length) {
            slots[i] = { ...slots[i], grade: result.grades[gradeIdx] };
            gradeIdx++;
          }
        }
        updated.slots = slots;

        // Lock if correct or 2 attempts used
        if (result.isCorrect || attempt >= 2) {
          updated.locked = true;
          // If wrong after 2 attempts, show the correct answer
        }

        // Show hint on first failure
        if (!result.isCorrect && attempt === 1) {
          updated.showHintOnFail = true;
        }

        next[qIdx] = updated;
        return next;
      });

      // Move to next unsolved query
      if (result.isCorrect) {
        const nextUnsolved = queryStates.findIndex(
          (qs2, i) => i > qIdx && !qs2.locked,
        );
        if (nextUnsolved !== -1) {
          setTimeout(() => setActiveQueryId(nextUnsolved + 1), 600);
        }
      }
    },
    [queryStates, puzzle.queries],
  );

  // Reveal gated context
  const handleRevealContext = useCallback(() => {
    setGatedRevealed(true);
    setContextReveals((c) => c + 1);
  }, []);

  // Hints
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

    setTimeout(() => setHintMessage(null), 6000);
  }, [hintsUsed, puzzle.hints]);

  // Share
  const handleShare = useCallback(async () => {
    const text = generateShareText(puzzle, gradesMap, elapsed, hintsUsed, contextReveals);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy your result:", text);
    }
  }, [puzzle, gradesMap, elapsed, hintsUsed, contextReveals]);

  // Reset
  const handleReset = useCallback(() => {
    setQueryStates(
      puzzle.queries.map(() => ({
        slots: [{ morpheme: null }, { morpheme: null }, { morpheme: null }],
        attempts: 0,
        locked: false,
        grade: null,
        showHintOnFail: false,
      })),
    );
    setSelectedMorpheme(null);
    setActiveQueryId(1);
    setHintsUsed(0);
    setHighlightedRows(new Set());
    setRevealedMorphemes(new Map());
    setHintMessage(null);
    setContextReveals(0);
    setGatedRevealed(false);
    setCopied(false);
    setShowLore(false);
    setElapsed(0);
    startTimeRef.current = Date.now();
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
  }, [puzzle.queries]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const solvedCount = queryStates.filter((qs) => qs.grade?.isCorrect).length;
  const visiblePairs = gatedRevealed
    ? puzzle.pairs
    : puzzle.pairs.filter((p) => !p.gated);

  const hasAnyContent = queryStates.some((qs) =>
    qs.slots.some((s) => s.morpheme !== null),
  );

  // ─── Render ───────────────────────────────────────────────────────────────

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
            {/* Progress badge */}
            <span className="font-mono text-[11px] text-white/30">
              {solvedCount}/{puzzle.queries.length}
            </span>

            {/* Timer */}
            <span className="font-mono text-sm text-white/50 tabular-nums">
              {timeStr}
            </span>

            {/* Hint button */}
            {!allDone && (
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
          <div>
            <ContextPanel pairs={visiblePairs} highlightedRows={highlightedRows} />

            {/* Reveal gated context button */}
            {!gatedRevealed && puzzle.pairs.some((p) => p.gated) && (
              <button
                onClick={handleRevealContext}
                className="mt-3 w-full py-2.5 rounded-md border border-dashed border-white/15 text-[12px] font-mono text-white/40 hover:text-white/60 hover:border-white/25 transition-colors"
              >
                Reveal {puzzle.pairs.filter((p) => p.gated).length} more examples (costs time)
              </button>
            )}
          </div>

          {/* Answers — per-query with individual submit */}
          <div className="space-y-4">
            <span className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
              Your Answers
            </span>
            {puzzle.queries.map((query, i) => {
              const qs = queryStates[i];
              const isActive = activeQueryId === query.id;

              return (
                <div key={query.id} className="space-y-2">
                  <div
                    className={`transition-opacity ${isActive || qs.locked ? "opacity-100" : "opacity-60"}`}
                  >
                    <AnswerSlots
                      queryId={query.id}
                      prompt={query.prompt}
                      slots={qs.slots}
                      isGraded={qs.grade !== null}
                      isCorrect={qs.grade?.isCorrect ?? false}
                      selectedMorpheme={selectedMorpheme}
                      onSlotTap={handleSlotTap}
                      onSlotRemove={handleSlotRemove}
                    />
                  </div>

                  {/* Per-query submit button */}
                  {!qs.locked && qs.slots.some((s) => s.morpheme !== null) && (
                    <div className="flex items-center gap-2 pl-1">
                      <button
                        onClick={() => handleSubmitQuery(query.id)}
                        className="px-3 py-1.5 rounded-md bg-amber-500/80 text-[11px] font-semibold text-black hover:bg-amber-400 transition-colors"
                      >
                        Check Q{query.id}
                      </button>
                      {qs.attempts > 0 && !qs.grade?.isCorrect && (
                        <span className="text-[11px] text-white/30 font-mono">
                          attempt {qs.attempts}/2
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hint on first failure */}
                  <AnimatePresence>
                    {qs.showHintOnFail && query.hintOnFail && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-[12px] text-amber-300/70 pl-1"
                      >
                        💡 {query.hintOnFail}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Show correct answer if locked wrong */}
                  {qs.locked && !qs.grade?.isCorrect && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="pl-1 flex items-center gap-2"
                    >
                      <span className="text-[11px] text-white/30">Correct:</span>
                      <span className="font-mono text-[12px] text-emerald-400/70">
                        {query.answerJoined}
                      </span>
                      <span className="text-[10px] text-white/20">
                        ({query.answer.join(" + ")})
                      </span>
                    </motion.div>
                  )}

                  {/* Curveball badge */}
                  {query.difficulty === "curveball" && !qs.locked && (
                    <p className="text-[10px] text-white/25 pl-1 font-mono">
                      ⚡ curveball — this one requires an inference leap
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Morpheme Bank */}
          {!allDone && (
            <MorphemeBank
              morphemes={puzzle.morphemeBank}
              usedMorphemes={usedMorphemes}
              selectedMorpheme={selectedMorpheme}
              onSelect={handleMorphemeSelect}
              revealedMorphemes={revealedMorphemes}
            />
          )}

          {/* Success reveal */}
          <AnimatePresence>
            {allDone && allCorrect && (
              <SuccessReveal
                puzzle={puzzle}
                elapsed={elapsed}
                hintsUsed={hintsUsed}
                contextReveals={contextReveals}
                progress={progress}
              />
            )}
          </AnimatePresence>

          {/* Lore panel (after solve) */}
          <AnimatePresence>
            {showLore && (
              <LorePanel lore={puzzle.lore} language={puzzle.language} />
            )}
          </AnimatePresence>

          {/* Next puzzle preview (after solve) */}
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 }}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-4 text-center"
            >
              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">
                Next puzzle
              </p>
              <p className="text-base font-bold text-white/80">
                {puzzle.nextPreview.language}
              </p>
              <p className="font-mono text-sm text-sky-300/60 mt-1">
                {puzzle.nextPreview.script}
              </p>
              <p className="text-[11px] text-white/30 mt-1">
                {puzzle.nextPreview.family} · Difficulty {"★".repeat(puzzle.nextPreview.difficulty)}{"☆".repeat(5 - puzzle.nextPreview.difficulty)}
              </p>
              <p className="text-[10px] text-white/20 mt-3">
                Coming soon — one new puzzle daily
              </p>
            </motion.div>
          )}
        </div>
      </main>

      {/* Bottom action bar */}
      <footer className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {!allDone ? (
            <>
              <button
                onClick={handleReset}
                disabled={!hasAnyContent}
                className="px-3 py-2 rounded-md text-sm text-white/40 hover:text-white/70 disabled:opacity-0 transition-all"
              >
                Reset all
              </button>
              <div className="flex items-center gap-2">
                {progress && progress.puzzlesSolved > 0 && (
                  <span className="text-[10px] font-mono text-white/25">
                    🔥 {progress.streak} streak
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-md text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                Try again
              </button>
              <div className="flex items-center gap-3">
                {progress && (
                  <span className="text-[10px] font-mono text-white/30">
                    {progress.puzzlesSolved} solved · 🔥 {progress.streak}
                  </span>
                )}
                <button
                  onClick={handleShare}
                  className="px-5 py-2.5 rounded-md border border-white/20 bg-white/[0.06] text-sm font-medium text-white/80 hover:bg-white/10 transition-colors"
                >
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};
