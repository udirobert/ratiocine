// Universal canvas-2D renderer for the Machine CRT screen content.
// Draws the typewriter code feed + score arc to a 2D canvas so it can be
// used as a THREE.CanvasTexture without the experimental drawElementImage API.

export const SCREEN_W = 562;
export const SCREEN_H = 408;

const CODE_LINES: string[] = [
  'model = AutoModelForCausalLM.from_pretrained(',
  '    "udirobert/qwen25-14b-iol",',
  '    torch_dtype=torch.float16,  # T4 = Turing, no bf16',
  '    device_map="auto",',
  ')',
  '',
  'def solve(row: pd.Series) -> list[str]:',
  '    task = row["task_type"]',
  '    prompt = build_prompt(task, row)',
  '    # hybrid CoT: 512 tokens for hard tasks',
  '    max_tok = 512 if task in COT_TASKS else 128',
  "    ids = tokenizer(prompt, return_tensors='pt')",
  '    out = model.generate(**ids,',
  '        max_new_tokens=max_tok,',
  '        do_sample=False,      # greedy -> reproducible',
  '    )',
  '    return parse_answers(out)',
  '',
  '# time guard: 3-tier adaptive budget',
  'for i, row in df.iterrows():',
  '    elapsed = time.time() - t0',
  '    remaining = TIME_LIMIT - elapsed',
  '    if remaining < problems_left * 8:',
  '        max_tok = 96  # FAST MODE',
  '    answers = solve(row)',
  '',
];

interface Score {
  label: string;
  value: number;
  color: string;
}

const SCORES: Score[] = [
  { label: 'initial', value: 0.0755, color: '#94a3b8' },
  { label: 'fine-tuned 7B', value: 0.075, color: '#f87171' },
  { label: 'task prompts', value: 0.0847, color: '#fbbf24' },
  { label: 'parser fix', value: 0.1012, color: '#a78bfa' },
  { label: 'verbose CoT', value: 0.1141, color: '#34d399' },
  { label: 'hybrid CoT *', value: 0.1255, color: '#38bdf8' },
];

const lineColor = (line: string): string => {
  if (line.startsWith('#') || line.trim().startsWith('#')) return '#6b7280';
  if (line.startsWith('    ')) return '#c4b5fd';
  return '#e2e8f0';
};

export const drawScreen = (
  ctx: CanvasRenderingContext2D,
  lineIndex: number,
  scoreIndex: number,
): void => {
  // background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // window chrome bar
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, SCREEN_W, 22);
  ctx.fillStyle = '#ffffff0d' as string;
  ctx.fillRect(0, 21, SCREEN_W, 1);

  // traffic lights
  const dotY = 11;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(14 + i * 12, dotY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][i];
    ctx.fill();
  }

  // title
  ctx.fillStyle = '#ffffff4d' as string;
  ctx.font = '9px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('script.py — IOL-AI 2026', 56, dotY);

  // code lines
  ctx.textBaseline = 'top';
  const codeTop = 30;
  const lineH = 12;
  ctx.font = '9px ui-monospace, "SF Mono", Menlo, monospace';

  const visible = CODE_LINES.slice(0, Math.min(lineIndex, CODE_LINES.length));
  const maxVisible = Math.floor((SCREEN_H - codeTop - 70) / lineH);
  const start = Math.max(0, visible.length - maxVisible);

  for (let i = start; i < visible.length; i++) {
    const line = visible[i];
    const y = codeTop + (i - start) * lineH;
    // line number
    ctx.fillStyle = '#ffffff33' as string;
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), 22, y);
    // code
    ctx.textAlign = 'left';
    ctx.fillStyle = lineColor(line);
    ctx.fillText(line || ' ', 30, y);
  }

  // cursor
  if (lineIndex < CODE_LINES.length) {
    const cursorY = codeTop + Math.min(visible.length, maxVisible) * lineH;
    ctx.fillStyle = '#ffffffb3' as string;
    ctx.fillRect(30, cursorY, 7, 10);
  }

  // score arc section
  const arcTop = SCREEN_H - 66;
  ctx.fillStyle = '#ffffff0d' as string;
  ctx.fillRect(0, arcTop, SCREEN_W, 1);

  ctx.fillStyle = '#ffffff4d' as string;
  ctx.font = '7px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE ARC', 12, arcTop + 6);

  const arcBarTop = arcTop + 20;
  const barW = 20;
  const barGap = 8;
  const maxBarH = 36;
  const maxScore = 0.14;

  for (let i = 0; i < Math.min(scoreIndex, SCORES.length); i++) {
    const s = SCORES[i];
    const x = 12 + i * (barW + barGap);
    const h = (s.value / maxScore) * maxBarH;
    // value
    ctx.fillStyle = '#ffffff80' as string;
    ctx.font = '6px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.value.toFixed(4), x + barW / 2, arcBarTop - 8);
    // bar
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, arcBarTop + (maxBarH - h), barW, h);
    ctx.globalAlpha = 1;
    // label
    ctx.fillStyle = s.color;
    ctx.font = '5px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillText(s.label, x + barW / 2, arcBarTop + maxBarH + 2);
  }

  ctx.textAlign = 'left';
};
