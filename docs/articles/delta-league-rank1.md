---
title: "Rank 1 on a model-editing leaderboard with $25 and zero training"
published: false
tags: machinelearning, llm, ai, africa
---

In a single day, on a $50 compute grant, my open research project **ratiocine** took **rank 1 and rank 2** on Delta League's qwen35-08b-v1 leaderboard — a weight-editing competition with 90+ submissions from teams that mostly trained real models. I trained nothing. I diffed the leaderboard itself, reverse-engineered what the winners had done, and composed their own recipes better than they did.

Regular readers (both of you) will remember the last outing: eight submissions to IOL-AI 2026, one parser bug quietly eating five percent, and a second-place finish out of 48 — beaten by 0.006, which stings in a way I have not fully processed. This is the sequel. Different competition, same constraint, same lesson wearing a different hat.

I build from Kenya, where a GPU hour isn't a line item — it's the whole budget. This is the story of what happens when a small grant lands on a project that's been waiting for exactly that.

## The sport nobody's heard of

[Delta League](https://deltaleague.ai) is a new kind of ML competition. You don't submit a model — you submit a **weight diff**: a sparse patch against a shared parent checkpoint (here, Qwen3.5-0.8B). The server applies your patch, runs a private 1,000-item eval suite (thinking ON, 8K tokens, real generation — GSM8K, MMLU, math-500, IFEval, the works), and ranks you.

It's closer to performance tuning than to ML in the usual sense. The leaderboard is a tree: every entry names its parent, so you can watch the community's edits layer on each other like a codebase's git history. And every checkpoint is freely downloadable — which turns out to be the whole game.

## The grant that was sized exactly right

The compute was a $50 credit from the **Africa Deep Tech Challenge 2026**, distributed through the **Africa GPU Hub** (aghcloud.ai) — the philanthropy arm of **Udu Technologies**, founded by ex-NVIDIA folks who also co-founded alliance4ai. The Challenge's thesis is one I live daily: don't build for exotic silicon — build for the 8 GB laptop with integrated graphics that actually sits on desks in classrooms, clinics, and corner shops across the continent. Engineering for the hardware people *have*.

Here's the part that doesn't fit in a leaderboard screenshot. Look at [my commit history](https://github.com/udirobert/ratiocine/commits/main): roughly twenty active days in four months. They arrive in bursts of two to fourteen days, separated by sixteen-to-thirty-day silences — and if you read the dates, you can see the compute windows:

- **Jul 25–27** — the IOL-AI submission deadline; eight submissions in three days
- **Aug 18–30** — a hackathon's free credits; the whole verifiable-grading build lives here
- **Sep 4–9** — submission prep, squeezed in before that window closed too
- **Oct 9–11** — a Modal allocation; the first full eval I'd managed to run in a month
- **Nov 7–8** — two days of follow-up work
- **Nov 24** — this grant, and everything you're reading now

Each burst is a compute window. Each silence is what "no GPU" looks like. The work doesn't stop; it just can't *execute* — you can design experiments on a laptop, but you can't run the ones that matter. Access to GPUs is the single most expensive input to doing this work from Nairobi, and it's the difference between a project that compounds and one that stalls waiting for the next voucher.

That's what the Hub's philanthropy programme (₦50M+ credits donated, 725+ projects funded, 54 countries) is actually buying — not GPU-hours, but *uninterrupted iteration*. We rented a 2×L40 node at $2.80/hr — enough VRAM and a new-enough architecture (sm_89) to run the competition's pinned bf16 evaluation pipeline *exactly as the server runs it*. Total spend for what follows: about $25.

## Weight forensics: reading the leaderboard's mind

Every leaderboard row told us its recipe in plain text ("50/50 Model Soup layers 0-22", "calibrated L23 phase-gating graft, neurons 1998/3529"). But names are claims. We wanted ground truth, so we pulled the checkpoints and diffed them, tensor by tensor:

- `eff1e1b7` vs `fb984a19`: **exactly 3 tensors differ**, all in layer 23. A surgical patch.
- `917d6b4f` vs `eff1e1b7`: 249 tensors, layers 0–22 only — the advertised "layer soup".
- `5a701d1b` vs `a6eb9f13`: again 3 tensors — the celebrated phase-gating graft is just the L23 MLP `gate/up/down_proj` triplet.
- `04280ef5` (board's highest validation, 50.3): 270 tensors, *every* layer — that's a **trained distillation delta** from a 4B teacher, a completely different edit family.

Twenty minutes of `delta model pull` and a ten-line safetensors script told us more than a week of guessing would have.

None of what we found was folk magic — every recipe on the board traces to a paper. Model soups come from Wortsman et al., who showed that averaging the weights of models fine-tuned from the same init often beats any single ingredient ([arXiv:2203.05482](https://arxiv.org/abs/2203.05482)). Treating a weight diff as an object you can add, subtract, and transplant is Task Arithmetic (Ilharco et al., [arXiv:2212.04089](https://arxiv.org/abs/2212.04089)). The surgical neuron patches descend from ROME-style localised model editing (Meng et al., [arXiv:2202.05262](https://arxiv.org/abs/2202.05262)) — and, as we'd discover the expensive way, inherit its biggest caveat. GRPO is the reinforcement-learning recipe from DeepSeekMath ([arXiv:2402.03300](https://arxiv.org/abs/2402.03300)), and the distillation idea is Hinton et al., a decade old and still the strongest single edit family on the board ([arXiv:1503.02531](https://arxiv.org/abs/1503.02531)). The leaderboard is those papers, compressed into safetensors and fighting in public.

## What worked, what regressed, what won

**First move:** soup two orthogonal delta families — the layer soup and a GRPO seed soup — at 50/50. Local eval said "maybe better." Server said **rank 1, test 54.80 — and validation 49.59, the highest on the board**.

**Second move:** transplant the surgical L23 graft onto the blend. Locally neutral. Server: −2.0 points, rank 19. The lesson cost one submission: *surgical patches are calibrated to their base*. A 3-tensor trick that's +0.5 on one checkpoint overshoots on a blend — the neurons it gates are already blended away from the reference.

**Third move:** three-family blend at 0.4/0.4/0.2. **Rank 1 again — test 54.90.** We now held both top spots.

**The pattern that emerged:** local eval is a compass, not a map — fine for ruling things *out* (a ⅓-each blend collapsed GSM8K locally; we never submitted it), useless for fine distinctions (it called the graft neutral). And *trained* deltas — GRPO, distillation — port across bases. Surgical patches don't.

## Where this is going: the distill transplant

Our last experiment of the day was the delta-graph's biggest finding made concrete: take the board's highest-validation family — SpacexCeo's 4B→0.8B distillation — and add its delta to our rank-1 blend.

Locally it's not close: **+6 mean points** across the likelihood suite (boolq +17, commonsense_qa +14, arc +9, MMLU 54.4 vs 46.5). The patch is staged and waits for tomorrow's submission quota. Watch this space.

## And what is ratiocine, anyway?

ratiocine is an open linguistics-and-reasoning research project — the kind of work this grant was built to enable. Three threads:

1. **Competition AI for the International Olympiad in Linguistics.** IOL problems are the world's best natural reasoning benchmark — deciphering unseen languages from raw data. This is where the project started: eight submissions to IOL-AI 2026, a parser bug that had been quietly eating five percent of the score, and **2nd place out of 48 teams** on the hidden private split — 0.006 behind first. Full writeup: [What a GPU Doesn't Understand About Language](https://medium.com/@ungethe/what-a-gpu-doesnt-understand-about-language-bccacf3654c6).
2. **Verifiable AI.** Our Neutron/ICP track ("Ration") grades model answers deterministically *inside a canister* and chain-key-signs the receipt — a certified reasoning logbook, live at ratiocine.trustfall.xyz.
3. **A daily linguistics game** that crowdsources hard problems and human solver strategies — research data with a fun delivery mechanism.

This Delta League run slots into the same agenda: *understand models by editing them, cheaply*. The whole pipeline — forensics scripts, eval runners, the delta-graph, every result — is in the open at [github.com/udirobert/ratiocine](https://github.com/udirobert/ratiocine) (see `docs/model-competitions.md`).

The project runs on a quilt of donated compute, and it genuinely doesn't exist without it: **Modal** for the IOL eval pipeline and Ration's GPU engine, **Vultr** for the always-on box, **concentrate.ai** for inference credits, **Arkor** for rapid prototyping — and now **UduTech / the Africa GPU Hub**, whose $50 bought this leaderboard.

If you want in: play the daily game, pull the delta-graph and find a recipe I missed, or submit your own patch and try to knock me off the top. The board's at deltaleague.ai — the 0.8B track is friendly to newcomers.

## The moral

Compute credits hit different when they're small enough to make you careful — and when you know exactly how long the silence after them tends to be. $50 didn't buy a training run; it bought a day of *uninterrupted iteration against ground truth*, which is the scarcest resource in this work, at least from where I sit. The Africa GPU Hub bets that African builders with a GPU voucher will find cleverer uses for it than the number suggests. This week, the clever use was: read everyone's homework, then write a better one.

If you're building from somewhere GPU access is scarce — Nairobi, Lagos, Accra, anywhere the cloud bill lands in a currency that makes you wince — the delta-graph is yours. Take it.

---

*Numbers: rank 1 s3lite test 54.90 / val 48.5, rank 2 soup2 test 54.80 / val 49.59 (highest validation on the board), rank 19 soup2g 52.80 (the graft regression). Eval config `private1000-v6-thinking8k-20261111`. Spend ≈ $25 of the $50 credit.*
