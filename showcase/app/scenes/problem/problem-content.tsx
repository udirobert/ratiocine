// Real IOL-style problem: Apurinã verb morphology (sourced from Linguini training data)
// The model had to infer agreement prefixes from 10 paired examples.

export const ProblemContent = () => (
  <div className="relative flex h-svh w-full flex-col overflow-hidden bg-[#0a0f2e] text-white selection:bg-white/20">
    {/* top strip */}
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8 pb-4 border-b border-white/10">
      <div>
        <p className="font-mono text-xs text-white/55 tracking-widest uppercase">
          IOL-AI 2026 · task_type: translation
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          Apurinã — Verb Agreement
        </h1>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs text-white/55">task_lang</p>
        <p className="font-mono text-sm text-white/85">apu (Apurinã)</p>
      </div>
    </div>

    {/* context block — centered reading column */}
    <div className="mx-auto w-full max-w-3xl flex-1 overflow-auto px-6 py-6 space-y-6">
      <section>
        <p className="font-mono text-xs text-white/55 uppercase tracking-widest mb-3">
          Context — study these pairs
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-6 font-mono text-white/55 font-normal text-xs">
                  #
                </th>
                <th className="text-left py-2 pr-10 font-semibold text-white/80">
                  Apurinã
                </th>
                <th className="text-left py-2 font-semibold text-white/80">
                  English
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
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
              ].map(([n, apu, eng]) => (
                <tr key={n} className="group">
                  <td className="py-2 pr-6 font-mono text-xs text-white/50">
                    {n}
                  </td>
                  <td className="py-2 pr-10 font-mono text-[#7dd3fc]">{apu}</td>
                  <td className="py-2 text-white/85">{eng}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* query */}
      <section>
        <p className="font-mono text-xs text-white/55 uppercase tracking-widest mb-3">
          Query — translate into Apurinã
        </p>
        <ol className="space-y-3">
          {[
            "we (incl.) are eating",
            "you (sg.) are speaking",
            "we (incl.) are speaking",
          ].map((q, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="font-mono text-xs text-white/50 mt-0.5 w-5 shrink-0">
                {i + 1}.
              </span>
              <span className="text-white/90">{q}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* score info */}
      <section className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <p className="font-mono text-xs text-white/55 uppercase tracking-widest mb-2">
          Scoring
        </p>
        <p className="text-sm text-white/70 leading-relaxed">
          score = √(exact_match × chrF) · Geometric mean of precision and
          character n-gram overlap. A blank answer scores 0 — always emit your
          best guess.
        </p>
      </section>

      {/* the hook — centered */}
      <div className="flex flex-col items-center pt-4 pb-8 text-center">
        <p className="text-2xl font-bold text-white/90 leading-snug">
          Can your AI solve this?
        </p>
        <p className="mt-2 text-sm text-white/55">
          160 problems. 15 endangered languages. 30 minutes. One T4 GPU.
        </p>
      </div>
    </div>
  </div>
);
