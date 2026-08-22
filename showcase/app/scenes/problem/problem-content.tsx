// Real IOL-style problem: Apurinã verb morphology (sourced from Linguini training data)
// The model had to infer agreement prefixes from 10 paired examples.

import { useState } from "react";

const PAIRS = [
  ["1", "nhaapitaka", "I am going"],
  ["2", "ãpitaka", "you (sg.) are going"],
  ["3", "apitaka", "he/she is going"],
  ["4", "nhaakutaka", "I am eating"],
  ["5", "ãkutaka", "you (sg.) are eating"],
  ["6", "akutaka", "he/she is eating"],
  ["7", "nhaanykataka", "I am speaking"],
  ["8", "ãnykataka", "you (sg.) are speaking"],
  ["9", "anykataka", "he/she is speaking"],
  ["10", "kaapitaka", "we (incl.) are going"],
];

const QUERIES = [
  "we (incl.) are eating",
  "you (sg.) are speaking",
  "we (incl.) are speaking",
];

const PREVIEW_COUNT = 3;

export const ProblemContent = () => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? PAIRS : PAIRS.slice(0, PREVIEW_COUNT);

  return (
    <div className="relative flex h-svh w-full flex-col items-center overflow-hidden bg-[#0a0f2e] text-white selection:bg-white/20">
      {/* centred header */}
      <div className="w-full max-w-2xl px-6 pt-8 pb-5 text-center border-b border-white/10">
        <p className="font-mono text-[10px] text-white/55 tracking-widest uppercase">
          IOL-AI 2026 · task_type: translation
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Apurinã — Verb Agreement
        </h1>
        <p className="mt-1 font-mono text-xs text-white/50">apu (Apurinã)</p>
      </div>

      {/* staged body — centred column with numbered steps */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 overflow-auto px-6 py-6">
        {/* Step 1 — Context */}
        <section className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <div className="flex items-center justify-between pe-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-white/70">
                1
              </span>
              <div className="text-left">
                <p className="font-mono text-[10px] text-white/55 uppercase tracking-widest">
                  Context
                </p>
                <p className="text-sm font-semibold text-white/90">
                  Study the pattern
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAll((s) => !s)}
              className="font-mono text-[11px] text-[#7dd3fc] hover:underline"
            >
              {showAll ? "show fewer" : `show all ${PAIRS.length}`}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <tbody className="divide-y divide-white/5">
                  {visible.map(([n, apu, eng]) => (
                    <tr
                      key={n}
                      className={n === "10" ? "bg-[#7dd3fc]/5" : "group"}
                    >
                      <td className="w-8 py-1.5 pr-4 font-mono text-xs text-white/40">
                        {n}
                      </td>
                      <td className="w-1/3 py-1.5 pr-6 font-mono text-[#7dd3fc]">
                        {apu}
                      </td>
                      <td className="py-1.5 text-white/85">{eng}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-white/45">
              Row <span className="font-mono text-[#7dd3fc]">10</span> is the
              key: <span className="font-mono">kaapitaka</span> = "we (incl.) are
              going". Compare its <span className="font-mono">kaa-</span> prefix
              with the person markers in rows{" "}
              <span className="font-mono">1–3</span> — that prefix marks{" "}
              <span className="font-mono">we (incl.)</span>.
            </p>
          </div>
        </section>

        {/* Step 2 — Query */}
        <section className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <div className="flex items-center gap-2.5 pe-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-white/70">
              2
            </span>
            <div className="text-left">
              <p className="font-mono text-[10px] text-white/55 uppercase tracking-widest">
                Query
              </p>
              <p className="text-sm font-semibold text-white/90">
                Translate into Apurinã
              </p>
            </div>
          </div>
          <ol className="mt-3 space-y-2">
            {QUERIES.map((q, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-mono text-xs text-white/40 mt-0.5 w-5 shrink-0">
                  {i + 1}.
                </span>
                <span className="text-white/90">{q}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Step 3 — Scoring (collapsible, framed) */}
        <details className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <summary className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-white/85">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-bold text-white/70">
              3
            </span>
            Scoring
          </summary>
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            score = √(exact_match × chrF) · Geometric mean of precision and
            character n-gram overlap. A blank answer scores 0 — always emit your
            best guess.
          </p>
        </details>

        {/* the hook — centred */}
        <div className="flex flex-col items-center pb-2 text-center">
          <p className="text-lg font-bold text-white/90 leading-snug">
            Can your AI solve this?
          </p>
          <p className="mt-1 text-xs text-white/55">
            160 problems. 15 endangered languages. 30 minutes. One T4 GPU.
          </p>
        </div>
      </div>
    </div>
  );
};
