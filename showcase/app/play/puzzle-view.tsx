"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { LanguageMap } from "./language-map";
import { AudioMoment } from "./audio-moment";
import { Briefing } from "./briefing";
import { createApurinaComparisonUrl } from "./canonical-apurina";
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
  const emojiMap: Record<TileGrade, string> = { correct: "🟩", misplaced: "🟨", wrong: "⬛" };
  const lines = puzzle.queries.map((q) => {
    const g = grades.get(q.id);
    if (!g) return "⬜⬜⬜";
    return g.grades.map((t) => emojiMap[t]).join("") + (g.attempt > 1 ? " ×2" : "");
  });
  const allCorrect = puzzle.queries.every((q) => grades.get(q.id)?.isCorrect);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return [
    `🧩 Ratiocine — ${puzzle.language}`,
    ...lines,
    `${allCorrect ? "Cracked" : "Attempted"} in ${m}:${s.toString().padStart(2, "0")}${hintsUsed ? ` · ${hintsUsed} hints` : ""}`,
    `ratiocine.vercel.app`,
  ].join("\n");
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "briefing" | "study" | "solve" | "result";

interface SlotData {
  morpheme: string | null;
  grade?: TileGrade;
  flipped?: boolean; // for flip animation
}

// ─── Main ───────────────────────────────────────────────────────────────────

export interface PuzzleViewProps {
  onBack?: () => void;
}

export const PuzzleView = ({ onBack }: PuzzleViewProps) => {
  const puzzle = useMemo(() => getTodaysPuzzle(), []);

  // Phase
  const [phase, setPhase] = useState<Phase>("briefing");
  const [currentQ, setCurrentQ] = useState(0);

  // Per-query answers
  const [answers, setAnswers] = useState<SlotData[][]>(() =>
    puzzle.queries.map((q) => q.answer.map(() => ({ morpheme: null }))),
  );
  const [grades, setGrades] = useState<Map<number, QueryGrade>>(new Map());
  const [attempts, setAttempts] = useState<number[]>(() => puzzle.queries.map(() => 0));
  const [locked, setLocked] = useState<boolean[]>(() => puzzle.queries.map(() => false));
  const [hintOnFail, setHintOnFail] = useState<string | null>(null);
  const [assembled, setAssembled] = useState<Map<number, string>>(new Map()); // queryId → assembled word
  const [shaking, setShaking] = useState(false); // shake on wrong
  const [score, setScore] = useState(0); // running score counter

  // Selection
  const [selected, setSelected] = useState<string | null>(null);

  // Hints & context
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [hintSteps, setHintSteps] = useState<string[]>([]); // agentic hint steps
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
    if (phase === "briefing") return;
    if (timerRef.current) return;
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

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
  const visiblePairs = gatedRevealed ? puzzle.pairs : puzzle.pairs.filter((p) => !p.gated);

  // Stop timer on all done
  useEffect(() => {
    if (allLocked && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (allCorrect) {
        const p = recordSolve(puzzle, elapsed);
        setProgress(p);
      }
      setTimeout(() => setPhase("result"), 800);
    }
  }, [allLocked, allCorrect, puzzle, elapsed]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSlotTap = useCallback((idx: number) => {
    if (isLocked) return;
    if (selected) {
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
      setAnswers((prev) => {
        const next = [...prev];
        const row = [...next[currentQ]];
        row[idx] = { morpheme: null, grade: undefined, flipped: false };
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

    // Stagger flip animation
    setAnswers((prev) => {
      const next = [...prev];
      const row = [...next[currentQ]];
      let gi = 0;
      for (let i = 0; i < row.length; i++) {
        if (row[i].morpheme && gi < result.grades.length) {
          row[i] = { ...row[i], grade: result.grades[gi], flipped: true };
          gi++;
        }
      }
      next[currentQ] = row;
      return next;
    });

    setAttempts((prev) => { const n = [...prev]; n[currentQ] = attempt; return n; });
    setGrades((prev) => new Map(prev).set(query.id, result));

    if (result.isCorrect) {
      // Score ticks up
      setScore((s) => s + 1);
      // Word assembly after flip animation settles
      setTimeout(() => {
        setAssembled((prev) => new Map(prev).set(query.id, query.answerJoined));
      }, submitted.length * 100 + 400);

      setLocked((prev) => { const n = [...prev]; n[currentQ] = true; return n; });
      // Auto-advance
      setTimeout(() => {
        const nextUnlocked = locked.findIndex((l, i) => !l && i > currentQ);
        if (nextUnlocked !== -1) setCurrentQ(nextUnlocked);
        else {
          const first = locked.findIndex((l) => !l);
          if (first !== -1) setCurrentQ(first);
        }
      }, submitted.length * 100 + 800);
      setHintOnFail(null);
    } else {
      // Practice mode never locks a player out: a wrong answer prompts another
      // evidence-based attempt, with a contextual hint available after every miss.
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      setHintOnFail(query.hintOnFail || "Recheck the examples, then try another arrangement.");
    }
  }, [isLocked, slots, attempts, currentQ, query, locked]);

  const handleHint = useCallback(() => {
    if (hintsUsed >= puzzle.hints.length) return;
    const hint = puzzle.hints[hintsUsed];
    setHintsUsed((h) => h + 1);

    // Agentic delivery: show "thinking" then reveal steps
    setHintSteps([]);
    setHintMsg("Analyzing...");

    setTimeout(() => {
      setHintMsg(null);
      const steps: string[] = [];
      if (hint.highlightRows) {
        steps.push(`Looking at rows ${hint.highlightRows.join(", ")}...`);
        setHighlightedRows((p) => { const n = new Set(p); hint.highlightRows!.forEach((r) => n.add(r)); return n; });
      }
      if (hint.revealMorpheme) {
        steps.push(`Found: ${hint.revealMorpheme.morpheme} = "${hint.revealMorpheme.meaning}"`);
        setRevealedMorphemes((p) => { const n = new Map(p); n.set(hint.revealMorpheme!.morpheme, hint.revealMorpheme!.meaning); return n; });
      }
      steps.push(hint.text);
      setHintSteps(steps);
      setTimeout(() => setHintSteps([]), 8000);
    }, 800);
  }, [hintsUsed, puzzle.hints]);

  const handleShare = useCallback(async () => {
    const text = generateShareText(puzzle, grades, elapsed, hintsUsed);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { prompt("Copy:", text); }
  }, [puzzle, grades, elapsed, hintsUsed]);

  // ─── Grade colors ─────────────────────────────────────────────────────────

  const gradeColor = (g?: TileGrade) => {
    if (g === "correct") return "border-emerald-400 bg-emerald-400/20 text-emerald-300";
    if (g === "misplaced") return "border-amber-400 bg-amber-400/20 text-amber-300";
    if (g === "wrong") return "border-red-400/60 bg-red-400/15 text-red-300/80";
    return "";
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="touch-game relative flex flex-col h-svh w-full overflow-hidden bg-[#0a0c10] text-white">

      {/* ═══ Top bar ═══ */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/8 sm:px-6">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button onClick={onBack} className="text-white/30 hover:text-white/60 text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center">←</button>
          )}
          <div>
            <span className="text-[10px] font-mono text-amber-400/60 tracking-wider">
              {puzzle.language.toUpperCase()}
            </span>
            <span className="text-[10px] text-white/20 ml-2 font-mono">{puzzle.family}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Score counter */}
          {phase === "solve" && (
            <motion.span
              key={score}
              initial={{ scale: 1.3, color: "#34d399" }}
              animate={{ scale: 1, color: "rgba(255,255,255,0.5)" }}
              className="font-mono text-xs tabular-nums"
            >
              {score}/{puzzle.queries.length}
            </motion.span>
          )}
          {phase !== "briefing" && (
            <span className="font-mono text-xs text-white/40 tabular-nums">{timeStr}</span>
          )}
          {phase === "solve" && (
            <button
              onClick={handleHint}
              disabled={hintsUsed >= puzzle.hints.length}
              className="text-[10px] font-mono text-amber-300/60 hover:text-amber-300 disabled:opacity-25 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              💡 {puzzle.hints.length - hintsUsed}
            </button>
          )}
        </div>
      </header>

      {/* ═══ Main frame ═══ */}
      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">

          {/* ─── BRIEFING ─── */}
          {phase === "briefing" && (
            <motion.div
              key="briefing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <Briefing puzzle={puzzle} onDismiss={() => setPhase("study")} />
            </motion.div>
          )}

          {/* ─── STUDY ─── */}
          {phase === "study" && (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col px-4 py-4 sm:px-6 min-h-0"
            >
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-lg mx-auto">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">
                    Study the pattern
                  </p>
                  <div className="grid gap-px bg-white/5 rounded-md overflow-hidden border border-white/8">
                    {visiblePairs.map((pair) => (
                      <div
                        key={pair.id}
                        className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] bg-[#0c0e13] ${
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
                      onClick={() => setGatedRevealed(true)}
                      className="mt-2 text-[11px] font-mono text-white/30 hover:text-white/50 transition-colors min-h-[44px]"
                    >
                      + {puzzle.pairs.filter((p) => p.gated).length} more rows
                    </button>
                  )}
                  <p className="mt-3 text-[11px] text-white/25 italic leading-relaxed">
                    {puzzle.lore.funFact.split("—")[0].trim()}
                  </p>
                </div>
              </div>
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

          {/* ─── SOLVE ─── */}
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
                <div className="flex items-center justify-center gap-1 mb-5">
                  {puzzle.queries.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQ(i)}
                      className={`w-11 h-11 rounded-full text-[11px] font-mono font-bold flex items-center justify-center transition-all ${
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

                {/* Query prompt — with shake animation */}
                <motion.p
                  animate={shaking ? { x: [0, -4, 4, -4, 4, -2, 2, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center text-white/80 text-base mb-5"
                >
                  {query.prompt}
                  {query.difficulty === "curveball" && (
                    <motion.span
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="ml-2 text-[10px] text-amber-400/80 font-mono"
                    >
                      ⚡
                    </motion.span>
                  )}
                </motion.p>

                {/* Tutorial helper */}
                {query.difficulty === "tutorial" && !isLocked && (
                  <p className="text-center text-[12px] text-emerald-300/50 mb-3 -mt-2">
                    This one&apos;s free — find it in the context and tap the tiles to match.
                  </p>
                )}

                {/* Answer slots — with flip animation */}
                <div className="flex items-center justify-center gap-2 mb-5 flex-wrap perspective-[800px]">
                  {slots.map((slot, i) => {
                    const flipDelay = i * 0.1;
                    const isFlipped = slot.flipped && slot.grade;

                    return (
                      <motion.button
                        key={i}
                        layout
                        onClick={() => handleSlotTap(i)}
                        whileTap={!isLocked ? { scale: 0.9 } : undefined}
                        animate={isFlipped ? {
                          rotateX: [0, 90, 0],
                          transition: { delay: flipDelay, duration: 0.4, times: [0, 0.5, 1] }
                        } : {}}
                        className={`min-w-[48px] min-h-[44px] h-11 px-3 rounded-md font-mono text-sm font-medium
                          border-2 transition-colors ${
                          slot.grade
                            ? gradeColor(slot.grade)
                            : slot.morpheme
                              ? "border-white/30 bg-white/[0.06] text-white/90"
                              : selected
                                ? "border-amber-400/50 bg-amber-400/[0.06] border-dashed"
                                : "border-white/10 bg-white/[0.02] border-dashed text-white/15"
                        }`}
                        style={{ transformStyle: "preserve-3d" }}
                      >
                        {slot.morpheme || "·"}
                      </motion.button>
                    );
                  })}
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
                      className="w-11 min-h-[44px] rounded-md border border-dashed border-white/10 text-white/20 hover:text-white/40 text-lg"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Word assembly — appears after correct */}
                <AnimatePresence>
                  {assembled.has(query.id) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="text-center mb-4"
                    >
                      <span className="font-mono text-lg text-emerald-400 font-bold tracking-wide">
                        {assembled.get(query.id)}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Agentic hint delivery */}
                <AnimatePresence>
                  {hintMsg && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center mb-3"
                    >
                      <span
                        className="text-[12px] font-mono text-amber-300/70"
                        style={{
                          backgroundImage: "linear-gradient(90deg, rgba(229,168,75,0.4) 35%, rgba(229,168,75,0.9) 50%, rgba(229,168,75,0.4) 65%)",
                          backgroundSize: "200% 100%",
                          backgroundClip: "text",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          animation: "shimmer 1.4s linear infinite",
                        }}
                      >
                        💡 {hintMsg}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hint steps (agentic trace) */}
                <AnimatePresence>
                  {hintSteps.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mb-4 rounded-md border border-amber-400/15 bg-amber-400/[0.03] px-3 py-2"
                    >
                      {hintSteps.map((step, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.3 }}
                          className="flex items-start gap-2 py-0.5"
                        >
                          <span className="text-amber-400/50 text-[10px] mt-0.5 shrink-0">
                            {i < hintSteps.length - 1 ? "→" : "✓"}
                          </span>
                          <span className="text-[12px] text-amber-200/70 leading-relaxed">
                            {step}
                          </span>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hint on fail (simple) */}
                <AnimatePresence>
                  {hintOnFail && hintSteps.length === 0 && (
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

                {/* Morpheme bank */}
                {!isLocked && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                    {puzzle.morphemeBank.map((m, i) => {
                      const isSelected = selected === m;
                      const revealed = revealedMorphemes.get(m);
                      return (
                        <button
                          key={`${m}-${i}`}
                          onClick={() => setSelected((p) => (p === m ? null : m))}
                          className={`relative px-3 py-2.5 min-h-[44px] rounded font-mono text-[13px] border transition-all ${
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
                      className="px-5 py-2 rounded-md bg-amber-500/90 text-sm font-bold text-black disabled:opacity-30 hover:bg-amber-400 transition-colors min-h-[44px]"
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
                      className="px-5 py-2 rounded-md border border-white/20 text-sm text-white/70 hover:bg-white/5 transition-colors min-h-[44px]"
                    >
                      Next →
                    </button>
                  )}
                  <button
                    onClick={() => setPhase("study")}
                    className="text-[11px] text-white/30 hover:text-white/50 font-mono transition-colors min-h-[44px] flex items-center"
                  >
                    ← context
                  </button>
                </div>

                {attempts[currentQ] > 0 && !isLocked && (
                  <p className="text-center text-[10px] text-white/25 font-mono mt-2">
                    attempt {attempts[currentQ]} · practice mode
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── RESULT ─── */}
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
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
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
                        {score}/{puzzle.queries.length} correct
                      </p>
                    </>
                  )}
                </div>

                {/* Solve trace — expandable per query */}
                <div className="rounded-lg border border-white/8 bg-white/[0.01] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Solve trace</span>
                    <span className="text-[10px] font-mono text-white/25">{score} correct · {hintsUsed} hints</span>
                  </div>
                  {puzzle.queries.map((q, i) => {
                    const g = grades.get(q.id);
                    const correct = g?.isCorrect;
                    return (
                      <details key={q.id} className="border-b border-white/5 last:border-0">
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors min-h-[44px]">
                          <span className={`text-[11px] font-mono shrink-0 ${correct ? "text-emerald-400" : "text-red-400/70"}`}>
                            {correct ? "✓" : "✗"}
                          </span>
                          <span className="text-[12px] text-white/60 flex-1 truncate">
                            Q{i + 1} — {q.prompt}
                          </span>
                          <span className="text-[10px] font-mono text-white/25 shrink-0">
                            {g ? `${g.attempt} attempt${g.attempt > 1 ? "s" : ""}` : "—"}
                          </span>
                          {q.difficulty !== "standard" && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                              q.difficulty === "tutorial" ? "bg-emerald-400/10 text-emerald-400/60" : "bg-amber-400/10 text-amber-400/60"
                            }`}>
                              {q.difficulty}
                            </span>
                          )}
                        </summary>
                        <div className="px-3 pb-2 pl-8 space-y-1">
                          <p className="text-[11px] text-white/30">
                            Your answer: <span className="font-mono text-white/50">
                              {answers[i].filter(s => s.morpheme).map(s => s.morpheme).join(" + ") || "—"}
                            </span>
                          </p>
                          <p className="text-[11px] text-white/30">
                            Correct: <span className="font-mono text-emerald-400/60">{q.answerJoined}</span>
                          </p>
                          {g && (
                            <div className="flex gap-0.5 mt-1">
                              {g.grades.map((grade, gi) => (
                                <span key={gi} className={`w-4 h-1.5 rounded-full ${
                                  grade === "correct" ? "bg-emerald-400" : grade === "misplaced" ? "bg-amber-400" : "bg-red-400/60"
                                }`} />
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
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

                {/* Lore */}
                <details className="rounded-lg border border-white/8 bg-white/[0.01]">
                  <summary className="px-4 py-3 text-[11px] font-mono text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60 min-h-[44px] flex items-center">
                    About {puzzle.language}
                  </summary>
                  <div className="px-4 pb-4 space-y-2 text-[13px] text-white/55 leading-relaxed">
                    <p><span className="text-white/30 font-mono text-[10px]">WHERE</span> {puzzle.lore.geography}</p>
                    <p><span className="text-white/30 font-mono text-[10px]">SPEAKERS</span> {puzzle.lore.speakers}</p>
                    <p><span className="text-white/30 font-mono text-[10px]">STATUS</span> {puzzle.lore.endangerment}</p>
                    <p><span className="text-white/30 font-mono text-[10px]">NOTE</span> {puzzle.lore.funFact}</p>
                  </div>
                </details>

                {/* Future puzzle preview */}
                <div className="text-center py-2">
                  <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest">More puzzles</p>
                  <p className="text-sm font-bold text-white/60 mt-1">{puzzle.nextPreview.language}</p>
                  <p className="font-mono text-[12px] text-sky-300/40">Coming soon · {puzzle.nextPreview.script}</p>
                </div>
              </div>

              {/* Bottom actions */}
              <div className="shrink-0 pt-3 flex flex-wrap items-center justify-center gap-3">
                {progress && (
                  <span className="text-[10px] font-mono text-white/25">
                    local record · 🔥{progress.streak} · 🧩{progress.puzzlesSolved}
                  </span>
                )}
                <button
                  onClick={handleShare}
                  className="px-4 py-2 rounded-md border border-white/15 text-[12px] font-mono text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors min-h-[44px]"
                >
                  {copied ? "Copied!" : "Share"}
                </button>
                <a
                  href={createApurinaComparisonUrl({
                    answers: answers.map((answer) => answer.map((slot) => slot.morpheme ?? "").join("")),
                    attempts,
                    hintsUsed,
                    elapsedSeconds: elapsed,
                    gatedContextRevealed: gatedRevealed,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-md border border-emerald-400/30 bg-emerald-400/[0.06] text-[12px] font-mono text-emerald-200/80 hover:bg-emerald-400/[0.12] transition-colors min-h-[44px] flex items-center"
                >
                  Compare your unsigned solve with AI ↗
                </a>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Shimmer keyframe (inline — needed for agentic hint) */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};
