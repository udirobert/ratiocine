import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { cx, nt } from "neutron-design-system";
import {
  createCanisterClient,
  loadNeutronCanisterId,
  loadTileContext,
  type NeutronCanisterClient,
} from "neutron-tools/app";
import "./style.scss";

// ---------------------------------------------------------------------------
// Config — swap BRANDED_BASE once ratiocine.trustfall.xyz DNS is live.
// DIRECT_BASE is the fallback that always works today.
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
    const r = await fetch(`${BRANDED_BASE}/status?id=healthcheck`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    // If we get any response (even 400), the branded URL is reachable.
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
// Sample problem bank
// ---------------------------------------------------------------------------
const PROBLEMS = [
  {
    id: "xinka-fill",
    label: "Guazacapán Xinka · Fill the blanks",
    task_type: "fill_blanks",
    context:
      "Here are two different forms of some verbs in Guazacapán Xinka and their English translations:\n\npiriyʼ | ɨmbirʼi | see\nimʼay | ɨnimʼa | say, tell\naplayʼ | ɨnapalʼa | open (it)\nkʼaniyʼ | ɨŋkʼanʼi | trap\nɬɨknɨyʼ | ɨnɬɨkɨnʼɨ | obey, believe\ntundiyʼ | ɨndunatʼi | play (an instrument)\nʂakʂayʼ | ɨnʂakaʦʼa | steal\nkiʂiyʼ | ɨŋɡiʦʼi | roast\nhɨkʼay | ɨnhɨkʼa | sew, weave\nhɨnɨyʼ | ɨnhɨnɨ | learn, know\nyuɬmuyʼ | ɨnyuɬumʼu | suck candy\niplayʼ | ɨnipalʼa | bathe (it)\npɬahniyʼ | ɨmpɬahanʼi | dig\nterʼoy | ɨnderʼo | kill",
    query:
      "Fill the blanks (1-4):\n\nnetkayʼ | (1) | push\nkɨrɨyʼ | (2) | pull\npɬuhruyʼ | (3) | make holes\nherʼoy | (4) | smooth out",
  },
  {
    id: "ubykh-translate",
    label: "Ubykh · Translate to English",
    task_type: "translation",
    context:
      "Here are some forms of the Ubykh verb to give and their English translations:\n\n1. wəšʼtʷən — we give you_{sg} to him\n2. sawtʷən — you_{sg} give me to them\n3. awəstʷan — I give them to you_{sg}\n4. wəsənatʷən — they give you_{sg} to me\n5. śʷəstʷan — I give you_{pl} to him\n6. šʼantʷan — he gives us to them\n7. awəšʼtʷən — we give him to you_{sg}\n8. səśʷəntʷan — he gives me to you_{pl}\n9. aśʷəstʷan — I give him to you_{pl}",
    query:
      "Translate into English:\n\n10. ašʼəntʷən\n11. səśʷtʷan\n12. šʼəwənatʷan",
  },
  {
    id: "suna-translate",
    label: "Mini-language · Translate",
    task_type: "translation",
    context:
      "suna: sun; bade: big; suna bade: big sun; me: my; me suna: my sun",
    query: "Translate into the unfamiliar language: 1. the big sun",
  },
];

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
// App
// ---------------------------------------------------------------------------
export const App = () => {
  const [client, setClient] = useState<NeutronCanisterClient | null>(null);
  const [tileContext] = useState(() => loadTileContext());

  const [selected, setSelected] = useState(PROBLEMS[0].id);
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState("");
  const [result, setResult] = useState<any>(null);
  const [attest, setAttest] = useState<string | null>(null);
  const [attestBusy, setAttestBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [insightIdx, setInsightIdx] = useState(0);
  const [error, setError] = useState("");

  const jobIdRef = useRef<string | null>(null);
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

  // Rotate insights while solving
  useEffect(() => {
    if (phase === "queued" || phase === "waking" || phase === "loading" || phase === "deducing") {
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
    const problem = PROBLEMS.find((p) => p.id === selected)!;
    setError("");
    setResult(null);
    setAttest(null);
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

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);

      // Start polling
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
  }, [selected, stopPolling]);

  const attestResult = useCallback(async () => {
    if (!client || !result) return;
    setAttestBusy(true);
    setAttest(null);
    try {
      const msg = JSON.stringify({
        job_id: jobIdRef.current,
        problem: selected,
        pred: result.pred,
        model: result.model,
        elapsed_s: result.elapsed_s,
        ts: new Date().toISOString(),
      });
      const value = await client.callDialog("sign_probe", [msg]);
      setAttest(String(value));
    } catch (e: any) {
      setAttest("Attest error: " + e.message);
    } finally {
      setAttestBusy(false);
    }
  }, [client, result, selected]);

  const activeIdx = phaseIndex(phase);
  const isRunning = ["queued", "waking", "loading", "deducing"].includes(phase);

  return (
    <main className={cx(nt.appFill, "ration-app")}>
      <div className="nt-page ration-shell">
        {/* Header */}
        <header className={nt.pageHeader}>
          <div>
            <p className={nt.eyebrow}>Certified reasoning logbook</p>
            <h1 className={nt.title}>Ration</h1>
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
                  Pick a linguistics puzzle for the engine to solve.
                </p>
              </div>
            </div>
            <div className="ration-problem-list">
              {PROBLEMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cx("ration-problem-card", {
                    "ration-problem-card--active": selected === p.id,
                  })}
                  onClick={() => setSelected(p.id)}
                  disabled={isRunning}
                >
                  <span className="ration-problem-label">{p.label}</span>
                  <span className={cx(nt.tag, "ration-problem-type")}>
                    {p.task_type}
                  </span>
                </button>
              ))}
            </div>
            <div className="ration-actions">
              <button
                className={cx(nt.button, "ration-solve-btn")}
                onClick={startSolve}
                disabled={isRunning}
                type="button"
              >
                {isRunning ? "Solving…" : "Solve with Ration"}
              </button>
            </div>
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

                  {/* Attest button */}
                  <div className="ration-actions">
                    <button
                      className={cx(nt.button, nt.buttonSecondary)}
                      onClick={attestResult}
                      disabled={attestBusy || !client}
                      type="button"
                    >
                      {attestBusy ? "Signing…" : "Sign receipt on-chain"}
                    </button>
                  </div>
                  {attest && (
                    <output className={cx(nt.result, "ration-attest")}>
                      <code>{attest}</code>
                    </output>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </main>
  );
};

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");
createRoot(container).render(<App />);
