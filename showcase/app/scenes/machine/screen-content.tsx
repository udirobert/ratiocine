"use client";

import { useEffect, useState } from "react";

// Lines of script.py shown as a typewriter feed
const CODE_LINES = [
  'model = AutoModelForCausalLM.from_pretrained(',
  '    "udirobert/qwen25-14b-iol",',
  '    torch_dtype=torch.float16,  # T4 = Turing, no bf16',
  '    device_map="auto",',
  ')',
  "",
  "def solve(row: pd.Series) -> list[str]:",
  '    task = row["task_type"]',
  "    prompt = build_prompt(task, row)",
  "    # hybrid CoT: 512 tokens for hard tasks",
  '    max_tok = 512 if task in COT_TASKS else 128',
  "    ids = tokenizer(prompt, return_tensors='pt')",
  "    out = model.generate(**ids,",
  "        max_new_tokens=max_tok,",
  "        do_sample=False,      # greedy → reproducible",
  "    )",
  "    return parse_answers(out)",
  "",
  "# time guard: 3-tier adaptive budget",
  "for i, row in df.iterrows():",
  "    elapsed = time.time() - t0",
  "    remaining = TIME_LIMIT - elapsed",
  "    if remaining < problems_left * 8:",
  "        max_tok = 96  # FAST MODE",
  "    answers = solve(row)",
  "",
];

const SCORES = [
  { label: "initial", value: 0.0755, color: "#94a3b8" },
  { label: "fine-tuned 7B", value: 0.075, color: "#f87171" },
  { label: "task prompts", value: 0.0847, color: "#fbbf24" },
  { label: "parser fix", value: 0.1012, color: "#a78bfa" },
  { label: "verbose CoT", value: 0.1141, color: "#34d399" },
  { label: "hybrid CoT ✦", value: 0.1255, color: "#38bdf8" },
];

export const ScreenContent = () => {
  const [lineIndex, setLineIndex] = useState(0);
  const [scoreIndex, setScoreIndex] = useState(0);

  // Typewriter effect
  useEffect(() => {
    if (lineIndex >= CODE_LINES.length) return;
    const t = setTimeout(
      () => setLineIndex((i) => i + 1),
      lineIndex === 0 ? 600 : 80 + Math.random() * 60,
    );
    return () => clearTimeout(t);
  }, [lineIndex]);

  // Score arc animation
  useEffect(() => {
    if (scoreIndex >= SCORES.length) return;
    const t = setTimeout(
      () => setScoreIndex((i) => i + 1),
      scoreIndex === 0 ? 1200 : 700,
    );
    return () => clearTimeout(t);
  }, [scoreIndex]);

  return (
    <div
      className="h-full w-full overflow-hidden flex flex-col"
      style={{
        background: "#0d0d1a",
        fontFamily: "'GeistMono', 'Courier New', monospace",
      }}
    >
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a2e] border-b border-white/10 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[9px] text-white/30">script.py — IOL-AI 2026</span>
      </div>

      {/* code */}
      <div className="flex-1 overflow-hidden px-3 pt-2 pb-1 text-[8px] leading-relaxed">
        {CODE_LINES.slice(0, lineIndex).map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-white/20 w-4 shrink-0 text-right select-none">
              {i + 1}
            </span>
            <span
              className="text-[#7dd3fc] whitespace-pre"
              style={{ color: line.startsWith("#") ? "#6b7280" : line.startsWith("    ") ? "#c4b5fd" : "#e2e8f0" }}
            >
              {line || " "}
            </span>
          </div>
        ))}
        {lineIndex < CODE_LINES.length && (
          <div className="flex gap-2">
            <span className="text-white/20 w-4 shrink-0 text-right">{lineIndex + 1}</span>
            <span className="inline-block w-1.5 h-3 bg-white/70 animate-pulse" />
          </div>
        )}
      </div>

      {/* score arc */}
      <div className="shrink-0 border-t border-white/10 px-3 py-2">
        <p className="text-[7px] text-white/30 uppercase tracking-widest mb-1.5">
          Score arc
        </p>
        <div className="flex items-end gap-1.5 h-12">
          {SCORES.slice(0, scoreIndex).map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span className="text-[6px] text-white/50 font-mono">
                {s.value.toFixed(4)}
              </span>
              <div
                className="w-5 rounded-sm transition-all duration-500"
                style={{
                  height: `${(s.value / 0.14) * 36}px`,
                  background: s.color,
                  opacity: 0.85,
                }}
              />
              <span
                className="text-[5px] text-center leading-tight"
                style={{ color: s.color, maxWidth: "28px" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
