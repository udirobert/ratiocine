"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { LanguageMap } from "./language-map";
import { AudioMoment } from "./audio-moment";
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

// ─── Share card ─────────────────────────────────────────────────────────────

function generateShareText(
  puzzle: Puzzle,
  grades: Map<number, QueryGrade>,
  elapsed: number,
  hintsUsed: number,
): string {
  const emojiMap: Record<TileGrade, string> = {
    correct: "🟩",
    misplaced: "🟨",
    wrong: "⬛",
  };
  const lines = puzzle.queries.map((q) => {
    const g = grades.get(q.id);
    if (!g) return "⬜⬜⬜";
    return g.grades.map((t) => emojiMap[t]).join("") + (g.attempt > 1 ? " ×2" : "");
  });
  const allCorrect = puzzle.queries.every((q) => grades.get(q.id)?.isCorrect);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return [
    `🧩 Ration — ${puzzle.language}`,
    ...lines,
    `${allCorrect ? "Cracked" : "Attempted"} in ${m}:${s.toString().padStart(2, "0")}${hintsUsed ? ` · ${hintsUsed} hints` : ""}`,
    `ratiocine.vercel.app`,
  ].join("\n");
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "study" | "solve" | "result";

interface SlotData {
  morpheme: string | null;
  grade?: TileGrade;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export interface PuzzleViewProps {
  onBack?: () => void;
}

export const PuzzleView = ({ onBack }: PuzzleViewProps) => {
  const puzzle = useMemo(() => getTodaysPuzzle(), []);

  // Phase
  const [phase, setPhase] = useState<Phase>("study");
  const [currentQ, setCurrentQ] = useState(0); // which query (0-indexed)

  // Per-query answers
  const [answers, setAnswers] = useState<SlotData[][]>(() =>
    puzzle.queries.map((q) => q.answer.map(() => ({ morpheme: null }))),
  );
  const [grades, setGrades] = useState<Map<number, QueryGrade>>(new Map());
  const [attempts, setAttempts] = useState<number[]>(() => puzzle.queries.map(() => 0));
  const [locked, setLocked] = useState<boolean[]>(() => puzzle.queries.map(() => false));
  const [hintOnFail, setHintOnFail] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<string | null>(null);

  // Hints & context
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [gatedRevealed, setGatedRevealed] = useState(false);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [revealedMorphemes, setRevealedMorphemes] = useState<Map<string, string>>(new Map());

  // Progress
  const [progress, setProgress] = useState<PuzzleProgress | null>(null);
  const [copied, setCopied] = useState(false);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => { setProgress(loadProgress()); }, []);

  // Derived
  const allLocked = locked.every(Boolean);
  const allCorrect = puzzle.queries.every((q) => grades.get(q.id)?.isCorrect);
  const query = puzzle.queries[currentQ];
  const slots = answers[currentQ];
  const isLocked = locked[currentQ];
  const qGrade = grades.get(query?.id);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const visiblePairs = gatedRevealed
    ? puzzle.pairs
    : puzzle.pairs.filter((p) => !p.gated);

  // Stop timer on all done
  useEffect(() => {
    if (allLocked && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (allCorrect) {
        const p = recordSolve(puzzle, elapsed);
        setProgress(p);
      }
      setTimeout(() => setPhase("result"), 600);
    }
  }, [allLocked, allCorrect, puzzle, elapsed]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSlotTap = useCallback((idx: number) => {
    if (isLocked) return;
    if (selected) {
      // Place
      setAnswers((prev) => {
        const next = [...prev];
        const row = [...next[currentQ]];
        row[idx] = { morpheme: selected };
        next[currentQ] = row;
        return next;
      });
      setSelected(null);
      setHintOnFail(null);
    } else if (slots[idx].morpheme) {
      // Remove
      setAnswers((prev) => {
        const next = [...prev];
        const row = [...next[currentQ]];
        row[idx] = { morpheme: null, grade: undefined };
        next[currentQ] = row;
        return next;
      });
    }
  }, [isLocked, selected, currentQ, slots]);

  const handleSubmit = useCallback(() => {
    if (isLocked) return;
    const submitted = slots.filter((s) => s.morpheme).map((s) => s.morpheme!);
    if (submitted.length === 0) return;

    const attempt = attempts[currentQ] + 1;
    const result = gradeAnswer(query, submitted, attempt);

    // Update grades on slots
    setAnswers((prev) => {
      const next = [...prev];
      const row = [...next[currentQ]];
      let gi = 0;
      for (let i = 0; i < row.length; i++) {
        if (row[i].morpheme && gi < result.grades.length) {
          row[i] = { ...row[i], grade: result.grades[gi] };
          gi++;
        }
      }
      next[currentQ] = row;
      return next;
    });

    setAttempts((prev) => { const n = [...prev]; n[currentQ] = attempt; return n; });
    setGrades((prev) => new Map(prev).set(query.id, result));

    if (result.isCorrect || attempt >= 2) {
      setLocked((prev) => { const n = [...prev]; n[currentQ] = true; return n; });
      // Auto-advance after short delay
      if (result.isCorrect && currentQ < puzzle.queries.length - 1) {
        setTimeout(() => {
          const nextUnlocked = locked.findIndex((l, i) => !l && i > currentQ);
          if (nextUnlocked !== -1) setCurrentQ(nextUnlocked);
          else {
            const first = locked.findIndex((l) => !l);
            if (first !== -1) setCurrentQ(first);
          }
        }, 500);
      }
      setHintOnFail(null);
    } else {
      // First fail — show hint
      setHintOnFail(query.hintOnFail || null);
    }
  }, [isLocked, slots, attempts, currentQ, query, locked, puzzle.queries.length]);

  const handleHint = useCallback(() => {
    if (hintsUsed >= puzzle.hints.length) return;
    const hint = puzzle.hints[hintsUsed];
    setHintsUsed((h) => h + 1);
    setHintMsg(hint.text);
    if (hint.highlightRows) setHighlightedRows((p) => { const n = new Set(p); hint.highlightRows!.forEach((r) => n.add(r)); return n; });
    if (hint.revealMorpheme) setRevealedMorphemes((p) => { const n = new Map(p); n.set(hint.revealMorpheme!.morpheme, hint.revealMorpheme!.meaning); return n; });
    setTimeout(() => setHintMsg(null), 5000);
  }, [hintsUsed, puzzle.hints]);

  const handleShare = useCallback(async () => {
    const text = generateShareText(puzzle, grades, elapsed, hintsUsed);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { prompt("Copy:", text); }
  }, [puzzle, grades, elapsed, hintsUsed]);

  // ─── Grade colors ─────────────────────────────────────────────────────────

  const gradeClass = (g?: TileGrade) => {
    if (g === "correct") return "border-emerald-400 bg-emerald-400/20 text-emerald-300";
    if (g === "misplaced") return "border-amber-400 bg-amber-400/20 text-amber-300";
    if (g === "wrong") return "border-red-400/60 bg-red-400/15 text-red-300/80";
    return "";
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-svh w-full overflow-hidden bg-[#0a0c10] text-white">

      {/* ═══ Top bar ═══ */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/8 sm:px-6">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button onClick={onBack} className="text-white/30 hover:text-white/60 text-lg leading-none">←</button>
          )}
          <div>
            <span className="text-[10px] font-mono text-amber-400/60 tracking-wider">
              {puzzle.language.toUpperCase()}
            </span>
            <span className="text-[10px] text-white/20 ml-2 font-mono">{puzzle.family}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-white/40 tabular-nums">{timeStr}</span>
          {phase === "solve" && (
            <button
              onClick={handleHint}
              disabled={hintsUsed >= puzzle.hints.length}
              className="text-[10px] font-mono text-amber-300/60 hover:text-amber-300 disabled:opacity-25 transition-colors"
            >
              💡 {puzzle.hints.length - hintsUsed}
            </button>
          )}
        </div>
      </header>

      {/* ═══ Main frame (fixed, no scroll) ═══ */}
      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">

          {/* ─── STUDY PHASE ─── */}
          {phase === "study" && (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col px-4 py-4 sm:px-6 min-h-0"
            >
              {/* Compact context grid */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-lg mx-auto">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">
                    Study the pattern
                  </p>
                  <div className="grid gap-px bg-white/5 rounded-md overflow-hidden border border-white/8">
                    {visiblePairs.map((pair) => (
                      <div
                        key={pair.id}
                        className={`flex items-center gap-2 px-3 py-1.5 bg-[#0c0e13] ${
                          highlightedRows.has(pair.id) ? "bg-amber-400/[0.04]" : ""
                        }`}
                      >
                        <span className="font-mono text-[10px] text-white/20 w-4 text-right shrink-0">{pair.id}</span>
                        <span className="font-mono text-[13px] text-sky-300/90 flex-1">{pair.source}</span>
                        <span className="text-[12px] text-white/50 flex-1">{pair.target}</span>
                      </div>
                    ))}
                  </div>

                  {!gatedRevealed && puzzle.pairs.some((p) => p.gated) && (
                    <button
                      onClick={() => { setGatedRevealed(true); }}
                      className="mt-2 text-[11px] font-mono text-white/30 hover:text-white/50 transition-colors"
                    >
                      + {puzzle.pairs.filter((p) => p.gated).length} more rows
                    </button>
                  )}

                  {/* Hint message */}
                  <AnimatePresence>
                    {hintMsg && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 text-[12px] text-amber-200/70 bg-amber-400/[0.05] border border-amber-400/15 rounded px-3 py-2"
                      >
                        💡 {hintMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Start button */}
              <div className="shrink-0 pt-4 flex justify-center">
                <button
                  onClick={() => setPhase("solve")}
                  className="px-6 py-2.5 rounded-md bg-amber-500/90 text-sm font-bold text-black hover:bg-amber-400 transition-colors"
                >
                  I see the pattern →
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── SOLVE PHASE ─── */}
          {phase === "solve" && query && (
            <motion.div
              key={`solve-${currentQ}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col px-4 py-4 sm:px-6 min-h-0"
            >
              <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">

                {/* Query progress dots */}
                <div className="flex items-center justify-center gap-2 mb-5">
                  {puzzle.queries.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => { if (!locked[i] || true) setCurrentQ(i); }}
                      className={`w-7 h-7 rounded-full text-[11px] font-mono font-bold flex items-center justify-center transition-all ${
                        i === currentQ
                          ? "bg-amber-400/20 border-2 border-amber-400 text-amber-300"
                          : locked[i] && grades.get(q.id)?.isCorrect
                            ? "bg-emerald-400/15 border border-emerald-400/50 text-emerald-400"
                            : locked[i]
                              ? "bg-red-400/10 border border-red-400/40 text-red-400/70"
                              : "bg-white/5 border border-white/15 text-white/40"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {/* Current query prompt */}
                <p className="text-center text-white/80 text-base mb-5">
                  {query.prompt}
                  {query.difficulty === "curveball" && (
                    <span className="ml-2 text-[10px] text-amber-400/60 font-mono">⚡</span>
                  )}
                </p>

                {/* Answer slots — big, centered */}
                <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                  {slots.map((slot, i) => (
                    <motion.button
                      key={i}
                      layout
                      onClick={() => handleSlotTap(i)}
                      whileTap={{ scale: 0.9 }}
                      className={`min-w-[48px] h-11 px-3 rounded-md font-mono text-sm font-medium
                        border-2 transition-all ${
                        slot.grade
                          ? gradeClass(slot.grade)
                          : slot.morpheme
                            ? "border-white/30 bg-white/[0.06] text-white/90"
                            : selected
                              ? "border-amber-400/50 bg-amber-400/[0.06] border-dashed"
                              : "border-white/10 bg-white/[0.02] border-dashed text-white/15"
                      }`}
                    >
                      {slot.morpheme || "·"}
                    </motion.button>
                  ))}
                  {/* Extra slot button */}
                  {!isLocked && (
                    <button
                      onClick={() => {
                        if (selected) {
                          setAnswers((prev) => {
                            const next = [...prev];
                            const row = [...next[currentQ], { morpheme: selected }];
                            next[currentQ] = row;
                            return next;
                          });
                          setSelected(null);
                        }
                      }}
                      className="w-8 h-11 rounded-md border border-dashed border-white/10 text-white/20 hover:text-white/40 text-lg"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Hint on fail */}
                <AnimatePresence>
                  {hintOnFail && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center text-[12px] text-amber-300/70 mb-4"
                    >
                      💡 {hintOnFail}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Correct answer if locked wrong */}
                {isLocked && !qGrade?.isCorrect && (
                  <p className="text-center text-[12px] text-white/30 mb-4">
                    Answer: <span className="text-emerald-400/70 font-mono">{query.answerJoined}</span>
                  </p>
                )}

                {/* Morpheme bank — compact, horizontal */}
                {!isLocked && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                    {puzzle.morphemeBank.map((m, i) => {
                      const isSelected = selected === m;
                      const revealed = revealedMorphemes.get(m);
                      return (
                        <button
                          key={`${m}-${i}`}
                          onClick={() => setSelected((p) => (p === m ? null : m))}
                          className={`relative px-2.5 py-1.5 rounded font-mono text-[13px] border transition-all ${
                            isSelected
                              ? "border-amber-400 bg-amber-400/15 text-amber-300 shadow-[0_0_8px_rgba(229,168,75,0.15)]"
                              : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                          }`}
                          title={revealed || undefined}
                        >
                          {m}
                          {revealed && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400/70" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Submit / navigation */}
                <div className="flex items-center justify-center gap-3">
                  {!isLocked && (
                    <button
                      onClick={handleSubmit}
                      disabled={!slots.some((s) => s.morpheme)}
                      className="px-5 py-2 rounded-md bg-amber-500/90 text-sm font-bold text-black disabled:opacity-30 hover:bg-amber-400 transition-colors"
                    >
                      Check
                    </button>
                  )}
                  {isLocked && !allLocked && (
                    <button
                      onClick={() => {
                        const next = locked.findIndex((l, i) => !l && i !== currentQ);
                        if (next !== -1) setCurrentQ(next);
                      }}
                      className="px-5 py-2 rounded-md border border-white/20 text-sm text-white/70 hover:bg-white/5 transition-colors"
                    >
                      Next →
                    </button>
                  )}
                  {/* Quick peek back at context */}
                  <button
                    onClick={() => setPhase("study")}
                    className="text-[11px] text-white/30 hover:text-white/50 font-mono transition-colors"
                  >
                    ← context
                  </button>
                </div>

                {/* Attempt indicator */}
                {attempts[currentQ] > 0 && !isLocked && (
                  <p className="text-center text-[10px] text-white/25 font-mono mt-2">
                    attempt {attempts[currentQ]}/2
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── RESULT PHASE ─── */}
          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col px-4 py-4 sm:px-6 overflow-y-auto"
            >
              <div className="max-w-lg mx-auto w-full space-y-4 flex-1">

                {/* Result header */}
                <div className="text-center py-2">
                  {allCorrect ? (
                    <>
                      <motion.p
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="text-2xl font-bold text-emerald-400"
                      >
                        Cracked.
                      </motion.p>
                      <p className="text-sm text-white/50 mt-1">{puzzle.language} decoded in {timeStr}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-white/70">Close.</p>
                      <p className="text-sm text-white/40 mt-1">
                        {puzzle.queries.filter((q) => grades.get(q.id)?.isCorrect).length}/{puzzle.queries.length} correct
                      </p>
                    </>
                  )}
                </div>

                {/* Answers summary — compact */}
                <div className="grid gap-1.5">
                  {puzzle.queries.map((q) => {
                    const g = grades.get(q.id);
                    return (
                      <div key={q.id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.02] border border-white/5">
                        <span className={`text-[11px] font-mono ${g?.isCorrect ? "text-emerald-400" : "text-red-400/70"}`}>
                          {g?.isCorrect ? "✓" : "✗"}
                        </span>
                        <span className="text-[12px] text-white/50 flex-1 truncate">{q.prompt}</span>
                        <span className="font-mono text-[12px] text-white/70">{q.answerJoined}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Audio moment */}
                {allCorrect && (
                  <AudioMoment
                    audioSrc="/audio/apurina-forms.mp3"
                    language={puzzle.language}
                    transcript={puzzle.queries.map((q) => q.answerJoined).join(" · ")}
                  />
                )}

                {/* Map */}
                <LanguageMap
                  progress={progress}
                  currentLanguageCode={puzzle.languageCode}
                  currentCoordinates={puzzle.lore.coordinates}
                  currentLanguage={puzzle.language}
                />

                {/* Lore — collapsed by default */}
                <details className="rounded-lg border border-white/8 bg-white/[0.01]">
                  <summary className="px-4 py-3 text-[11px] font-mono text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60">
                    About {puzzle.language}
                  </summary>
                  <div className="px-4 pb-4 space-y-2 text-[13px] text-white/55 leading-relaxed">
                    <p><span className="text-white/30 font-mono text-[10px]">WHERE</span> {puzzle.lore.geography}</p>
                    <p><span className="text-white/30 font-mono text-[10px]">SPEAKERS</span> {puzzle.lore.speakers}</p>
                    <p><span className="text-white/30 font-mono text-[10px]">STATUS</span> {puzzle.lore.endangerment}</p>
                    <p><span className="text-white/30 font-mono text-[10px]">NOTE</span> {puzzle.lore.funFact}</p>
                  </div>
                </details>

                {/* Next preview */}
                <div className="text-center py-2">
                  <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest">Next</p>
                  <p className="text-sm font-bold text-white/60 mt-1">{puzzle.nextPreview.language}</p>
                  <p className="font-mono text-[12px] text-sky-300/40">{puzzle.nextPreview.script}</p>
                </div>
              </div>

              {/* Bottom actions */}
              <div className="shrink-0 pt-3 flex items-center justify-center gap-3">
                {progress && (
                  <span className="text-[10px] font-mono text-white/25">
                    🔥{progress.streak} · 🧩{progress.puzzlesSolved}
                  </span>
                )}
                <button
                  onClick={handleShare}
                  className="px-4 py-2 rounded-md border border-white/15 text-[12px] font-mono text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors"
                >
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};
