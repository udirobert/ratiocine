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
  <div className="relative flex h-svh w-full flex-col overflow-hidden bg-[#0a0f2e] text-white selection:bg-white/20">
    {/* top strip */}
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-6 pb-3 border-b border-white/10">
      <div>
        <p className="font-mono text-[10px] text-white/55 tracking-widest uppercase">
          IOL-AI 2026 · task_type: translation
        </p>
        <h1 className="mt-0.5 text-lg font-bold tracking-tight">
          Apurinã — Verb Agreement
        </h1>
      </div>
      <div className="text-right">
        <p className="font-mono text-[10px] text-white/55">task_lang</p>
        <p className="font-mono text-xs text-white/85">apu (Apurinã)</p>
      </div>
    </div>

    {/* context block — centered reading column */}
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-auto px-6 py-5 gap-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] text-white/55 uppercase tracking-widest">
            Context — study these pairs
          </p>
          <button
            onClick={() => setShowAll((s) => !s)}
            className="font-mono text-[11px] text-[#7dd3fc] hover:underline"
          >
            {showAll ? "show fewer" : `show all ${PAIRS.length}`}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-1.5 pr-6 font-mono text-white/55 font-normal text-[10px]">
                  #
                </th>
                <th className="text-left py-1.5 pr-10 font-semibold text-white/80">
                  Apurinã
                </th>
                <th className="text-left py-1.5 font-semibold text-white/80">
                  English
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map(([n, apu, eng]) => (
                <tr key={n} className="group">
                  <td className="py-1.5 pr-6 font-mono text-xs text-white/50">
                    {n}
                  </td>
                  <td className="py-1.5 pr-10 font-mono text-[#7dd3fc]">{apu}</td>
                  <td className="py-1.5 text-white/85">{eng}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* query */}
      <section>
        <p className="font-mono text-[10px] text-white/55 uppercase tracking-widest mb-2">
          Query — translate into Apurinã
        </p>
        <ol className="space-y-2">
          {QUERIES.map((q, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="font-mono text-xs text-white/50 mt-0.5 w-5 shrink-0">
                {i + 1}.
              </span>
              <span className="text-white/90">{q}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* score info — collapsible */}
      <details className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
        <summary className="cursor-pointer text-sm font-medium text-white/80">
          Scoring
        </summary>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          score = √(exact_match × chrF) · Geometric mean of precision and
          character n-gram overlap. A blank answer scores 0 — always emit your
          best guess.
        </p>
      </details>

      {/* the hook — centered */}
      <div className="flex flex-col items-center pt-2 pb-6 text-center">
        <p className="text-xl font-bold text-white/90 leading-snug">
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
