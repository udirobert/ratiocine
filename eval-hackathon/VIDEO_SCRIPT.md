# Video walkthrough script (~4.5 min)

Record screen + voiceover. Suggested flow: terminal visible throughout.

## 0:00–0:30 — The claim

> "Frontier models ace linguistics puzzles — when you hand them the
> morpheme bank. Take the scaffold away and they fall apart. This eval
> measures exactly where that boundary is."

Show `eval-hackathon/REPORT.md` headline + the two evals.

## 0:30–1:30 — Eval 1: the task

Open `data/puzzles.json` → one puzzle (e.g. Apurinã). Show:
- evidence pairs (`nhaapitaka` = "I am going")
- morpheme bank
- a query

Run one live call:

```bash
python3 eval-hackathon/run_eval.py --model gpt-oss-120b --provider neon --limit 0
```

(or show a stored result to avoid live latency — `results/` has raws)

Show the grader output line: `dec=Y surf=Y chrf=1.00`.

## 1:30–2:30 — The obfuscation intervention

```bash
python3 scripts/obfuscate_puzzles.py --seed 1 --output /tmp/puzzles_obf.json
```

Show the same puzzle in obfuscated orthography — English glosses intact,
target-language strings ciphered. Point out vowel/consonant classes are
preserved so the problem is still solvable — only memorized orthography
is removed.

Show the results table (`aggregate.py --markdown`): frontier models
score ~0.92–1.00 in BOTH conditions → "they genuinely induce the
grammar — the bank is doing the reasoning for them."

## 2:30–3:30 — Eval 2: remove the scaffold

Linguini — raw IOL problems, no morpheme bank:

```bash
python3 eval-hackathon/run_linguni_eval.py --model claude-opus-4-8 --provider neon --limit 10
```

Show stored results: claude-opus-4-8 EM 0.434 / chrF 0.590 over 160
problems; per-type table with `text_to_num`/`num_to_text` weakest.

Show one failure transcript (`results/` → a `text_to_num` record):
model derives correct values in reasoning but can't structure the
answer — or genuinely fails numeral induction.

## 3:30–4:15 — Grader integrity + reproduce

```bash
python3 eval-hackathon/regrade.py          # re-grade raws, $0
python3 eval-hackathon/aggregate.py --markdown
```

Mention: gold 42/42 pass, corrupted 0/19 false-pass, stdlib-only,
stored raws → judges can verify every number without API keys.

## 4:15–4:45 — Close

> "The limitation isn't that models can't do morphology — it's that
they can't discover the structure of the problem. Give them the frame
and they're near-perfect, even in a cipher. Remove the frame and they
drop to ~43% EM on real olympiad problems. That's the eval."

End card: repo path + `eval-hackathon/REPORT.md`.
