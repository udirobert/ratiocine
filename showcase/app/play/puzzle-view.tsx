"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

import { LanguageMap } from "./language-map";
import { AudioMoment } from "./audio-moment";
import { StudyPhase } from "./study-phase";
import { WarmupTeaser } from "./warmup-teaser";
import { WarmupGate } from "./warmup-gate";
import { AiComparison, type AiResult } from "./ai-comparison";
import { ContextPanel } from "./context-panel";
import { ArchivePanel } from "./archive-panel";
import { CoachMarks, hasSeenCoach, hasSeenWarmup, markWarmupSeen } from "./coach-marks";
import { AmbientWorld } from "./ambient-world";
import { GlyphDrift } from "./glyph-drift";
import { OrnamentRule } from "./decor";
import { emitFieldRipple } from "./fx-bus";
import { useSfx, AMBIENT_FREQ } from "./use-sfx";
import { useSolveCounter } from "./use-solve-counter";
import { track } from "@/lib/analytics";
import {
  getTodaysPuzzle,
  getPuzzleById,
  getChallengeUrl,
  PUZZLE_POOL,
  gradeAnswer,
  loadProgress,
  recordSolve,
  saveDraft,
  loadDraft,
  clearDraft,
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
  aiResult?: AiResult | null,
  streak?: number,
): string {
  const emojiMap: Record<TileGrade, string> = { correct: "🟩", misplaced: "🟨", wrong: "⬛" };
  const lines = puzzle.queries.map((q) => {
    const g = grades.get(q.id);
    if (!g) return "⬜⬜⬜";
    if (g.revealed) return "⬛".repeat(q.answer.length) + " 🔍";
    return g.grades.map((t) => emojiMap[t]).join("") + (g.attempt > 1 ? " ×2" : "");
  });
  const allCorrect = puzzle.queries.every((q) => grades.get(q.id)?.isCorrect);
  const revealCount = puzzle.queries.filter((q) => grades.get(q.id)?.revealed).length;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const timeStr = `${m}:${s.toString().padStart(2, "0")}`;
  const extras = [
    hintsUsed ? `${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}` : null,
    revealCount ? `${revealCount} reveal${revealCount > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  const humanLine = `${allCorrect ? "Cracked" : "Attempted"} in ${timeStr}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
  const host = typeof window !== "undefined" ? window.location.host : "ratiocine.vercel.app";
  const streakLine = streak && streak > 1 ? `🔥 ${streak}-day streak` : null;
  const challenge = `${host}/play?puzzle=${encodeURIComponent(puzzle.id)}&t=${encodeURIComponent(timeStr)}`;

  if (aiResult) {
    const aiCorrect = puzzle.queries.filter((q, i) =>
      (aiResult.pred[i] || "").trim().toLowerCase() === q.answerJoined.toLowerCase()
    ).length;
    const humanCorrect = puzzle.queries.filter((q) => grades.get(q.id)?.isCorrect).length;
    return [
      `🧩 Ratiocine — ${puzzle.language}`,
      ...lines,
      `You: ${humanLine}`,
      `AI: ${aiCorrect}/${puzzle.queries.length} in ${aiResult.elapsed_s}s`,
      humanCorrect > aiCorrect ? `Beat the machine.` : humanCorrect === aiCorrect ? `Tied.` : `The machine got more.`,
      ...(streakLine ? [streakLine] : []),
      challenge,
    ].join("\n");
  }

  return [
    `🧩 Ratiocine — ${puzzle.language}`,
    ...lines,
    humanLine,
    `Can the machine do it too?`,
    ...(streakLine ? [streakLine] : []),
    challenge,
  ].join("\n");
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "warmup" | "study" | "solve" | "result";

interface SlotData {
  morpheme: string | null;
  grade?: TileGrade;
  flipped?: boolean; // for flip animation
}

// ─── Main ───────────────────────────────────────────────────────────────────

export interface PuzzleViewProps {
  onBack?: () => void;
  onSolved?: (data: { language: string; score: number; total: number; verdict: string; accentColor: string; timeStr: string }) => void;
}

export const PuzzleView = ({ onBack, onSolved }: PuzzleViewProps) => {
  const puzzle = useMemo(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("puzzle");
      if (id) {
        const found = getPuzzleById(id);
        if (found) return found;
      }
    }
    return getTodaysPuzzle();
  }, []);
  const sfx = useSfx();
  const { count: solveCount, increment: incrementSolveCount } = useSolveCounter();

  // Phase — challenge-link visitors (?puzzle=) skip the warmup gate and
  // land straight in study; the warmup teaches today's puzzle, which they
  // already hold in their hands via the link.
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("puzzle")) {
      return "study";
    }
    return hasSeenWarmup() ? "study" : "warmup";
  });
  const [currentQ, setCurrentQ] = useState(0);
  const [studiedOnce, setStudiedOnce] = useState(false); // skip study intro on re-entry

  // Per-query answers
  const [answers, setAnswers] = useState<SlotData[][]>(() =>
    puzzle.queries.map((q) => q.answer.map(() => ({ morpheme: null }))),
  );
  const [grades, setGrades] = useState<Map<number, QueryGrade>>(new Map());
  const [attempts, setAttempts] = useState<number[]>(() => puzzle.queries.map(() => 0));
  const [locked, setLocked] = useState<boolean[]>(() => puzzle.queries.map(() => false));
  const [assembled, setAssembled] = useState<Map<number, string>>(new Map());
  const [shaking, setShaking] = useState(false);
  const [sealedQ, setSealedQ] = useState<number | null>(null); // query that just got its wax seal
  const [score, setScore] = useState(0);
  const [ghostVisible, setGhostVisible] = useState(true); // ghost tile hint for Q1/Q2
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [everPlaced, setEverPlaced] = useState(false); // coach caption until first placement
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Selection removed — tap-to-place model (tap tile = auto-place, tap slot = remove)

  // Hints & context
  const [hintsUsed, setHintsUsed] = useState(0);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [revealedMorphemes, setRevealedMorphemes] = useState<Map<string, string>>(new Map());

  // Evidence drawer + gated specimens
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [seenEvidence, setSeenEvidence] = useState(false); // pulse the book icon until first opened
  const [revealedGated, setRevealedGated] = useState(false);
  const [contextReveals, setContextReveals] = useState(0);

  // Forfeit ("reveal this one") flow — armed per query after 2 failed attempts
  const [forfeitArmed, setForfeitArmed] = useState<number | null>(null);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);

  // Reset the forfeit confirm whenever the visible query changes
  useEffect(() => { setForfeitConfirm(false); }, [currentQ]);

  // Transient toast (hints, fail hints, morpheme meanings)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wax-seal ritual timer
  const sealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (sealTimerRef.current) clearTimeout(sealTimerRef.current);
  }, []);

  // Screen-reader announcements
  const [announce, setAnnounce] = useState("");

  // Progress
  const [progress, setProgress] = useState<PuzzleProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiSettled, setAiSettled] = useState(false);
  const [aiFlash, setAiFlash] = useState(false); // spectacle pulse when verdict lands
  const aiVerdictRef = useRef<HTMLDivElement | null>(null);
  // Ghost time from a challenge link (?t=m:ss) — a friend's time to beat
  const [ghostTime] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const t = new URLSearchParams(window.location.search).get("t");
    return t && /^\d+:\d{2}$/.test(t) ? t : null;
  });
  const [showCoach, setShowCoach] = useState(() => !hasSeenCoach());
  const [everSubmitted, setEverSubmitted] = useState(false);

  // Timer — accumulates across phase switches (evidence trips don't reset it)
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());
  const accumRef = useRef(0);

  useEffect(() => {
    if (phase !== "solve") return;
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(accumRef.current + Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => {
      // Bank the elapsed time so re-entering solve resumes instead of resetting.
      // Only bank if the interval was still running (not already stopped at solve end).
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        accumRef.current += Math.floor((Date.now() - startRef.current) / 1000);
      }
    };
  }, [phase]);

  // Toast helper
  const showToast = useCallback((text: string, ms = 4500) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  // Fail hints are shown at most once per query
  const shownFailHintsRef = useRef<Set<number>>(new Set());

  useEffect(() => { setProgress(loadProgress()); }, []);

  // Restore a mid-solve draft (same puzzle, same day) so a refresh or
  // backgrounded tab never costs the attempt. Hint highlights aren't
  // restored — hints stay usable and re-apply cleanly.
  useEffect(() => {
    const draft = loadDraft(puzzle.id);
    if (!draft || draft.answers.length !== puzzle.queries.length) return;
    try {
      const gradeMap = new Map(draft.grades.map((g) => [g.queryId, g]));
      setAnswers(
        puzzle.queries.map((q, qi) => {
          const g = gradeMap.get(q.id);
          const row = draft.answers[qi] ?? [];
          return q.answer.map((_, si) => {
            const m = row[si] ?? null;
            if (!m) return { morpheme: null };
            if (g?.isCorrect) return { morpheme: m, grade: "correct" as const };
            return { morpheme: m };
          });
        }),
      );
      setGrades(gradeMap);
      if (draft.attempts.length === puzzle.queries.length) setAttempts(draft.attempts);
      if (draft.locked.length === puzzle.queries.length) setLocked(draft.locked);
      setScore(draft.score);
      setElapsed(draft.elapsed);
      accumRef.current = draft.elapsed;
      setHintsUsed(draft.hintsUsed);
      setRevealedGated(draft.revealedGated);
      setContextReveals(draft.contextReveals);
    } catch {
      /* corrupt draft — start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft while solving; clear it once every query locks.
  const allLockedEarly = locked.every(Boolean);
  useEffect(() => {
    if (phase !== "solve") return;
    if (allLockedEarly) {
      clearDraft(puzzle.id);
      return;
    }
    saveDraft(puzzle.id, {
      answers: answers.map((row) => row.map((s) => s.morpheme)),
      grades: [...grades.values()],
      attempts,
      locked,
      score,
      elapsed,
      hintsUsed,
      revealedGated,
      contextReveals,
    });
  }, [phase, allLockedEarly, answers, grades, attempts, locked, score, elapsed, hintsUsed, revealedGated, contextReveals, puzzle.id]);

  // ── Ambient pad: tune the room tone to this puzzle, stop on unmount ──
  useEffect(() => {
    sfx.setAmbientFreq(AMBIENT_FREQ[puzzle.id] ?? 55);
    return () => sfx.stopAmbient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  // Derived
  const allLocked = locked.every(Boolean);
  const allCorrect = puzzle.queries.every((q) => grades.get(q.id)?.isCorrect);
  const gatedCount = puzzle.pairs.filter((p) => p.gated).length;
  const query = puzzle.queries[currentQ];
  const slots = answers[currentQ];
  const isLocked = locked[currentQ];
  const qGrade = grades.get(query?.id);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  // Ghost tile hint for Q1/Q2 first slot — shows briefly when a fresh query appears
  useEffect(() => {
    if (phase !== "solve") return;
    if (currentQ > 1 || attempts[currentQ] > 0 || slots.some((s) => s.morpheme) || !query.answer[0]) {
      setGhostVisible(false);
      return;
    }
    setGhostVisible(true);
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    ghostTimerRef.current = setTimeout(() => setGhostVisible(false), 2000);
    return () => {
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    };
  }, [phase, currentQ, attempts, slots, query]);

  // Stop timer on all done
  useEffect(() => {
    if (allLocked && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (allCorrect) {
        const p = recordSolve(puzzle, elapsed);
        setProgress(p);
      }
      track("puzzle_solved", {
        puzzle: puzzle.id,
        score,
        total: puzzle.queries.length,
        perfect: allCorrect,
        hints: hintsUsed,
        seconds: elapsed,
      });
      setTimeout(() => {
        setPhase("result");
        incrementSolveCount();
        // The language exhales — full-field bloom on solve
        emitFieldRipple(0.5, 0.5, "bloom");
        // Notify parent of solve result (for CRT solved state)
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        onSolved?.({
          language: puzzle.language,
          score,
          total: puzzle.queries.length,
          verdict: allCorrect
            ? puzzle.verdicts.perfect
            : score >= puzzle.queries.length * 0.6
              ? puzzle.verdicts.good
              : puzzle.verdicts.partial,
          accentColor: puzzle.theme.accent,
          timeStr: `${m}:${s.toString().padStart(2, "0")}`,
        });
      }, 800);
    }
  }, [allLocked, allCorrect, puzzle, elapsed, score, onSolved, incrementSolveCount]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSlotTap = useCallback((idx: number) => {
    if (isLocked) return;
    // Tap a placed tile → return it to the bank
    if (slots[idx].morpheme) {
      sfx.pop();
      if (navigator.vibrate) navigator.vibrate(5);
      setAnswers((prev) => {
        const next = [...prev];
        const row = [...next[currentQ]];
        row[idx] = { morpheme: null, grade: undefined, flipped: false };
        next[currentQ] = row;
        return next;
      });
    }
  }, [isLocked, currentQ, slots, sfx]);

  // Tap a bank tile → auto-place into first empty slot
  const handleTilePlace = useCallback((morpheme: string) => {
    if (isLocked) return;
    const emptyIdx = slots.findIndex((s) => !s.morpheme);
    if (emptyIdx === -1) return; // all slots full
    sfx.snap();
    if (navigator.vibrate) navigator.vibrate(10);
    setAnswers((prev) => {
      const next = [...prev];
      const row = [...next[currentQ]];
      row[emptyIdx] = { morpheme };
      next[currentQ] = row;
      return next;
    });
    // Hide ghost tile + coach caption on first interaction
    if (ghostVisible) setGhostVisible(false);
    if (!everPlaced) setEverPlaced(true);
    // If a hint revealed this morpheme's meaning, surface it (touch has no tooltips)
    const meaning = revealedMorphemes.get(morpheme);
    if (meaning) showToast(`${morpheme} = ${meaning}`, 2500);
  }, [isLocked, slots, currentQ, sfx, ghostVisible, everPlaced, revealedMorphemes, showToast]);

  // Clear all placed tiles in the current query (cheaper than unpicking one by one)
  const handleClear = useCallback(() => {
    if (isLocked) return;
    sfx.pop();
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = next[currentQ].map(() => ({ morpheme: null }));
      return next;
    });
  }, [isLocked, currentQ, sfx]);

  const handleSubmit = useCallback(() => {
    if (isLocked) return;
    const submitted = slots.filter((s) => s.morpheme).map((s) => s.morpheme!);
    if (submitted.length === 0) return;

    const attempt = attempts[currentQ] + 1;
    const result = gradeAnswer(query, submitted, attempt);
    if (!everSubmitted) {
      setEverSubmitted(true);
      track("first_submit", { puzzle: puzzle.id });
    }

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
      sfx.chime();
      // Seal ritual — stamp the answer ~180ms after the flip lands
      sealTimerRef.current = setTimeout(() => {
        sfx.stamp();
        setSealedQ(query.id);
        // The world answers the seal — accent ripple from the answer row
        emitFieldRipple(0.5, 0.62, "correct");
        if (navigator.vibrate) navigator.vibrate([10, 30, 20]);
      }, 180);
      setAnnounce(`Query ${currentQ + 1}: correct — ${query.answerJoined}`);
      setForfeitArmed(null);
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
    } else {
      // Shake on wrong — the visual IS the feedback
      sfx.thud();
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      // Damped, ashy ripple — the world flinches, it doesn't punish
      emitFieldRipple(0.5, 0.62, "wrong");

      // Screen-reader summary of per-tile grades
      const counts = { correct: 0, misplaced: 0, wrong: 0 };
      result.grades.forEach((g) => { counts[g] += 1; });
      setAnnounce(
        `Query ${currentQ + 1}: not quite. ${counts.correct} correct, ${counts.misplaced} misplaced, ${counts.wrong} wrong.`,
      );

      // Surface the puzzle's fail hint once per query, from attempt 2 onward
      if (attempt >= 2 && query.hintOnFail && !shownFailHintsRef.current.has(query.id)) {
        shownFailHintsRef.current.add(query.id);
        showToast(query.hintOnFail, 6000);
      }

      // Arm the "reveal this one" forfeit after 2 failed attempts
      if (attempt >= 2) setForfeitArmed(currentQ);
    }
  }, [isLocked, slots, attempts, currentQ, query, locked, sfx, showToast]);

  // ─── Forfeit: reveal one query (locks it wrong, honestly) ─────────────────

  const handleForfeit = useCallback(() => {
    if (forfeitArmed !== currentQ || isLocked) return;
    sfx.pop();
    const grade: QueryGrade = {
      queryId: query.id,
      grades: [],
      isCorrect: false,
      attempt: attempts[currentQ],
      revealed: true,
    };
    setGrades((prev) => new Map(prev).set(query.id, grade));
    setLocked((prev) => { const n = [...prev]; n[currentQ] = true; return n; });
    setForfeitArmed(null);
    setAnnounce(`Query ${currentQ + 1} revealed: ${query.answerJoined}`);
    track("query_reveal", { puzzle: puzzle.id, query: query.id });
    // Auto-advance like a correct solve
    setTimeout(() => {
      const nextUnlocked = locked.findIndex((l, i) => !l && i > currentQ);
      if (nextUnlocked !== -1) setCurrentQ(nextUnlocked);
      else {
        const first = locked.findIndex((l) => !l);
        if (first !== -1) setCurrentQ(first);
      }
    }, 600);
  }, [forfeitArmed, currentQ, isLocked, query, attempts, locked, sfx]);

  const handleHint = useCallback(() => {
    if (hintsUsed >= puzzle.hints.length) return;
    const hint = puzzle.hints[hintsUsed];
    setHintsUsed((h) => h + 1);
    track("hint_used", { puzzle: puzzle.id, level: hint.level });

    // Visual feedback: flash rows, flip morpheme tiles…
    if (hint.highlightRows) {
      setHighlightedRows((p) => { const n = new Set(p); hint.highlightRows!.forEach((r) => n.add(r)); return n; });
    }
    if (hint.revealMorpheme) {
      setRevealedMorphemes((p) => { const n = new Map(p); n.set(hint.revealMorpheme!.morpheme, hint.revealMorpheme!.meaning); return n; });
    }
    // …plus a short toast so the player knows what just happened
    if (hint.text) showToast(`💡 ${hint.text}`, 6000);
    setAnnounce(`Hint used: ${hint.text}`);
  }, [hintsUsed, puzzle.hints, puzzle.id, showToast]);

  // Reveal the gated evidence specimens (rows hidden at the start)
  const handleRevealGated = useCallback(() => {
    if (revealedGated) return;
    setRevealedGated(true);
    setContextReveals((c) => c + 1);
    sfx.chime();
    setAnnounce("Hidden evidence specimens revealed.");
    track("context_reveal", { puzzle: puzzle.id });
  }, [revealedGated, sfx, puzzle.id]);

  const handleShare = useCallback(async () => {
    track("shared", { puzzle: puzzle.id, with_ai: Boolean(aiResult) });
    const streak = progress?.streak ?? 0;
    const text = generateShareText(puzzle, grades, elapsed, hintsUsed, aiResult, streak);
    // Copy the Wordle-style grid text FIRST (works everywhere, incl. desktop
    // where file-share is unavailable) — then try to upgrade to image share.
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may be unavailable — image path still attempted */ }
    try {
      const { generateShareCard } = await import("./share-card");
      const blob = await generateShareCard(puzzle, grades, elapsed, hintsUsed, aiResult, streak);
      if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], "ratiocine.png", { type: "image/png" })] })) {
        await navigator.share({
          text,
          files: [new File([blob], "ratiocine.png", { type: "image/png" })],
        });
        return;
      }
    } catch {
      // Final fallback
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
      catch { prompt("Copy:", text); }
    }
  }, [puzzle, grades, elapsed, hintsUsed, aiResult, progress?.streak]);

  // ─── Keyboard play (desktop) ──────────────────────────────────────────────

  const flatBank = useMemo(() => puzzle.morphemeBank.flat(), [puzzle]);
  const driftGlyphs = useMemo(
    () => puzzle.morphemeBank.flat().filter((m) => m.length <= 6).slice(0, 12),
    [puzzle],
  );

  useEffect(() => {
    if (phase !== "solve") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "Escape") {
        if (evidenceOpen) { setEvidenceOpen(false); e.preventDefault(); }
        return;
      }
      if (evidenceOpen) return; // drawer open — only Escape acts

      if (e.key.toLowerCase() === "e") { setEvidenceOpen(true); return; }
      if (e.key.toLowerCase() === "h") { handleHint(); return; }
      if (e.key === "Enter") {
        if (!isLocked && slots.some((s) => s.morpheme)) handleSubmit();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (isLocked) return;
        const lastFilled = slots.reduce((acc, s, i) => (s.morpheme ? i : acc), -1);
        if (lastFilled !== -1) {
          e.preventDefault();
          handleSlotTap(lastFilled);
        }
        return;
      }
      const digit = e.key === "0" ? 10 : Number.parseInt(e.key, 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= Math.min(flatBank.length, 10)) {
        const morpheme = flatBank[digit - 1];
        if (morpheme && !slots.some((s) => s.morpheme === morpheme)) handleTilePlace(morpheme);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, evidenceOpen, slots, isLocked, flatBank, handleTilePlace, handleSlotTap, handleSubmit, handleHint]);

  // ─── Grade colors ─────────────────────────────────────────────────────────

  const gradeColor = (g?: TileGrade) => {
    if (g === "correct") return "border-emerald-400 bg-emerald-400/20 text-emerald-300";
    if (g === "misplaced") return "border-amber-400 bg-amber-400/20 text-amber-300";
    if (g === "wrong") return "border-red-400/60 bg-red-400/15 text-red-300/80";
    return "";
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="touch-game font-display relative flex flex-col h-svh w-full overflow-hidden text-white"
      style={{
        "--puzzle-accent": puzzle.theme.accent,
        "--puzzle-source": puzzle.theme.sourceColor,
        // Page base picks up the puzzle's place-tint — the whole world shifts
        // tonally per language, not just the accents on top of black.
        background: `color-mix(in srgb, ${puzzle.theme.bgTint ?? puzzle.theme.accent} 16%, #0a0c10)`,
      } as CSSProperties}
      onClick={sfx.enable}
      onKeyDown={sfx.enable}
    >

      {/* Screen-reader announcements (grade results, hints, reveals) */}
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>

      {/* First-time coach marks */}
      <AnimatePresence>
        {showCoach && (
          <CoachMarks accent={puzzle.theme.accent} onDismiss={() => setShowCoach(false)} />
        )}
      </AnimatePresence>

      {/* Transient toast — hint text, fail hints, morpheme meanings */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-20 inset-x-0 z-50 flex justify-center px-6 pointer-events-none"
          >
            <p className="max-w-sm rounded-lg border border-white/15 bg-[#12151d]/95 px-4 py-2.5 text-[13px] text-white/85 text-center leading-relaxed shadow-lg">
              {toast}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Living world — per-puzzle atmosphere (replaces flat CRT wash).
          Frozen while modals cover it or the phase isn't solve. */}
      <AmbientWorld
        puzzleId={puzzle.id}
        theme={puzzle.theme}
        active={phase === "solve" && !evidenceOpen && !archiveOpen && !showCoach}
      />

      {/* ═══ Top bar ═══ */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/8 sm:px-6">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button onClick={onBack} className="text-white/50 hover:text-white/80 text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center">←</button>
          )}
          <div>
            <span
              className="text-[13px] font-display italic tracking-wide"
              style={{ color: `${puzzle.theme.accent}cc` }}
            >
              {puzzle.language}
            </span>
            <span className="text-[10px] text-white/40 ml-2 font-mono">{puzzle.family}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Score counter */}
          {phase === "solve" && (
            <motion.span
              key={score}
              initial={{ scale: 1.3, color: puzzle.theme.accent }}
              animate={{ scale: 1, color: "rgba(255,255,255,0.5)" }}
              className="font-mono text-xs tabular-nums"
            >
              {score}/{puzzle.queries.length}
            </motion.span>
          )}
          {/* Timer is tracked silently and revealed on the result screen —
              a live clock pressures deduction instead of rewarding it */}
          {phase === "solve" && (
            <button
              onClick={handleHint}
              disabled={hintsUsed >= puzzle.hints.length}
              className="text-[10px] font-mono disabled:opacity-25 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ color: `${puzzle.theme.accent}99` }}
              aria-label={`Use a hint (${puzzle.hints.length - hintsUsed} left)`}
            >
              💡 {puzzle.hints.length - hintsUsed}
            </button>
          )}
          {/* Archive — practice any puzzle in the pool */}
          <button
            onClick={(e) => { e.stopPropagation(); setArchiveOpen(true); }}
            className="text-sm min-w-[44px] min-h-[44px] flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Open puzzle archive"
          >
            📚
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); sfx.toggleMute(); }}
            className="text-sm min-w-[44px] min-h-[44px] flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            aria-label={sfx.muted ? "Unmute sound effects" : "Mute sound effects"}
            aria-pressed={sfx.muted}
          >
            {sfx.muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {/* ═══ Progress bar ═══ */}
      {phase === "solve" && (
        <div className="shrink-0 h-0.5 bg-white/5">
          <motion.div
            className="h-full rounded-r-full"
            style={{ backgroundColor: puzzle.theme.accent }}
            initial={{ width: "0%" }}
            animate={{ width: `${(score / puzzle.queries.length) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      )}

      {/* ═══ Main frame ═══ */}
      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">

          {/* ─── WARMUP (first-time mini puzzle) ─── */}
          {phase === "warmup" && (
            <motion.div
              key="warmup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <WarmupGate
                puzzle={puzzle}
                onContinue={() => {
                  markWarmupSeen();
                  setPhase("study");
                }}
              />
            </motion.div>
          )}

          {/* ─── STUDY (merged briefing + evidence) ─── */}
          {phase === "study" && (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <StudyPhase
                puzzle={puzzle}
                highlightedRows={highlightedRows}
                instant={studiedOnce}
                onFirstTrace={() => {
                  sfx.chime();
                  showToast("Shared piece found — it repeats across rows.", 3500);
                }}
                onReady={() => {
                  if (!studiedOnce) {
                    setStudiedOnce(true);
                    track("study_complete", { puzzle: puzzle.id });
                  }
                  sfx.whoosh();
                  setPhase("solve");
                }}
              />
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
                          ? "pa-bg-20 border-2 pa-border pa-text"
                          : locked[i] && grades.get(q.id)?.isCorrect
                            ? "bg-emerald-400/15 border border-emerald-400/50 text-emerald-400"
                            : locked[i]
                              ? "bg-red-400/10 border border-red-400/40 text-red-400/70"
                              : "bg-white/5 border border-white/15 text-white/80"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {/* Query flavor — scenario framing */}
                {query.flavor && (
                  <p className="text-center text-[12px] text-white/45 italic mb-1.5">
                    {query.flavor}
                  </p>
                )}

                {/* Query prompt — manuscript serif, with shake animation */}
                <motion.p
                  animate={shaking ? { x: [0, -4, 4, -4, 4, -2, 2, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center text-white/85 text-lg mb-5 leading-relaxed"
                >
                  {query.prompt}
                  {query.difficulty === "curveball" && (
                    <motion.span
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="ml-2 text-[10px] text-amber-400/80 font-mono align-middle"
                    >
                      ⚡
                    </motion.span>
                  )}
                </motion.p>

                {/* Tutorial helper */}
                {/* Tutorial queries have a subtle glow on the prompt instead of text */}

                <LayoutGroup>
                {/* Answer slots — inscription sockets with flip + layoutId fly */}
                <div className="flex items-center justify-center gap-2 mb-5 flex-wrap perspective-[800px]">
                  {slots.map((slot, i) => {
                    const flipDelay = i * 0.1;
                    const isFlipped = slot.flipped && slot.grade;

                    return (
                      <motion.button
                        key={i}
                        onClick={() => handleSlotTap(i)}
                        whileTap={!isLocked && slot.morpheme ? { scale: 0.9 } : undefined}
                        animate={isFlipped ? {
                          rotateX: [0, 90, 0],
                          transition: { delay: flipDelay, duration: 0.4, times: [0, 0.5, 1] }
                        } : {}}
                        className={`min-w-[48px] min-h-[44px] h-11 px-3 rounded-md font-mono text-sm font-medium
                          border-2 transition-colors relative overflow-hidden ${
                          slot.grade
                            ? gradeColor(slot.grade)
                            : slot.morpheme
                              ? "socket-filled text-white/90"
                              : "socket-empty text-white/35"
                        }`}
                        style={{ transformStyle: "preserve-3d" }}
                      >
                        {slot.morpheme ? (
                          <span className="flex items-center gap-1">
                            <motion.span
                              layoutId={`tile-${slot.morpheme}-${currentQ}`}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className="block"
                            >
                              {slot.morpheme}
                            </motion.span>
                            {/* Symbol channel — grading must not rely on color alone */}
                            {slot.grade && (
                              <span className="text-[10px] leading-none" aria-hidden="true">
                                {slot.grade === "correct" ? "✓" : slot.grade === "misplaced" ? "⇄" : "✗"}
                              </span>
                            )}
                          </span>
                        ) : (
                          // Ghost tile hint: show first correct morpheme pulsing in Q1/Q2's first slot
                          ghostVisible && currentQ <= 1 && i === 0 && attempts[currentQ] === 0
                            ? <span className="text-white/20 animate-pulse">{query.answer[0]}</span>
                            : <span>·</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Wax-seal ritual — stamps the assembled word on correct */}
                <AnimatePresence>
                  {sealedQ === query.id && qGrade?.isCorrect && (
                    <motion.div
                      key="seal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-center mb-4"
                    >
                      <div className="relative">
                        <span className="seal-in seal-disc">✓</span>
                        <span className="ring-ping absolute inset-0 rounded-full border-2 pa-border-40" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Word assembly — appears after correct */}
                <AnimatePresence>
                  {assembled.has(query.id) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="text-center mb-4"
                    >
                      <span className="font-mono text-lg ps-text font-bold tracking-wide">
                        {assembled.get(query.id)}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hint on fail — subtle shake is the feedback, no text needed */}

                {/* Correct answer if locked wrong */}
                {isLocked && !qGrade?.isCorrect && (
                  <p className="text-center text-[12px] text-white/85 mb-4">
                    Answer: <span className="text-emerald-400/70 font-mono">{query.answerJoined}</span>
                  </p>
                )}

                {/* Morpheme bank */}
                {!isLocked && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                    {puzzle.morphemeBank.map((group, gi) => (
                      <div key={gi} className="contents">
                        {/* Visual divider between groups */}
                        {gi > 0 && (
                          <span className="w-px h-8 bg-white/10 mx-1 shrink-0" />
                        )}
                        {group.map((m, i) => {
                          const revealed = revealedMorphemes.get(m);
                          // Check if this tile is already placed in a slot
                          const isPlaced = slots.some((s) => s.morpheme === m);
                          return (
                            <motion.button
                              key={`${m}-${gi}-${i}`}
                              onClick={() => !isPlaced && handleTilePlace(m)}
                              disabled={isPlaced}
                              className={`tablet tablet-hover relative px-3 py-2.5 min-h-[44px] rounded font-mono text-[13px] border transition-all ${
                                isPlaced
                                  ? "opacity-0 border-transparent bg-transparent pointer-events-none"
                                  : "border-white/10 text-white/75"
                              }`}
                              whileTap={!isPlaced ? { scale: 0.92 } : undefined}
                              title={revealed || undefined}
                            >
                              {!isPlaced ? (
                                <motion.span
                                  layoutId={`tile-${m}-${currentQ}`}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  className="block"
                                >
                                  {m}
                                </motion.span>
                              ) : (
                                <span className="invisible">{m}</span>
                              )}
                              {revealed && !isPlaced && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: puzzle.theme.accent }} />}
                            </motion.button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
                </LayoutGroup>

                {/* Coach caption — visible until the first tile is placed */}
                {!everPlaced && !isLocked && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-center text-[11px] text-white/40 mb-3"
                  >
                    tap tiles in order · tap a placed tile to remove it
                  </motion.p>
                )}

                {/* Forfeit — after 2 failed attempts, an honest way out */}
                {!isLocked && forfeitArmed === currentQ && (
                  <div className="text-center mb-4">
                    {!forfeitConfirm ? (
                      <button
                        onClick={() => setForfeitConfirm(true)}
                        className="text-[11px] font-mono text-white/35 hover:text-white/60 transition-colors underline underline-offset-4 decoration-white/15 min-h-[44px]"
                      >
                        stuck? reveal this one
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-4 text-[11px] font-mono">
                        <button
                          onClick={handleForfeit}
                          className="text-red-300/70 hover:text-red-300 transition-colors min-h-[44px]"
                        >
                          reveal — counts as missed
                        </button>
                        <button
                          onClick={() => setForfeitConfirm(false)}
                          className="text-white/50 hover:text-white/80 transition-colors min-h-[44px]"
                        >
                          keep trying
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {/* Submit / navigation */}
                <div className="flex items-center justify-center gap-3">
                  {!isLocked && (
                    <button
                      onClick={handleSubmit}
                      disabled={!slots.some((s) => s.morpheme)}
                      className="px-5 py-2 rounded-md pa-bg-solid text-sm font-bold text-black disabled:opacity-30 transition-all min-h-[44px]"
                    >
                      Check
                    </button>
                  )}
                  {!isLocked && slots.filter((s) => s.morpheme).length >= 2 && (
                    <button
                      onClick={handleClear}
                      className="px-3 py-2 rounded-md text-[12px] font-mono text-white/45 hover:text-white/75 hover:bg-white/5 transition-colors min-h-[44px]"
                      aria-label="Remove all placed tiles"
                    >
                      clear
                    </button>
                  )}
                  {isLocked && !allLocked && (
                    <button
                      onClick={() => {
                        const next = locked.findIndex((l, i) => !l && i !== currentQ);
                        if (next !== -1) setCurrentQ(next);
                      }}
                      className="px-5 py-2 rounded-md border border-white/20 text-sm text-white/85 hover:bg-white/5 transition-colors min-h-[44px]"
                    >
                      Next →
                    </button>
                  )}
                  <button
                    onClick={() => { sfx.page(); setEvidenceOpen(true); setSeenEvidence(true); track("evidence_open", { puzzle: puzzle.id }); }}
                    className={`w-11 min-h-[44px] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors rounded-md hover:bg-white/5 ${!seenEvidence ? "evidence-nudge" : ""}`}
                    aria-label="Open evidence panel"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                  </button>
                </div>

                {/* Grading legend — appears after the first submit teaches the colors */}
                {everSubmitted && !allLocked && (
                  <p className="text-center text-[10px] font-mono text-white/35 mt-3" aria-hidden="true">
                    ✓ right slot · ⇄ right piece, wrong slot · ✗ not in answer
                  </p>
                )}

                {/* Keyboard legend — fine-pointer devices only */}
                <p className="hidden [@media(pointer:fine)]:block text-center text-[10px] font-mono text-white/20 mt-3">
                  1–9 place · ⌫ remove · ↵ check · H hint · E evidence
                </p>
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
              {/* Glyphs of the language drift upward through the celebration */}
              <GlyphDrift glyphs={driftGlyphs} accent={puzzle.theme.accent} />

              <div className="max-w-lg mx-auto w-full flex-1 relative z-10">

                {/* ═══ Celebration — visible without scrolling ═══ */}
                <div className="flex flex-col items-center justify-center min-h-[45svh] py-6">

                  {/* Big score — manuscript numerals */}
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className={`text-6xl font-bold tabular-nums ${allCorrect ? "ps-text" : "text-white/90"}`}
                  >
                    {score}/{puzzle.queries.length}
                  </motion.p>

                  {/* Flawless tier — no hints, no reveals, no context peeks */}
                  {allCorrect && hintsUsed === 0 && contextReveals === 0 &&
                    ![...grades.values()].some((g) => g.revealed) && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 }}
                      className="mt-2 text-[12px] font-mono pa-text tracking-widest uppercase"
                    >
                      ✦ flawless — pure deduction
                    </motion.p>
                  )}

                  {/* Warm verdict — manuscript italic */}
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-3 text-[17px] font-display italic text-white/75 text-center leading-relaxed"
                  >
                    {allCorrect
                      ? puzzle.verdicts.perfect
                      : score >= puzzle.queries.length * 0.6
                        ? puzzle.verdicts.good
                        : puzzle.verdicts.partial}
                  </motion.p>

                  {/* Honest framing for assisted finishes */}
                  {[...grades.values()].some((g) => g.revealed) && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mt-1 text-[12px] font-display italic text-white/45 text-center"
                    >
                      cracked with a reveal — the pattern is still yours.
                    </motion.p>
                  )}

                  {/* Ornament rule — separates verdict from stats */}
                  <OrnamentRule className="mt-4 w-32" />

                  {/* Time + hints (smaller, secondary) */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-3 text-[11px] font-mono text-white/40"
                  >
                    {timeStr}
                    {hintsUsed > 0 ? ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}` : ""}
                    {contextReveals > 0 ? " · context revealed" : ""}
                    {allCorrect && hintsUsed === 0 && contextReveals === 0 ? " · ✨ no hints" : ""}
                  </motion.p>

                  {/* Streak badge — the habit engine, front and center */}
                  {progress && progress.streak > 1 && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-2 text-[12px] font-mono pa-text"
                      aria-live="polite"
                    >
                      🔥 {progress.streak}-day streak
                    </motion.p>
                  )}

                  {/* Day-1 line — teach the streak mechanic before it pays off */}
                  {progress && progress.streak <= 1 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-2 text-[11px] font-mono text-white/40"
                    >
                      day 1 — solve tomorrow to start a streak 🔥
                    </motion.p>
                  )}

                  {/* Ghost time — a friend challenged you to beat their time */}
                  {ghostTime && (() => {
                    const toSecs = (t: string) => {
                      const [mm, ss] = t.split(":").map(Number);
                      return mm * 60 + ss;
                    };
                    const beaten = toSecs(timeStr) <= toSecs(ghostTime);
                    return (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.65 }}
                      className="mt-2 text-[11px] font-mono text-white/55"
                    >
                      ⏱ friend&apos;s time: {ghostTime} — {beaten ? "you beat it." : "they got you this time."}
                    </motion.p>
                    );
                  })()}

                  {/* Card-flip result grid — themed seals */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-5 flex items-center justify-center gap-2"
                  >
                    {puzzle.queries.map((q, i) => {
                      const g = grades.get(q.id);
                      const correct = g?.isCorrect;
                      return (
                        <div key={q.id} className="card-flip w-10 h-10">
                          <motion.div
                            className="card-flip-inner relative w-full h-full"
                            initial={{ rotateY: 0 }}
                            animate={{ rotateY: 180 }}
                            transition={{ delay: 0.6 + i * 0.15, duration: 0.5, ease: "easeInOut" }}
                            style={{ transformStyle: "preserve-3d" }}
                          >
                            {/* Back (face-down) */}
                            <div className="card-face card-back">
                              <span className="text-white/20 text-sm font-mono">{i + 1}</span>
                            </div>
                            {/* Front (revealed) — wax seal for correct, ash for missed */}
                            <div className={`card-face card-front ${correct ? "pa-bg-15 pa-border-40" : "bg-red-400/15 border border-red-400/30"}`}>
                              <span className={`text-sm font-bold ${correct ? "pa-text" : "text-red-400/80"}`}>
                                {correct ? "✓" : "✗"}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                  </motion.div>

                  {/* Share + challenge — always available, never gated on the GPU */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="mt-6 flex items-center justify-center gap-3 flex-wrap"
                  >
                    <button
                      onClick={handleShare}
                      className="px-6 py-2.5 rounded-full pa-chip text-sm font-mono transition-all min-h-[44px]"
                    >
                      {copied ? "Copied!" : "Share result"}
                    </button>
                    <button
                      onClick={() => {
                        const url = getChallengeUrl(puzzle.id, timeStr);
                        navigator.clipboard.writeText(url).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                      className={allCorrect
                        ? "px-6 py-2.5 rounded-full pa-bg-solid text-sm font-bold text-black transition-all min-h-[44px]"
                        : "px-4 py-2.5 rounded-full text-[11px] font-mono text-white/40 hover:text-white/70 transition-colors min-h-[44px]"}
                    >
                      Challenge a friend →
                    </button>
                  </motion.div>

                  {/* Machine still thinking? Say so — don't gate sharing on it */}
                  {!aiSettled && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.1 }}
                      className="mt-2 text-[10px] font-mono text-white/30"
                    >
                      the machine is still thinking — the verdict lands below
                    </motion.p>
                  )}

                  {/* Social proof */}
                  {solveCount !== null && solveCount > 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.3 }}
                      className="mt-3 text-[10px] font-mono text-white/30"
                    >
                      {solveCount} solved today
                    </motion.p>
                  )}
                </div>

                {/* ═══ What you discovered ═══ */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0 }}
                  className="max-w-md mx-auto w-full"
                >
                  <div className="archive-card rounded-xl p-5 border border-white/10">
                    <h3 className="font-display text-[15px] font-bold text-white mb-2">
                      What you discovered
                    </h3>
                    <p className="text-[13px] text-white/70 leading-relaxed mb-3">
                      {puzzle.instruction}
                    </p>
                    <p className="text-[13px] font-display italic text-white/60 leading-relaxed">
                      &ldquo;{puzzle.lore.culturalNote}&rdquo;
                    </p>
                  </div>
                </motion.div>

                {/* ═══ Act II — the machine's turn (the brand moment) ═══ */}
                <div className="flex items-center gap-3 py-6">
                  <span className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                    the machine&rsquo;s turn
                  </span>
                  <span className="flex-1 h-px bg-white/10" />
                </div>

                <div
                  ref={aiVerdictRef}
                  className={`rounded-xl transition-shadow duration-700 ${aiFlash ? "shadow-[0_0_32px_-4px_var(--puzzle-accent)]" : ""}`}
                >
                <AiComparison
                  puzzle={puzzle}
                  humanElapsed={elapsed}
                  humanHints={hintsUsed}
                  humanGrades={grades}
                  onResult={(r) => {
                    setAiResult(r);
                    const aiCorrect = puzzle.queries.filter((q, i) =>
                      (r.pred[i] || "").trim().toLowerCase() === q.answerJoined.toLowerCase()
                    ).length;
                    const humanCorrect = puzzle.queries.filter((q) => grades.get(q.id)?.isCorrect).length;
                    track("ai_verdict", {
                      puzzle: puzzle.id,
                      outcome: humanCorrect > aiCorrect ? "win" : humanCorrect === aiCorrect ? "tie" : "loss",
                    });
                  }}
                  onSettled={() => {
                    setAiSettled(true);
                    // Spectacle: bring the verdict into view + pulse once
                    setAiFlash(true);
                    setTimeout(() => setAiFlash(false), 1800);
                    aiVerdictRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    sfx.chime();
                    setAnnounce("The machine's verdict is in.");
                  }}
                />
                </div>

                {/* ═══ Details — below the fold ═══ */}
                <div className="space-y-4 pb-6 pt-6">

                  {/* Solve trace — collapsed by default */}
                  <details className="rounded-lg border border-white/8 bg-white/[0.01]">
                    <summary className="px-4 py-3 text-[11px] font-mono text-white/60 uppercase tracking-wider cursor-pointer hover:text-white/80 min-h-[44px] flex items-center">
                      Solve trace
                    </summary>
                    <div className="divide-y divide-white/5">
                      {puzzle.queries.map((q, i) => {
                        const g = grades.get(q.id);
                        const correct = g?.isCorrect;
                        return (
                          <div key={q.id} className="px-4 py-2 flex items-center gap-2">
                            <span className={`text-[11px] font-mono shrink-0 ${correct ? "text-emerald-400" : "text-red-400/70"}`}>
                              {correct ? "✓" : "✗"}
                            </span>
                            <span className="text-[12px] text-white/70 flex-1 truncate">{q.prompt}</span>
                            <span className="text-[11px] font-mono text-emerald-400/60 shrink-0">{q.answerJoined}</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  {/* Audio moment — field recordings live here as speakers
                      record them; absence is a coming-soon, not a gap */}
                  {allCorrect && puzzle.id === "apurina-verb-agreement" && (
                    <>
                      <AudioMoment
                        audioSrc="/audio/apurina-forms.mp3"
                        language={puzzle.language}
                        transcript={puzzle.queries.map((q) => q.answerJoined).join(" · ")}
                      />
                      <p className="text-center text-[10px] font-mono text-white/30 -mt-2">
                        field recording · more languages soon
                      </p>
                    </>
                  )}

                  {/* Map — collapsed so the duel stays the climax */}
                  <details className="rounded-lg border border-white/8 bg-white/[0.01]">
                    <summary className="px-4 py-3 text-[11px] font-mono text-white/60 uppercase tracking-wider cursor-pointer hover:text-white/80 min-h-[44px] flex items-center">
                      Language map
                    </summary>
                    <div className="px-3 pb-3">
                      <LanguageMap
                        progress={progress}
                        currentLanguageCode={puzzle.languageCode}
                        currentCoordinates={puzzle.lore.coordinates}
                        currentLanguage={puzzle.language}
                      />
                    </div>
                  </details>

                  {/* Lore */}
                  <details className="rounded-lg border border-white/8 bg-white/[0.01]">
                    <summary className="px-4 py-3 text-[11px] font-mono text-white/60 uppercase tracking-wider cursor-pointer hover:text-white/80 min-h-[44px] flex items-center">
                      About {puzzle.language}
                    </summary>
                    <div className="px-4 pb-4 space-y-2 text-[13px] text-white/75 leading-relaxed">
                      <p><span className="text-white/40 font-mono text-[10px]">WHERE</span> {puzzle.lore.geography}</p>
                      <p><span className="text-white/40 font-mono text-[10px]">SPEAKERS</span> {puzzle.lore.speakers}</p>
                      <p><span className="text-white/40 font-mono text-[10px]">STATUS</span> {puzzle.lore.endangerment}</p>
                      <p><span className="text-white/40 font-mono text-[10px]">NOTE</span> {puzzle.lore.funFact}</p>
                    </div>
                  </details>

                  {/* Next-day warmup teaser */}
                  <WarmupTeaser preview={puzzle.nextPreview} />

                  {/* Local record */}
                  {progress && (
                    <p className="text-center text-[10px] font-mono text-white/40">
                      🔥{progress.streak} · 🧩{progress.puzzlesSolved}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ═══ Evidence drawer — consult specimens without leaving the puzzle ═══ */}
      <AnimatePresence>
        {archiveOpen && (
          <ArchivePanel
            currentPuzzleId={puzzle.id}
            progress={progress}
            onClose={() => setArchiveOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {evidenceOpen && (
          <>
            <motion.div
              key="evidence-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/60"
              onClick={() => setEvidenceOpen(false)}
            />
            <motion.div
              key="evidence-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-x-0 bottom-0 z-40 max-h-[70svh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0d1017] px-4 py-5 sm:px-6"
              role="dialog"
              aria-label="Evidence"
            >
              <div className="max-w-lg mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-mono text-white/50 uppercase tracking-widest">
                    Evidence
                  </p>
                  <button
                    onClick={() => setEvidenceOpen(false)}
                    aria-label="Close evidence"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/50 hover:text-white/80 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <ContextPanel
                  pairs={puzzle.pairs.filter((p) => !p.gated || revealedGated)}
                  highlightedRows={highlightedRows}
                />
                {gatedCount > 0 && !revealedGated && (
                  <button
                    onClick={handleRevealGated}
                    className="mt-3 w-full rounded-lg border border-dashed border-white/15 px-4 py-3 text-[12px] font-mono text-white/50 hover:text-white/75 hover:border-white/25 transition-colors min-h-[44px]"
                  >
                    🔒 {gatedCount} more specimen{gatedCount !== 1 ? "s" : ""} hidden — reveal?
                  </button>
                )}
                {revealedGated && gatedCount > 0 && (
                  <p className="mt-3 text-center text-[10px] font-mono text-white/30">
                    all specimens revealed
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* end of main frame */}
    </div>
  );
};
