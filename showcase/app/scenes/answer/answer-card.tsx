export const AnswerCard = () => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-[#0a0f2e]">
    <div className="max-w-lg px-8 text-center">
      <p className="font-mono text-xs text-white/40 uppercase tracking-widest mb-4">
        Apurinã translation · Query #1
      </p>
      <div className="rounded-xl border border-white/20 bg-white/5 px-6 py-5 backdrop-blur mb-6">
        <p className="text-sm text-white/60 mb-3">we (incl.) are eating</p>
        <p className="text-2xl font-bold text-[#7dd3fc] font-mono tracking-tight">
          kaakutaka
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left">
        <p className="font-mono text-xs text-white/40 uppercase tracking-widest mb-2">
          Model reasoning (CoT)
        </p>
        <p className="text-xs text-white/60 leading-relaxed">
          The prefix <span className="text-[#a78bfa] font-mono">kaa-</span> marks inclusive 'we'
          (example 10: <span className="font-mono text-white/80">kaapitaka</span> = 'we incl. are going').
          The root <span className="text-[#fbbf24] font-mono">-kuta-</span> = 'eat' (examples 4–6).
          The suffix <span className="text-[#34d399] font-mono">-ka</span> marks present progressive.
          Combine: <span className="font-mono text-[#7dd3fc] font-bold">kaa·kuta·ka</span>.
        </p>
      </div>

      <p className="mt-6 text-xs text-white/30">Click anywhere to trigger explosion</p>
    </div>
  </div>
);
