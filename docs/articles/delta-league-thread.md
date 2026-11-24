# Social thread — Delta League rank 1
# Article: https://dev.to/papajams/rank-1-on-a-model-editing-leaderboard-with-25-and-zero-training-4el2
# Images: docs/articles/assets/cover-crane-brand.png (post 1), forensics-brand.png (post 3)

Post 1 (hook) [attach cover-crane-brand.png]:
In one day, on a $50 GPU grant, ratiocine took rank 1 AND rank 2 on Delta League's model-editing leaderboard — 90+ submissions, zero training.

I diffed the leaderboard itself and composed the winners' own recipes better than they did.

What $25 of compute actually buys 🧵

Post 2 (the sport):
Delta League: you don't submit a model, you submit a weight DIFF — a sparse patch to a shared Qwen3.5-0.8B checkpoint. Server applies it, runs a private 1,000-item eval, ranks you.

Every checkpoint is downloadable. Every entry names its parent + recipe.

So I pulled them.

Post 3 (forensics) [attach forensics-brand.png]:
Tensor-by-tensor diffs turned recipe names into actual recipes:

• "phase-gating graft" = 3 tensors in layer 23
• "layer soup" = 249 tensors, layers 0–22
• highest-val entry = 270 tensors, every layer — a 4B→0.8B distill delta

20 min of downloads > a week of guessing.

Post 4 (what worked):
• 50/50 soup of two delta families → rank 1 (54.80)
• 3-family blend → rank 1 again (54.90)
• surgical graft on a blend → −2 pts, rank 19

Lesson: surgical patches are base-specific. Trained deltas (GRPO, distillation) travel. Local eval is a compass, not a map.

Post 5 (the grant):
This ran on a 2×L40 at $2.80/hr via the Africa GPU Hub — @xelatsads's UduTech philanthropy arm (@alliance4ai).

I build from Nairobi. My commit history: ~20 active days in 4 months — bursts of 2–14 days, then silence. Each burst is a compute window. Each silence is "no GPU".

Post 6 (why it matters):
$50 doesn't buy a training run. It buys uninterrupted iteration against ground truth — the actual scarce resource.

If you're building where GPU access is scarce, the delta-graph I built mining the board is open: github.com/udirobert/ratiocine

Post 7 (CTA):
Full writeup — the forensics, the regression, the paper trail behind every recipe:

https://dev.to/papajams/rank-1-on-a-model-editing-leaderboard-with-25-and-zero-training-4el2

The board's at deltaleague.ai. Come knock me off the top.

---

Alt single-post version (if you'd rather not thread):
Rank 1 AND 2 on Delta League's model-editing leaderboard — on $25 of a $50 Africa Deep Tech GPU grant (UduTech/@xelatsads).

Zero training: I diffed the leaderboard's own checkpoints and composed the winners' recipes. Writeup + open delta-graph: https://dev.to/papajams/rank-1-on-a-model-editing-leaderboard-with-25-and-zero-training-4el2

---

LinkedIn version (single post):
In one day, on a $50 compute grant, my open research project ratiocine took rank 1 and rank 2 on Delta League's model-editing leaderboard — 90+ submissions, and I trained nothing.

Delta League asks for weight diffs, not models: a sparse patch to a shared Qwen3.5-0.8B checkpoint, scored by a private eval suite. Every leaderboard checkpoint is downloadable, so I diffed them — and reconstructed exactly what the winners had done: 3-tensor surgical grafts, per-layer soups, a 4B→0.8B distillation delta.

Then I composed the recipes better than the originals: a 50/50 soup of two orthogonal delta families took rank 1, and a three-family blend retook it at test 54.90.

The compute: a $50 credit from the Africa Deep Tech Challenge, via the Africa GPU Hub (aghcloud.ai). I build from Nairobi, where GPU access is the single most expensive input to this work — ratiocine's commit history is ~20 active days in four months, each burst a compute window, each silence the lack of one. $25 spent bought a day of uninterrupted iteration, and it bought a public rank-1 result. This is what grant programs like this are for.

Full writeup + the open delta-graph: https://dev.to/papajams/rank-1-on-a-model-editing-leaderboard-with-25-and-zero-training-4el2
