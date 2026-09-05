import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { cx, nt } from "neutron-design-system";
import {
  createCanisterClient,
  loadNeutronCanisterId,
  loadTileContext,
  type NeutronCanisterClient,
} from "neutron-tools/app";
import {
  APURINA_CASE,
  APURINA_CASE_HASH,
  APURINA_CASE_VERSION,
  loadApurinaHandoff,
  type HumanOutcome,
} from "./apurina-case";
import { APP_PROBLEMS } from "./problems";
import "./style.scss";

// ---------------------------------------------------------------------------
// Config — ratiocine.trustfall.xyz points at Vercel which rewrites /api/* to
// Modal. DIRECT_BASE is the fallback if the domain isn't reachable.
// ---------------------------------------------------------------------------
const BRANDED_BASE = "https://ratiocine.trustfall.xyz/api";
const DIRECT_BASE = "https://ungethe--ratiocine-solve.modal.run";
const DIRECT_STATUS = "https://ungethe--ratiocine-status.modal.run";

// Resolve API base: try branded first, fall back to direct Modal.
let apiBase: string | null = null;
async function resolveApiBase(): Promise<string> {
  if (apiBase) return apiBase;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    await fetch(`${BRANDED_BASE}/status?id=healthcheck`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    apiBase = BRANDED_BASE;
  } catch {
    apiBase = ""; // signal to use direct
  }
  return apiBase;
}

function submitUrl(base: string) {
  return base ? `${base}/solve` : `${DIRECT_BASE}/`;
}
function statusUrl(base: string, id: string) {
  return base
    ? `${base}/status?id=${encodeURIComponent(id)}`
    : `${DIRECT_STATUS}/?id=${encodeURIComponent(id)}`;
}

// ---------------------------------------------------------------------------
// Sample problem bank — ten real IOL-style language problems, generated from
// the showcase puzzle set (see src/problems.ts). Every one ships ground
// truth, so the canister grades deterministically before chain-key signing.
// ---------------------------------------------------------------------------
type Problem = {
  id: string;
  label: string;
  language?: string;
  family?: string;
  region?: string;
  task_type: string;
  context: string;
  query: string;
  ground_truth?: string[];
};

const PROBLEMS: Problem[] = APP_PROBLEMS;

// ---------------------------------------------------------------------------
// Insight cards shown while waiting
// ---------------------------------------------------------------------------
const INSIGHTS = [
  {
    title: "Why the wait?",
    body: "We don't keep a GPU running 24/7. The engine wakes up only when you ask it to think — that's what keeps it free.",
  },
  {
    title: "The engine",
    body: "Qwen3-14B-AWQ: 14 billion parameters, 4-bit quantized, running on a single L4 GPU.",
  },
  {
    title: "What is the IOL?",
    body: "The International Linguistics Olympiad gives contestants puzzles in real, often endangered languages — no prior knowledge required, only logic.",
  },
  {
    title: "Verifiable by design",
    body: "Once the answer arrives, the canister grades it deterministically (exact match + chrF) and signs the receipt with a chain-key. No one can tamper with the record.",
  },
  {
    title: "Benchmark",
    body: "Best Linguini score so far: 0.1255 — on par with top human submissions on the 160-problem set.",
  },
];

// ---------------------------------------------------------------------------
// Phase model
// ---------------------------------------------------------------------------
type Phase = "idle" | "queued" | "waking" | "loading" | "deducing" | "done" | "error";

const PHASE_STEPS: { key: Phase; label: string; icon: string }[] = [
  { key: "queued", label: "Queued", icon: "○" },
  { key: "waking", label: "Waking GPU", icon: "◐" },
  { key: "loading", label: "Loading 14B params", icon: "◑" },
  { key: "deducing", label: "Deducing", icon: "◕" },
  { key: "done", label: "Complete", icon: "●" },
];

function phaseIndex(p: Phase): number {
  const i = PHASE_STEPS.findIndex((s) => s.key === p);
  return i === -1 ? 0 : i;
}

// ---------------------------------------------------------------------------
// Attest result helpers (Candid variants may decode as object or tuple)
// ---------------------------------------------------------------------------
type LedgerEntry = {
  seq: number;
  ts: number;
  job_id: string;
  problem_id: string;
  context_hash: string;
  prompt: string;
  prompt_hash?: string;
  ground_truth_hash?: string | null;
  case_version?: string | null;
  case_hash?: string | null;
  human_outcome_hash?: string | null;
  grading_version?: string;
  pred: string[];
  model: string;
  em: number | null;
  chrf: number | null;
  score: number | null;
  assertion: string;
  assertion_hash: string;
  signature: unknown;
};

// Candid opt encodings vary (bare value, [value], null).
function optNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (Array.isArray(v)) return optNum(v[0]);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      const n = optNum(o[k]);
      if (n !== null) return n;
    }
  }
  return null;
}

function asEntry(raw: unknown): LedgerEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  let rec: Record<string, unknown> | null = null;
  // object-encoded variant: { attested: {...} }
  if (r.attested && typeof r.attested === "object") {
    rec = r.attested as Record<string, unknown>;
  } else if (
    Array.isArray(raw) &&
    raw[0] === "attested" &&
    typeof raw[1] === "object"
  ) {
    // tuple-encoded variant: ["attested", {...}]
    rec = raw[1] as Record<string, unknown>;
  } else if (r.seq !== undefined && typeof r.problem_id === "string") {
    // plain record
    rec = r;
  }
  if (!rec) return null;
  const e = rec as unknown as LedgerEntry;
  e.em = optNum(e.em);
  e.chrf = optNum(e.chrf);
  e.score = optNum(e.score);
  if (typeof e.seq === "string") e.seq = Number(e.seq);
  if (typeof e.ts === "string") e.ts = Number(e.ts);
  return e;
}

function sigBytes(sig: unknown): number {
  if (typeof sig === "string") return Math.floor(sig.length * 0.75);
  if (sig && typeof sig === "object") {
    const s = sig as Record<string, unknown>;
    if (typeof s.byteLength === "number") return s.byteLength;
  }
  if (Array.isArray(sig)) return sig.length;
  return 0;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export const App = () => {
  const [client, setClient] = useState<NeutronCanisterClient | null>(null);
  const [tileContext] = useState(() => loadTileContext());
  const [handoff] = useState<HumanOutcome | null>(() => loadApurinaHandoff());
  const handoffProblem: Problem = {
    id: APURINA_CASE.id,
    label: APURINA_CASE.label,
    task_type: APURINA_CASE.task_type,
    context: APURINA_CASE.context,
    query: APURINA_CASE.query,
    ground_truth: [...APURINA_CASE.ground_truth],
  };

  const [selected, setSelected] = useState(PROBLEMS[0].id);
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState("");
  const [result, setResult] = useState<any>(null);
  const [entry, setEntry] = useState<LedgerEntry | null>(null);
  const [attestError, setAttestError] = useState("");
  const [attestBusy, setAttestBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [forgeMode, setForgeMode] = useState(false);
  const [forgeType, setForgeType] = useState<"output" | "model">("output");
  const [tamperedValue, setTamperedValue] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [insightIdx, setInsightIdx] = useState(0);
  const [error, setError] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerErr, setLedgerErr] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [lastReportSeq, setLastReportSeq] = useState(0);

  const jobIdRef = useRef<string | null>(null);
  const problemRef = useRef<Problem | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insightRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const baseRef = useRef<string | null>(null);

  // Canister client
  useEffect(() => {
    let cancelled = false;
    loadNeutronCanisterId()
      .then((id) => {
        if (!cancelled) setClient(createCanisterClient(id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadLedger = useCallback(async () => {
    if (!client) return;
    try {
      const raw = await client.callDialog("get_ledger", [null]);
      const list = Array.isArray(raw) ? raw : [];
      setLedger(list.map(asEntry).filter((e): e is LedgerEntry => e !== null));
      setLedgerErr("");
    } catch (e: any) {
      setLedgerErr(String(e?.message ?? e));
    }
    // Fetch ledger status for publish delta indicator.
    try {
      const status = await client.callDialog("get_ledger_status", [null]);
      if (status && typeof status === "object") {
        const s = status as Record<string, unknown>;
        const lrs = Number(s.last_report_seq ?? 0);
        if (Number.isFinite(lrs)) setLastReportSeq(lrs);
      }
    } catch {
      // Non-critical; ignore.
    }
  }, [client]);

  useEffect(() => {
    if (client) void loadLedger();
  }, [client, loadLedger]);

  // Publish the full ledger as a certified asset; returns a public URL.
  const publishReport = useCallback(async () => {
    if (!client) return;
    setReportBusy(true);
    setReportErr("");
    try {
      const raw = await client.callDialog("publish_report", [null]);
      const s = typeof raw === "string" ? raw : String(raw);
      if (s === "no_new_entries") {
        setReportErr("No new entries since last publish.");
      } else if (s === "empty_ledger") {
        setReportErr("Ledger is empty.");
      } else {
        const digest = s.split(":")[1];
        if (!digest) {
          setReportErr(s);
        } else {
          setReportUrl(
            `${window.location.origin}/app/ratiocine/_route/protocol/v1/ledger/report/${digest}`,
          );
          // Update the local tracking so the button reflects the new state.
          setLastReportSeq(ledger.length);
        }
      }
    } catch (e: any) {
      setReportErr("Publish error: " + String(e?.message ?? e));
    } finally {
      setReportBusy(false);
    }
  }, [client, ledger.length]);

  // Rotate insights while solving
  useEffect(() => {
    if (["queued", "waking", "loading", "deducing"].includes(phase)) {
      insightRef.current = setInterval(() => {
        setInsightIdx((i) => (i + 1) % INSIGHTS.length);
      }, 7000);
    }
    return () => {
      if (insightRef.current) clearInterval(insightRef.current);
    };
  }, [phase]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  const startSolve = useCallback(async () => {
    const problem = handoff
      ? handoffProblem
      : PROBLEMS.find((p) => p.id === selected)!;
    problemRef.current = problem;
    setError("");
    setResult(null);
    setEntry(null);
    setAttestError("");
    setPhase("queued");
    setDetail("Submitting…");
    setElapsed(0);
    startRef.current = Date.now();

    const base = await resolveApiBase();
    baseRef.current = base;

    try {
      const resp = await fetch(submitUrl(base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: problem.context,
          query: problem.query,
          task_type: problem.task_type,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Submit failed");
      jobIdRef.current = data.job_id;
      setPhase("queued");
      setDetail("Waiting for a GPU worker…");

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(statusUrl(baseRef.current || "", jobIdRef.current!));
          const st = await sr.json();
          if (!sr.ok) throw new Error(st.error || "Poll failed");

          setPhase(st.phase as Phase);
          setDetail(st.detail || "");

          if (st.phase === "done") {
            stopPolling();
            setResult(st.result);
          } else if (st.phase === "error") {
            stopPolling();
            setError(st.detail || "Unknown error");
          }
        } catch (e: any) {
          stopPolling();
          setError(e.message);
          setPhase("error");
        }
      }, 2500);
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  }, [selected, stopPolling, handoff, handoffProblem]);

  // Grade + sign + append to the certified ledger (all in-canister).
  const attestResult = useCallback(async () => {
    if (!client || !result || !problemRef.current) return;
    const p = problemRef.current;
    setAttestBusy(true);
    setAttestError("");
    setEntry(null);
    try {
      // Demonstration mode changes only submitted fields. The canister still
      // signs the submitted evaluation event and deterministically grades its output.
      let finalPred = result.pred ?? [];
      let finalModel = result.model ?? "";

      if (forgeMode) {
        if (forgeType === "output" && tamperedValue.trim()) {
          finalPred = [tamperedValue.trim()];
        }
        if (forgeType === "model" && tamperedValue.trim()) {
          finalModel = tamperedValue.trim();
        }
      }

      const raw = await client.callDialog("attest_entry", [
        {
          job_id: jobIdRef.current ?? "",
          problem_id: p.id,
          context: p.context,
          prompt: p.query,
          pred: finalPred,
          model: finalModel,
          model_version: result.model ? `Qwen3-14B-AWQ` : null,
          evaluator_version: "ration/v1.0",
          task_type: p.task_type,
          ground_truth: p.ground_truth ?? null,
          case_version: handoff ? APURINA_CASE_VERSION : null,
          case_hash: handoff ? APURINA_CASE_HASH : null,
          human_outcome: handoff
            ? {
                answers: handoff.answers,
                attempts: handoff.attempts,
                hints_used: handoff.hintsUsed,
                elapsed_s: handoff.elapsedSeconds,
                gated_context_revealed: handoff.gatedContextRevealed,
              }
            : null,
        },
      ]);
      const e = asEntry(raw);
      if (e) {
        setEntry(e);
        void loadLedger();
      } else if (raw && typeof raw === "object" && "error" in raw) {
        const errObj = raw as { error?: unknown };
        setAttestError(
          String(Array.isArray(errObj.error) ? errObj.error[1] ?? errObj.error[0] : errObj.error),
        );
      } else {
        setAttestError("Unrecognized attestation response");
      }
    } catch (e: any) {
      setAttestError("Attest error: " + String(e?.message ?? e));
    } finally {
      setAttestBusy(false);
    }
  }, [client, result, loadLedger, forgeMode, forgeType, tamperedValue, handoff]);

  const activeIdx = phaseIndex(phase);
  const isRunning = ["queued", "waking", "loading", "deducing"].includes(phase);

  // Instant demo: attest a canned perfect answer with no GPU round-trip, so
  // a reviewer sees grade → sign → ledger in seconds. The canister still
  // grades deterministically; only the "model" is declared as canned.
  const demoAttest = useCallback(async () => {
    if (!client) return;
    const p = PROBLEMS[0];
    setDemoBusy(true);
    setAttestError("");
    setEntry(null);
    try {
      const raw = await client.callDialog("attest_entry", [
        {
          job_id: `demo-${Date.now()}`,
          problem_id: p.id,
          context: p.context,
          prompt: p.query,
          pred: p.ground_truth ?? [],
          model: "demo-canned (no GPU)",
          model_version: null,
          evaluator_version: "ration/v1.0",
          task_type: p.task_type,
          ground_truth: p.ground_truth ?? null,
          case_version: null,
          case_hash: null,
          human_outcome: null,
        },
      ]);
      const e = asEntry(raw);
      if (e) {
        setEntry(e);
        setPhase("done");
        setResult({ pred: p.ground_truth ?? [], model: "demo-canned (no GPU)", elapsed_s: 0 });
        void loadLedger();
      } else if (raw && typeof raw === "object" && "error" in raw) {
        const errObj = raw as { error?: unknown };
        setAttestError(
          String(Array.isArray(errObj.error) ? errObj.error[1] ?? errObj.error[0] : errObj.error),
        );
      } else {
        setAttestError("Unrecognized attestation response");
      }
    } catch (e: any) {
      setAttestError("Attest error: " + String(e?.message ?? e));
    } finally {
      setDemoBusy(false);
    }
  }, [client, loadLedger]);

  return (
    <main className={cx(nt.appFill, "ration-app")}>
      <div className="nt-page ration-shell">
        {/* Header */}
        <header className={nt.pageHeader}>
          <div>
            <p className={nt.eyebrow}>You solved it. Now watch the machine try.</p>
            <h1 className={nt.title}>Ration</h1>
            <p className={cx(nt.text, nt.muted, "ration-tagline")}>
              Same puzzle. Same grading. Honest comparison.
            </p>
            <div className={nt.tagList}>
              <span className={nt.tag}>https_outcalls</span>
              <span className={nt.tag}>chain_key_signing</span>
              <span className={nt.tag}>certified_data</span>
            </div>
          </div>
          <dl className={cx(nt.kv, "ration-context")} aria-label="Tile context">
            <dt>App</dt>
            <dd>{tileContext.app ?? "app"}</dd>
            <dt>Tile</dt>
            <dd>{tileContext.tile ?? "tile"}</dd>
          </dl>
        </header>

        <main className={nt.pageMain}>
          {/* Problem picker */}
          <section className={nt.panel}>
            <div className="ration-row">
              <div>
                <h2 className={nt.subtitle}>Choose a problem</h2>
                <p className={cx(nt.text, nt.muted)}>
                  {handoff
                    ? "This is the exact Apurinã case declared by the browser handoff. Your solve details are shown beside the AI result before any canister attestation."
                    : "Pick a linguistics puzzle for the engine to solve. Problems marked graded have a known answer — the canister scores them with EM + chrF before signing."}
                </p>
              </div>
            </div>
            <div className="ration-problem-list">
              {(handoff ? [handoffProblem] : PROBLEMS).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cx("ration-problem-card", {
                    "ration-problem-card--active": handoff || selected === p.id,
                  })}
                  onClick={() => setSelected(p.id)}
                  disabled={isRunning || Boolean(handoff)}
                >
                  <span className="ration-problem-main">
                    <span className="ration-problem-label">{p.label}</span>
                    <span className="ration-problem-sub">
                      {[p.family, p.region].filter(Boolean).join(" · ")}
                      {p.ground_truth ? ` · ${p.ground_truth.length} items, graded` : ""}
                    </span>
                  </span>
                  <span className={cx(nt.tag, "ration-problem-type")}>
                    {p.task_type}
                  </span>
                </button>
              ))}
            </div>

            {/* Altered-submission demonstration */}
            <div className="ration-forge-toggle" role="group" aria-label="Altered submission demonstration">
              <label className="ration-forge-label">
                <input
                  type="checkbox"
                  checked={forgeMode}
                  onChange={(e) => setForgeMode(e.target.checked)}
                  disabled={isRunning}
                />
                <span>Submit an altered claim</span>
              </label>
              <span className="ration-forge-hint">
                Demonstration only: Ration signs and grades submitted data; it does not prove a remote model authored it.
              </span>
            </div>

            {forgeMode && !isRunning && (
              <div className="ration-danger-zone">
                <p className="ration-danger-title">Alter the submitted evaluation</p>
                <p className="ration-forge-hint">
                  Change the answer to see the deterministic grade change, or change the model label to see why model provenance is marked unverified.
                </p>
                <div className="ration-forge-options">
                  <label className="ration-forge-option">
                    <input
                      type="radio"
                      name="forge-type"
                      value="output"
                      checked={forgeType === "output"}
                      onChange={() => setForgeType("output")}
                    />
                    Modify submitted output
                  </label>
                  <label className="ration-forge-option">
                    <input
                      type="radio"
                      name="forge-type"
                      value="model"
                      checked={forgeType === "model"}
                      onChange={() => setForgeType("model")}
                    />
                    Modify submitted model label
                  </label>
                </div>
                <div className="ration-forge-input-group">
                  <input
                    className="ration-forge-input"
                    type="text"
                    placeholder={
                      forgeType === "output"
                        ? "Type a different submitted answer…"
                        : "Type a different submitted model label…"
                    }
                    value={tamperedValue}
                    onChange={(e) => setTamperedValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tamperedValue.trim() && result) {
                        void attestResult();
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <div className="ration-actions">
              <button
                className={cx(nt.button, "ration-solve-btn")}
                onClick={startSolve}
                disabled={isRunning}
                type="button"
              >
                {isRunning ? "Solving…" : "Solve with Ration"}
              </button>
              <button
                className={cx(nt.button, nt.buttonSecondary)}
                onClick={() => void demoAttest()}
                disabled={isRunning || demoBusy || !client}
                type="button"
                title="Attest a canned perfect answer instantly — no GPU wait"
              >
                {demoBusy ? "Signing demo…" : "Try instant demo (no GPU)"}
              </button>
            </div>
            {/* Demo/attest errors must surface even before any solve runs */}
            {phase === "idle" && attestError && (
              <div className={cx(nt.alert, nt.alertWarning, "ration-attest-err")}>
                {attestError}
              </div>
            )}
          </section>

          {/* Deduction Theatre */}
          {phase !== "idle" && (
            <section className={cx(nt.panel, "ration-theatre")}>
              <div className="ration-theatre-header">
                <h2 className={nt.subtitle}>Deduction Theatre</h2>
                <span className={cx(nt.meta, "ration-elapsed")}>
                  {elapsed}s elapsed
                </span>
              </div>

              {/* Phase timeline */}
              <ol className="ration-timeline">
                {PHASE_STEPS.map((step, i) => {
                  const state =
                    i < activeIdx || phase === "done"
                      ? "done"
                      : i === activeIdx && phase !== "error"
                        ? "active"
                        : phase === "error" && i === activeIdx
                          ? "error"
                          : "pending";
                  return (
                    <li
                      key={step.key}
                      className={cx("ration-timeline-step", `ration-timeline-step--${state}`)}
                    >
                      <span className="ration-timeline-icon">{step.icon}</span>
                      <span className="ration-timeline-label">{step.label}</span>
                    </li>
                  );
                })}
              </ol>

              {/* Detail / status line */}
              {detail && phase !== "done" && phase !== "error" && (
                <p className={cx(nt.text, nt.muted, "ration-detail")}>{detail}</p>
              )}

              {/* Insight card (shown while running) */}
              {isRunning && (
                <div className="ration-insight" key={insightIdx}>
                  <p className="ration-insight-title">{INSIGHTS[insightIdx].title}</p>
                  <p className="ration-insight-body">{INSIGHTS[insightIdx].body}</p>
                </div>
              )}

              {/* Error */}
              {phase === "error" && (
                <div className={cx(nt.alert, nt.alertDanger)}>
                  <strong>Error:</strong> {error}
                </div>
              )}

              {/* Result */}
              {phase === "done" && result && (
                <div className="ration-result-block">
                  <h3 className={nt.sectionTitle}>Answer</h3>
                  <div className="ration-pred-list">
                    {result.pred.map((p: string, i: number) => (
                      <div key={i} className="ration-pred-item">
                        <span className="ration-pred-index">{i + 1}.</span>
                        <span className="ration-pred-text">{p}</span>
                      </div>
                    ))}
                  </div>
                  {result.explanation && (
                    <details className="ration-explanation">
                      <summary>Reasoning</summary>
                      <pre className={cx(nt.pre, nt.preWrap)}>{result.explanation}</pre>
                    </details>
                  )}
                  <div className={cx(nt.meta, "ration-result-meta")}>
                    Model: {result.model} · {result.elapsed_s}s
                  </div>

                  {handoff && (
                    <section className="ration-comparison" aria-label="Human and AI comparison">
                      <h3 className="ration-receipt-event-title">Same-case comparison</h3>
                      <p className={cx(nt.text, nt.muted)}>
                        Browser-declared human outcome versus the AI candidate. The canister signs the submitted evaluation event, not the identity or provenance of either claimant.
                      </p>
                      <ol className="ration-comparison-list">
                        {APURINA_CASE.ground_truth.map((reference, index) => (
                          <li key={reference + index}>
                            <span>#{index + 1}</span>
                            <span>Human: <code>{handoff.answers[index] || "—"}</code></span>
                            <span>AI: <code>{result.pred?.[index] || "—"}</code></span>
                            <span>Reference: <code>{reference}</code></span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {/* Grade + attest button */}
                  <div className="ration-actions">
                    <button
                      className={cx(nt.button, nt.buttonSecondary, forgeMode && "ration-forge-btn")}
                      onClick={attestResult}
                      disabled={attestBusy || !client}
                      type="button"
                    >
                      {attestBusy
                        ? "Signing evaluation…"
                        : forgeMode
                          ? "Sign altered evaluation"
                          : "Grade & sign evaluation"}
                    </button>
                  </div>

                  {attestError && (
                    <div className={cx(nt.alert, nt.alertWarning, "ration-attest-err")}>
                      {attestError}
                    </div>
                  )}

                  {/* Trust Receipt — official certificate card */}
                  {entry && (
                    <div className="ration-receipt">
                      {/* Header */}
                      <div className="ration-receipt-header">
                        <div className="ration-receipt-brand">
                          <span className="ration-receipt-logo">◆</span>
                          <span className="ration-receipt-title">RATION RECEIPT</span>
                        </div>
                        {entry.score !== null ? (
                          <span className="ration-receipt-badge ration-badge-certified">
                            SIGNED EVALUATION ✓
                          </span>
                        ) : (
                          <span className="ration-receipt-badge ration-badge-ungraded">
                            SIGNED · UNGRADED
                          </span>
                        )}
                      </div>

                      <div className="ration-receipt-scope">
                        <strong>Scope:</strong> this receipt attests that this canister graded this submitted output against the supplied reference at the recorded time. The submitted model label is not independently provenance-verified.
                      </div>

                      {/* Evaluation event provenance */}
                      <div className="ration-receipt-event">
                        <h3 className="ration-receipt-event-title">Evaluation Event</h3>
                        <div className="ration-receipt-grid">
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Task</span>
                            <span className="ration-receipt-value">{entry.problem_id}</span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Model</span>
                            <span className="ration-receipt-value">{entry.model || "N/A"}</span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Input</span>
                            <span className="ration-receipt-value ration-hash">
                              {entry.context_hash.slice(0, 40)}…
                            </span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Output</span>
                            <span className="ration-receipt-value ration-hash">
                              {entry.pred?.length ? entry.pred[0].slice(0, 40) + "…" : "N/A"}
                            </span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Evaluation</span>
                            <span className="ration-receipt-value">
                              {entry.em !== null ? (
                                <>
                                  EM{" "}
                                  <span className={entry.em === 0 ? "ration-fail-text" : "ration-pass-text"}>
                                    {(entry.em as number).toFixed(2)}
                                  </span>
                                  {entry.chrf !== null ? (
                                    <>
                                      {" · "}chrF{" "}
                                      <span className="ration-pass-text">
                                        {(entry.chrf as number).toFixed(2)}
                                      </span>
                                    </>
                                  ) : ""}
                                </>
                              ) : (
                                "Ungraded"
                              )}
                            </span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Evaluator</span>
                            <span className="ration-receipt-value">Ration / Neutron canister</span>
                          </div>
                        </div>
                      </div>

                      {/* Cryptographic proof */}
                      <div className="ration-receipt-crypto">
                        <h3 className="ration-receipt-event-title">Cryptographic Proof</h3>
                        <div className="ration-receipt-grid">
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Signature</span>
                            <span className="ration-receipt-value">
                              {sigBytes(entry.signature)} bytes · chain-key ecdsa_secp256k1
                            </span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Assertion hash</span>
                            <span className="ration-receipt-value ration-hash">
                              {entry.assertion_hash.slice(0, 40)}…
                            </span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Timestamp</span>
                            <span className="ration-receipt-value">
                              {new Date(entry.ts * 1000).toLocaleString()}
                            </span>
                          </div>
                          <div className="ration-receipt-field">
                            <span className="ration-receipt-label">Ledger</span>
                            <span className="ration-receipt-value">#{entry.seq}</span>
                          </div>
                        </div>
                      </div>

                      {/* Verify link — use canister certified route (item #8) */}
                      <div className="ration-receipt-verify">
                        <a
                          href={`${window.location.origin}/app/ratiocine/_route/protocol/v1/ledger/report/${entry.assertion_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ration-receipt-verify-link"
                        >
                          Verify this receipt independently →
                        </a>
                        <span className="ration-receipt-verify-hint">
                          Open in a new tab — served as a certified asset from this canister.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Certified ledger */}
          <section className={nt.panel}>
            <div className="ration-row">
              <div>
                <h2 className={nt.subtitle}>Certified ledger</h2>
                <p className={cx(nt.text, nt.muted)}>
                  Every attested solve, in order. Each entry is chain-key signed
                  and survives upgrades (stable memory).
                </p>
              </div>
              <button
                className={cx(nt.button, nt.buttonGhost, "nt-button--sm")}
                onClick={() => void loadLedger()}
                type="button"
              >
                Refresh
              </button>
              <button
                className={cx(nt.button, nt.buttonSecondary, "nt-button--sm")}
                onClick={() => void publishReport()}
                disabled={reportBusy || !client || ledger.length === 0 || ledger.length <= lastReportSeq}
                type="button"
              >
                {reportBusy
                  ? "Publishing…"
                  : ledger.length > lastReportSeq
                    ? `Publish certified report (+${ledger.length - lastReportSeq} new)`
                    : "Publish certified report"}
              </button>
            </div>
            {reportErr && (
              <div className={cx(nt.alert, nt.alertWarning)}>{reportErr}</div>
            )}
            {reportUrl && (
              <div className="ration-report-link">
                <span className={cx(nt.badge, nt.badgeSuccess)}>certified</span>
                <a href={reportUrl} target="_blank" rel="noreferrer">
                  {reportUrl}
                </a>
              </div>
            )}
            {ledgerErr ? (
              <div className={cx(nt.alert, nt.alertWarning)}>{ledgerErr}</div>
            ) : ledger.length === 0 ? (
              <p className={cx(nt.text, nt.muted, "ration-ledger-empty")}>
                No receipts yet. Solve a problem and grade &amp; sign it — or
                run the{" "}
                <button
                  type="button"
                  className="ration-link-button"
                  onClick={() => void demoAttest()}
                  disabled={demoBusy || !client}
                >
                  instant demo
                </button>{" "}
                to see a signed receipt in seconds.
              </p>
            ) : (
              <ul className="ration-ledger">
                {[...ledger].reverse().map((e) => (
                  <li key={e.seq} className="ration-ledger-item">
                    <span className="ration-ledger-seq">#{e.seq}</span>
                    <span className="ration-ledger-problem">{e.problem_id}</span>
                    <span className="ration-ledger-pred">
                      {e.pred.join(" · ")}
                    </span>
                    <span className="ration-ledger-score">
                      {e.score !== null ? e.score.toFixed(4) : "—"}
                    </span>
                    <span className="ration-ledger-ts">
                      {new Date(e.ts * 1000).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </main>
  );
};

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");
createRoot(container).render(<App />);
