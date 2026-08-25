"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Puzzle, QueryGrade } from "./puzzle-data";

// ─── Modal API config ───────────────────────────────────────────────────────

const BRANDED_BASE = "https://ratiocine.trustfall.xyz/api";
const DIRECT_SOLVE = "https://ungethe--ratiocine-solve.modal.run/";
const DIRECT_STATUS = "https://ungethe--ratiocine-status.modal.run/";

async function resolveBase(): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    await fetch(`${BRANDED_BASE}/status?id=ping`, { signal: ctrl.signal });
    clearTimeout(t);
    return BRANDED_BASE;
  } catch {
    return "";
  }
}

function solveUrl(base: string) {
  return base ? `${base}/solve` : DIRECT_SOLVE;
}
function statusUrl(base: string, id: string) {
  return base
    ? `${base}/status?id=${encodeURIComponent(id)}`
    : `${DIRECT_STATUS}?id=${encodeURIComponent(id)}`;
}

// ─── localStorage cache ─────────────────────────────────────────────────────

const AI_CACHE_PREFIX = "ration-ai-result-";

function getCachedResult(puzzleId: string): AiResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AI_CACHE_PREFIX + puzzleId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedResult(puzzleId: string, result: AiResult): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_CACHE_PREFIX + puzzleId, JSON.stringify(result));
  } catch {}
}

// ─── Ration attestation stub ────────────────────────────────────────────────

// Fires attest_entry in background when a canister endpoint is configured.
// Currently a no-op stub — replace CANISTER_URL when mainnet is live.
const CANISTER_URL: string | null = null; // e.g. "http://localhost:8000" or mainnet URL

async function attestInBackground(puzzle: Puzzle, aiResult: AiResult): Promise<void> {
  if (!CANISTER_URL) return; // silent no-op until mainnet

  const payload = {
    job_id: `${puzzle.id}-${Date.now()}`,
    problem: puzzle.queries.map((q) => q.prompt).join("\n"),
    reference: puzzle.queries.map((q) => q.answerJoined),
    prediction: aiResult.pred,
    model_label: aiResult.model,
    evaluator_version: "showcase-v1",
  };

  try {
    await fetch(`${CANISTER_URL}/api/v1/app/ratiocine/call/attest_entry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Attestation is best-effort; never block UX
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type AiPhase = "idle" | "cached" | "submitting" | "queued" | "waking" | "loading" | "deducing" | "done" | "error";

export interface AiResult {
  pred: string[];
  model: string;
  elapsed_s: number;
  explanation?: string;
}

interface Props {
  puzzle: Puzzle;
  humanElapsed: number;
  humanHints: number;
  humanGrades: Map<number, QueryGrade>;
  onResult?: (result: AiResult) => void;
  /** Fires when AI comparison settles (done, cached, or error) so parent can gate share */
  onSettled?: () => void;
}

// ─── Phase display ──────────────────────────────────────────────────────────

const PHASE_LABELS: Record<AiPhase, string> = {
  idle: "",
  cached: "",
  submitting: "Sending the same puzzle to the machine...",
  queued: "Queued for a GPU worker...",
  waking: "Waking up the neural network...",
  loading: "Loading 14 billion parameters...",
  deducing: "The machine is thinking...",
  done: "",
  error: "Something went wrong.",
};

const PHASE_ACCENTS: Partial<Record<AiPhase, string>> = {
  waking: "text-sky-300/70",
  loading: "text-sky-300/70",
  deducing: "text-amber-300/80",
};

// ─── Component ──────────────────────────────────────────────────────────────

export const AiComparison = ({ puzzle, humanElapsed, humanHints, humanGrades, onResult, onSettled }: Props) => {
  const [phase, setPhase] = useState<AiPhase>("idle");
  const [detail, setDetail] = useState("");
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiElapsed, setAiElapsed] = useState(0);
  const [error, setError] = useState("");

  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const baseRef = useRef("");
  const startedRef = useRef(false);
  const settledRef = useRef(false);

  const markSettled = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [onSettled]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const doSolve = useCallback(async () => {
    setPhase("submitting");
    setError("");
    startRef.current = Date.now();

    const base = await resolveBase();
    baseRef.current = base;

    // Build the context and query from puzzle data
    const context = [
      `Language: ${puzzle.language}`,
      `Task: ${puzzle.title.toLowerCase()}`,
      "",
      "Evidence:",
      ...puzzle.pairs.map((pair, i) => `${i + 1}. ${pair.source} = ${pair.target}`),
    ].join("\n");

    const query = [
      "Translate each English phrase into " + puzzle.language + ".",
      "Return one unsegmented verb form per numbered item, in order.",
      "",
      ...puzzle.queries.map((q, i) => `${i + 1}. ${q.prompt}`),
    ].join("\n");

    try {
      const resp = await fetch(solveUrl(base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context, query, task_type: puzzle.taskType }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Submit failed");

      jobIdRef.current = data.job_id;
      setPhase("queued");

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setAiElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);

      // Poll
      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(statusUrl(baseRef.current, jobIdRef.current!));
          const st = await sr.json();
          if (!sr.ok) throw new Error(st.error || "Poll failed");

          const p = st.phase as AiPhase;
          setPhase(p);
          setDetail(st.detail || "");

          if (p === "done") {
            stopPolling();
            const result: AiResult = {
              pred: st.result?.pred ?? [],
              model: st.result?.model ?? "unknown",
              elapsed_s: st.result?.elapsed_s ?? Math.floor((Date.now() - startRef.current) / 1000),
              explanation: st.result?.explanation,
            };
            setAiResult(result);
            setCachedResult(puzzle.id, result);
            onResult?.(result);
            markSettled();
            // Fire attestation in background
            attestInBackground(puzzle, result);
          } else if (p === "error") {
            stopPolling();
            setError(st.detail || "Unknown error");
            markSettled();
          }
        } catch (e: any) {
          stopPolling();
          setError(e.message);
          setPhase("error");
          markSettled();
        }
      }, 2500);
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
      markSettled();
    }
  }, [puzzle, stopPolling, onResult, markSettled]);

  // Auto-start on mount — check cache first
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const cached = getCachedResult(puzzle.id);
    if (cached) {
      setAiResult(cached);
      setPhase("cached");
      onResult?.(cached);
      markSettled();
      return;
    }

    doSolve();
    return () => stopPolling();
  }, [puzzle, stopPolling, onResult, markSettled, doSolve]);

  // Retry handler
  const handleRetry = useCallback(() => {
    stopPolling();
    settledRef.current = false;
    doSolve();
  }, [doSolve, stopPolling]);

  // ─── Grading the AI result ────────────────────────────────────────────────

  const aiGrades = aiResult ? puzzle.queries.map((q, i) => {
    const predicted = (aiResult.pred[i] || "").trim().toLowerCase();
    const expected = q.answerJoined.toLowerCase();
    return predicted === expected;
  }) : null;

  const aiCorrectCount = aiGrades ? aiGrades.filter(Boolean).length : 0;
  const humanCorrectCount = puzzle.queries.filter((q) => humanGrades.get(q.id)?.isCorrect).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  const isRunning = ["submitting", "queued", "waking", "loading", "deducing"].includes(phase);
  const isDone = phase === "done" || phase === "cached";
  const humanMins = Math.floor(humanElapsed / 60);
  const humanSecs = humanElapsed % 60;
  const humanTimeStr = `${humanMins}:${humanSecs.toString().padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.01] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
          Same puzzle, same grading
        </span>
        <div className="flex items-center gap-2">
          {phase === "cached" && (
            <span className="text-[9px] font-mono text-white/20">cached</span>
          )}
          {isRunning && (
            <span className="text-[10px] font-mono text-white/25 tabular-nums">
              {aiElapsed}s
            </span>
          )}
        </div>
      </div>

      {/* Running state */}
      <AnimatePresence mode="wait">
        {isRunning && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-5 flex flex-col items-center gap-3"
          >
            {/* Pulse indicator */}
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-amber-400"
              />
              <span className={`text-[12px] font-mono ${PHASE_ACCENTS[phase] || "text-white/50"}`}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {detail && phase === "deducing" && (
              <p className="text-[11px] text-white/30 font-mono">{detail}</p>
            )}
          </motion.div>
        )}

        {/* Error */}
        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-4 text-center space-y-2"
          >
            <p className="text-[12px] text-red-400/70">{error}</p>
            <p className="text-[11px] text-white/25">The comparison is optional — your solve still counts.</p>
            <button
              onClick={handleRetry}
              className="mt-1 px-3 py-1.5 rounded border border-white/15 text-[11px] font-mono text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors min-h-[36px]"
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Result: side-by-side comparison */}
        {isDone && aiResult && aiGrades && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="px-4 py-4 space-y-4"
          >
            {/* Score summary row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Human */}
              <div className="rounded-md bg-emerald-400/[0.04] border border-emerald-400/15 px-3 py-2.5">
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">You</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">
                  {humanCorrectCount}/{puzzle.queries.length}
                </p>
                <p className="text-[10px] font-mono text-white/30 mt-0.5">
                  {humanTimeStr} · {humanHints > 0 ? `${humanHints} hint${humanHints > 1 ? "s" : ""}` : "no hints"}
                </p>
              </div>

              {/* VS */}
              <div className="flex items-center justify-center">
                <span className="text-[11px] font-mono text-white/20">vs</span>
              </div>

              {/* AI */}
              <div className="rounded-md bg-sky-400/[0.04] border border-sky-400/15 px-3 py-2.5">
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Machine</p>
                <p className="text-lg font-bold text-sky-400 mt-0.5">
                  {aiCorrectCount}/{puzzle.queries.length}
                </p>
                <p className="text-[10px] font-mono text-white/30 mt-0.5">
                  {aiResult.elapsed_s}s · no hints
                </p>
              </div>
            </div>

            {/* Per-query comparison */}
            <div className="space-y-1">
              {puzzle.queries.map((q, i) => {
                const humanCorrect = humanGrades.get(q.id)?.isCorrect ?? false;
                const aiCorrect = aiGrades[i];
                const aiAnswer = (aiResult.pred[i] || "—").trim();

                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.015]"
                  >
                    <span className="text-[10px] font-mono text-white/20 w-5 shrink-0">Q{i + 1}</span>

                    {/* Human */}
                    <span className={`text-[11px] font-mono flex-1 truncate ${humanCorrect ? "text-emerald-400/80" : "text-red-400/60"}`}>
                      {humanCorrect ? q.answerJoined : "miss"}
                    </span>

                    {/* Divider */}
                    <span className="text-white/10 text-[10px]">|</span>

                    {/* AI */}
                    <span className={`text-[11px] font-mono flex-1 truncate text-right ${aiCorrect ? "text-sky-400/80" : "text-red-400/60"}`}>
                      {aiAnswer}
                    </span>

                    {/* Match indicators */}
                    <div className="flex gap-0.5 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${humanCorrect ? "bg-emerald-400" : "bg-red-400/50"}`} />
                      <span className={`w-1.5 h-1.5 rounded-full ${aiCorrect ? "bg-sky-400" : "bg-red-400/50"}`} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Verdict */}
            <div className="text-center pt-1">
              {humanCorrectCount > aiCorrectCount && (
                <p className="text-[12px] text-emerald-400/80 font-medium">You outperformed the machine.</p>
              )}
              {humanCorrectCount === aiCorrectCount && humanCorrectCount === puzzle.queries.length && (
                <p className="text-[12px] text-white/50">Both perfect — but you needed {humanTimeStr}. It took {aiResult.elapsed_s}s.</p>
              )}
              {humanCorrectCount === aiCorrectCount && humanCorrectCount < puzzle.queries.length && (
                <p className="text-[12px] text-white/50">Same score. Neither cracked it fully.</p>
              )}
              {humanCorrectCount < aiCorrectCount && (
                <p className="text-[12px] text-sky-400/70">The machine got more right — this time.</p>
              )}
              <p className="text-[10px] font-mono text-white/20 mt-1.5">
                {aiResult.model} · graded by the same EM algorithm
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
