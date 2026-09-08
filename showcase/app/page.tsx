"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { GridBackground } from "@/components/ui/grid-background";
import { track } from "@/lib/analytics";

import { Problem } from "./scenes/problem/index";
import { Answer } from "./scenes/answer/index";
import { PartnerLogos } from "./scenes/machine/partner-logos";

const Machine = dynamic(
  () => import("./scenes/machine/index").then((m) => m.Machine),
  { ssr: false },
);
const PuzzleView = dynamic(
  () => import("./play/puzzle-view").then((m) => m.PuzzleView),
  { ssr: false },
);

type Phase = "landing" | "pre-flash" | "expanding" | "game";

interface SolvedResult {
  language: string;
  score: number;
  total: number;
  verdict: string;
  accentColor: string;
  timeStr: string;
}

// The home is a vertical scroll-snap journey through the whole project: the
// daily game (the gravity of the site) lives inside a wider narrative — the
// real IOL problem, the machine that tried it, the answer, and the signed
// ledger that proves the verdict. The CRT-flash "Play" transition still fires
// the moment someone commits to the puzzle; the journey frames it.

const BEATS = [
  { label: "The Machine", short: "Machine" },
  { label: "The Problem", short: "Problem" },
  { label: "The Competition", short: "Build" },
  { label: "The Answer", short: "Answer" },
  { label: "Verified", short: "Signed" },
  { label: "Play", short: "Play" },
] as const;

const STATS = [
  { value: "160", label: "problems" },
  { value: "15", label: "languages" },
  { value: "30 min", label: "time limit" },
  { value: "\u221AEM\u00B7chrF", label: "single score" },
];

const LESSONS = [
  "Bigger base beat fine-tuned smaller \u2014 stock Qwen2.5-14B out-scored our fine-tuned 7B (0.1141 vs 0.075).",
  "Fix the parser before fine-tuning \u2014 a heuristic that dropped answers starting with \u201CThe\u201D silently killed ~5% of correct translations.",
  "Hybrid chain-of-thought is the sweet spot \u2014 CoT for translation & fill-blanks, direct for the rest, tiered token budgets to fit the 30-minute wall.",
];

const FLOW = [
  { step: "Solve", detail: "14B model on a Modal GPU" },
  { step: "Grade", detail: "EM + chrF, in-canister" },
  { step: "Hash", detail: "SHA-256" },
  { step: "Sign", detail: "ECDSA secp256k1" },
  { step: "Ledger", detail: "immutable append-only" },
];

const PUZZLES: { id: string; language: string }[] = [
  { id: "apurina-verb-agreement", language: "Apurin\u00E3" },
  { id: "swahili-person-tense", language: "Swahili" },
  { id: "turkish-vowel-harmony", language: "Turkish" },
  { id: "quechua-person-endings", language: "Quechua" },
  { id: "nahuatl-both-ends", language: "Nahuatl" },
  { id: "esperanto-tense", language: "Esperanto" },
  { id: "indonesian-plurals", language: "Indonesian" },
  { id: "finnish-harmony", language: "Finnish" },
  { id: "maori-pronouns", language: "M\u0101ori" },
  { id: "zulu-noun-class", language: "Zulu" },
];

const PARTNERS = [
  { name: "Arkor", url: "https://arkor.ai" },
  { name: "Modal", url: "https://modal.com" },
  { name: "Vultr", url: "https://vultr.com" },
  { name: "Cohere Labs", url: "https://cohere.com/research" },
  { name: "Hugging Face", url: "https://huggingface.co" },
];

const LEDGER_URL = "https://cvrwv-mqaaa-aaaai-ax4pa-cai.icp0.io/";
const REPO_URL = "https://github.com/udirobert/ratiocine";

const Home = () => {
  const [phase, setPhase] = useState<Phase>("landing");
  const [clipInset, setClipInset] = useState("50% 50% 50% 50%");
  const [solvedResult, setSolvedResult] = useState<SolvedResult | null>(null);
  const [active, setActive] = useState(0);

  const scrollRef = useRef<HTMLElement | null>(null);
  const beatRefs = useRef<(HTMLElement | null)[]>([]);
  const savedScroll = useRef<number | null>(null);

  // CRT-flash transition into the daily game (mechanic unchanged).
  const handlePlay = useCallback(() => {
    if (phase !== "landing") return;
    track("play_start");
    savedScroll.current = scrollRef.current?.scrollTop ?? 0;
    setPhase("pre-flash");
    setTimeout(() => {
      setClipInset("35% 32% 35% 32%");
      requestAnimationFrame(() => {
        setPhase("expanding");
        setClipInset("0% 0% 0% 0%");
      });
      setTimeout(() => {
        setPhase("game");
        window.history.replaceState(null, "", "/play");
      }, 900);
    }, 200);
  }, [phase]);

  const handleBack = useCallback(() => {
    setClipInset("50% 50% 50% 50%");
    setPhase("landing");
    window.history.replaceState(null, "", "/");
  }, []);

  // Restore scroll on return so the journey resumes where it was left.
  useEffect(() => {
    if (phase === "landing" && savedScroll.current != null && scrollRef.current) {
      const top = savedScroll.current;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top }));
    }
  }, [phase]);

  // Track the most-visible beat for the progress label + dot nav.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best = -1;
        let bestRatio = 0;
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = idx;
          }
        }
        if (best >= 0) setActive(best);
      },
      { root, threshold: [0.5, 0.75, 1] },
    );
    beatRefs.current.forEach((el) => {
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [phase]);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const goTo = (i: number) => {
    beatRefs.current[i]?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  };

  const beatsMounted = phase !== "game";
  const setBeatRef = (i: number) => (el: HTMLElement | null) => {
    beatRefs.current[i] = el;
  };

  return (
    <main className="relative h-svh w-screen overflow-y-auto snap-y snap-mandatory bg-[#0a0c10]">
      <h1 className="sr-only">
        ratiocine — crack the pattern, then watch the machine try
      </h1>

      {/* Game content \u2014 fixed overlay, clip-revealed on Play. Hidden as a
          zero-size dot while the journey scrolls; expanding to full is the
          CRT-flash enter-the-game moment. */}
      <div
        aria-hidden={phase !== "game"}
        className="fixed inset-0 z-30"
        style={{
          clipPath: phase === "game" ? "none" : `inset(${clipInset} round 8px)`,
          transition:
            phase === "expanding"
              ? "clip-path 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : phase === "landing"
                ? "clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                : "none",
          pointerEvents: phase === "game" || phase === "expanding" ? "auto" : "none",
        }}
      >
        <PuzzleView onBack={handleBack} onSolved={setSolvedResult} />
      </div>

      {/* Grain edge overlay during CRT expansion */}
      {phase === "expanding" && (
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          style={{
            clipPath: `inset(${clipInset} round 8px)`,
            transition: "clip-path 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div className="absolute inset-0 mix-blend-overlay opacity-30 grain-noise" />
        </div>
      )}

      {/* CRT pre-flash */}
      {phase === "pre-flash" && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.2, 0.7, 0] }}
          transition={{ duration: 0.2, times: [0, 0.2, 0.5, 0.7, 1] }}
        >
          <div className="absolute inset-0 bg-white/5 grain-noise mix-blend-screen" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
            }}
          />
        </motion.div>
      )}

      {/* Journey-only chrome: progress label, top nav, dot nav. */}
      {phase === "landing" && (
        <>
          <div className="fixed top-5 left-5 z-40 flex items-center gap-2">
            <span className="font-mono text-xs text-white/60 tabular-nums">
              {String(active + 1).padStart(2, "0")} / {String(BEATS.length).padStart(2, "0")}
            </span>
            <span className="text-sm font-semibold text-white/85 tracking-wide">
              {BEATS[active].label}
            </span>
          </div>

          <div className="fixed top-5 right-5 z-40 flex items-center gap-3">
            <Link
              href="/explore"
              className="font-mono text-xs text-white/50 hover:text-white/85 transition-colors"
            >
              Explore
            </Link>
            <button
              onClick={handlePlay}
              className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 font-mono text-xs font-medium text-amber-300 backdrop-blur transition-all hover:bg-amber-400/20 hover:border-amber-400/60"
            >
              ▶ Play
            </button>
          </div>

          <nav className="fixed top-5 left-1/2 z-40 flex -translate-x-1/2 items-center justify-center gap-2">
            {BEATS.map((b, i) => (
              <button
                key={b.label}
                onClick={() => goTo(i)}
                aria-label={b.label}
                aria-current={i === active ? "true" : undefined}
                className="group flex min-w-[44px] flex-col items-center gap-1"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    i === active
                      ? "w-6 h-2 bg-white"
                      : "w-2.5 h-2.5 bg-white/40 group-hover:bg-white/70"
                  }`}
                />
                <span
                  className={`font-mono text-[10px] tracking-wide transition-colors ${
                    i === active ? "text-white/80" : "text-white/50"
                  }`}
                >
                  {b.short}
                </span>
              </button>
            ))}
          </nav>
        </>
      )}

      {/* ─── The scroll journey (unmounted during the game) ─────────────── */}
      {beatsMounted && (
        <>
          {/* 01 — The Machine (hero) */}
          <section
            ref={setBeatRef(0)}
            data-idx={0}
            className="relative h-svh w-full snap-start overflow-hidden bg-[#0a0f2e]"
          >
            <GridBackground className="bg-[#0a0f2e]" />
            <Machine onPlay={handlePlay} zooming={phase !== "landing"} solvedResult={solvedResult} />
            {/* Industry / stack context, flanking the Mac — restored. */}
            <PartnerLogos />
          </section>

          {/* 02 — The Problem */}
          <section
            ref={setBeatRef(1)}
            data-idx={1}
            className="relative h-svh w-full snap-start overflow-hidden bg-[#0a0f2e]"
          >
            <Problem />
          </section>

          {/* 03 — The Competition */}
          <section
            ref={setBeatRef(2)}
            data-idx={2}
            className="relative h-svh w-full snap-start overflow-y-auto bg-[#0a0c10]"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
              className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center px-6 py-20"
            >
              <p className="font-mono text-[10px] text-white/55 tracking-widest uppercase">
                03 / 06 · IOL-AI 2026
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                The competition
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
                The International Linguistics Olympiad for AI: 160 problems
                across 15 endangered and low-resource languages, 30 minutes, one
                T4 GPU. Translate, infer, fill the blanks — under the same
                √(exact_match × chrF) a human contestant faces, with zero
                internet at evaluation time.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center"
                  >
                    <p className="text-2xl font-bold text-white">{s.value}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-white/45">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-5">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                      Our best submission
                    </p>
                    <p className="mt-1 text-3xl font-bold text-amber-300">0.1141</p>
                  </div>
                  <p className="font-mono text-xs text-white/55">
                    chrF 0.2314 · EM 0.0563
                  </p>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  Qwen2.5-14B, 4-bit AWQ — the stock model with a parser fix and
                  task-specific prompts, hybrid chain-of-thought for translation
                  and fill-blanks. Two of our eight submissions were selected for
                  the private leaderboard — one high exact-match, one high chrF —
                  to hedge the undisclosed split.
                </p>
              </div>

              <details className="group mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-white/85">
                  What we learned
                  <span className="font-mono text-xs text-white/40 transition-transform group-open:rotate-90">
                    ▶
                  </span>
                </summary>
                <ul className="mt-3 space-y-2.5 text-sm text-white/65">
                  {LESSONS.map((l) => (
                    <li key={l} className="flex gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/70" />
                      <span className="leading-relaxed">{l}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </motion.div>
          </section>

          {/* 04 — The Answer */}
          <section
            ref={setBeatRef(3)}
            data-idx={3}
            className="relative h-svh w-full snap-start overflow-hidden bg-[#0a0f2e]"
          >
            <Answer />
          </section>

          {/* 05 — Verified (the Ration attestation / wider-industry beat) */}
          <section
            ref={setBeatRef(4)}
            data-idx={4}
            className="relative h-svh w-full snap-start overflow-y-auto bg-[#0a0c10]"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
              className="relative z-10 mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center px-6 py-20 text-center"
            >
              <p className="font-mono text-[10px] text-white/55 tracking-widest uppercase">
                05 / 06 · Ration — certified reasoning
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Every verdict is signed
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
                A reasoning logbook. Each AI verdict is graded by the same
                √(EM × chrF) algorithm <em>deterministically, in-canister</em>,
                the problem and assertion are SHA-256-hashed and chain-key-signed
                on the Internet Computer, and the receipt is appended to an
                immutable ledger. The model is never in the room when its work is
                graded.
              </p>

              <ol className="mt-8 flex w-full flex-wrap items-stretch justify-center gap-2">
                {FLOW.map((f, i) => (
                  <li key={f.step} className="flex items-center gap-2">
                    <div className="flex w-[112px] flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <span className="text-sm font-semibold text-white">{f.step}</span>
                      <span className="text-center font-mono text-[9px] leading-tight text-white/45">
                        {f.detail}
                      </span>
                    </div>
                    {i < FLOW.length - 1 && (
                      <span className="font-mono text-white/30" aria-hidden>
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>

              <div className="mt-9 flex flex-col items-center gap-3">
                <a
                  href={LEDGER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-6 py-2.5 text-sm font-medium text-emerald-300 backdrop-blur transition-all hover:bg-emerald-400/20 hover:border-emerald-400/60"
                >
                  View the certified ledger →
                </a>
                <p className="font-mono text-[10px] text-white/35">
                  canister cvrwv-mqaaa-aaaai-ax4pa-cai · ratiocine.trustfall.xyz
                </p>
              </div>
            </motion.div>
          </section>

          {/* 06 — Play (the gravity beat) */}
          <section
            ref={setBeatRef(5)}
            data-idx={5}
            className="relative h-svh w-full snap-start overflow-y-auto bg-[#0a0c10]"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
              className="relative z-10 mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center px-6 py-20 text-center"
            >
              <p className="font-mono text-[10px] text-white/55 tracking-widest uppercase">
                06 / 06
              </p>
              <h2 className="mt-1 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Ready to play?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/65">
                Crack today&rsquo;s language. Then watch the machine try the same
                puzzle — same grading. A new puzzle every day.
              </p>

              <div className="mt-8 flex flex-col items-center gap-2">
                <button
                  onClick={handlePlay}
                  className="rounded-full bg-amber-500/90 px-8 py-3.5 text-sm font-bold text-black transition-all hover:bg-amber-400"
                >
                  ▶ Play today's puzzle
                </button>
                <span className="font-mono text-[10px] text-white/30">new puzzle daily</span>
              </div>

              <div className="mt-12">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                  More puzzles
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {PUZZLES.map((p) => (
                    <Link
                      key={p.id}
                      href={`/play?puzzle=${encodeURIComponent(p.id)}`}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-white/75 transition-colors hover:border-white/30 hover:text-white"
                    >
                      {p.language}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-12">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                  Built with
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-white/65">
                  {PARTNERS.map((p, i) => (
                    <span key={p.name} className="inline-flex items-center gap-4">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-white"
                      >
                        {p.name}
                      </a>
                      {i < PARTNERS.length - 1 && (
                        <span className="text-white/20" aria-hidden>
                          ·
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-12 flex flex-col items-center gap-1 border-t border-white/10 pt-6">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-bold tracking-tight text-white/80 transition-colors hover:text-white"
                >
                  ratiocine
                </a>
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">
                  IOL-AI 2026 competitor · score{" "}
                  <span className="text-emerald-400/80">0.1141</span>
                </p>
              </div>
            </motion.div>
          </section>
        </>
      )}
    </main>
  );
};

export default Home;
