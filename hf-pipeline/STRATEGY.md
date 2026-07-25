# Strategy & Findings — ratiocine IOL-AI 2026

## Where we are

### Baseline results (Linguini, 160 problems)

| Metric        | Simple prompt | Task-specific | Gemini Flash (40) |
|---------------|---------------|---------------|--------------------|
| Overall EM    | 0.128         | 0.145         | 0.268              |
| Overall chrF  | 0.389         | 0.381         | 0.131              |
| Overall Score | 0.224         | 0.235         | 0.187              |

By task type (Gemma 4 31B, task-specific prompts):

| Task type       | Score  | EM     | chrF   | Items | Status         |
|-----------------|--------|--------|--------|-------|----------------|
| fill_blanks     | 0.284  | 0.160  | 0.501  | 131   | Strong         |
| translation      | 0.247  | 0.117  | 0.522  | 429   | Solid carrier  |
| match_letters   | 0.105  | 0.211  | 0.053  | 223   | EM up, chrF low|
| num_to_text     | 0.142  | 0.037  | 0.546  | 27    | Needs work     |
| text_to_num     | 0.092  | 0.077  | 0.109  | 26    | Needs work     |

### Caveats

1. **Data contamination**: Linguini is public. Gemma 4 may have seen these
   problems during training. The hidden IOL 2026 test set will be novel.
   Expect scores to drop 30-50% on the real test set.
2. **chrF is our weak link**: The competition score is a geometric mean,
   so a low chrF caps the score even with high EM. Gemini Flash gets high
   EM but terrible chrF because its answers are terse/wrong-formatted.
3. **match_letters chrF is near-zero**: chrF measures character n-gram
   overlap. Single letters have almost no n-gram overlap with the gold
   unless they're exactly right. This means match_letters score is
   almost entirely driven by EM.

## Strategy for a defensible submission

### Principle 1: Optimize for the geometric mean

score = sqrt(EM_weighted * chrF_weighted)

Both factors must be non-zero for the score to be non-zero. A model that
gets 50% EM but 2% chrF scores only 0.032. We need balanced performance.

**Implication**: We should prefer the model with the best (EM * chrF)
product, not the one with the highest EM alone. Currently that's Gemma 4
(high chrF, moderate EM) over Gemini Flash (high EM, low chrF).

### Principle 2: Task-specific optimization

Different task types need fundamentally different approaches:

- **translation** (429 items, 53% of all): This is where we win or lose.
  chrF matters most here because translation answers are long strings.
  Focus on getting close, not just exact.

- **fill_blanks** (131 items): Our best category. The model deduces
  morphological patterns well. Keep the current approach.

- **match_letters** (223 items, 27%): EM-driven because chrF is near-zero
  for single-letter answers. Focus on getting more letters right.
  Could benefit from structured reasoning (list all morpheme-to-meaning
  pairs, then match).

- **text_to_num / num_to_text** (53 items): The model struggles with
  unfamiliar number systems. These need explicit step-by-step reasoning
  to work out the base system before answering.

### Principle 3: Ensemble for robustness

Different models have complementary strengths:
- Gemma 4 31B: high chrF (0.38), moderate EM (0.14) — good at partial credit
- Gemini 3.6 Flash: high EM (0.27), low chrF (0.13) — good at exact matches

**Proposed ensemble** (for the T4 submission, not the test harness):
1. Run the fine-tuned Qwen model as primary (expected to beat both)
2. For match_letters: use a CoT prompt that forces the model to list
   morpheme correspondences before answering
3. For text_to_num: use a CoT prompt that explicitly works out the
   number base first

On the Arkor endpoint, we can test ensembling by running both models
and taking the answer with higher confidence per item.

### Principle 4: Validate generalization, not memorization

The Linguini scores may be inflated. To measure true generalization:

1. **Hold-out validation**: Split Linguini into train/test (80/20).
   Fine-tune on 80%, evaluate on 20%. If the 20% score is much lower
   than the 100% score, the model is memorizing, not generalizing.

2. **Cross-task transfer**: Train on translation, test on fill_blanks.
   If the model learned general IOL reasoning (not just translation),
   it should still improve on fill_blanks.

3. **Novel problems**: Create 5-10 synthetic IOL-style problems that
   don't exist in any public dataset. Test zero-shot on these.

## Next steps (priority order)

### P0: Quick wins (do today)
1. **Fix text_to_num prompt**: The task-specific prompt made it worse.
   Try a CoT variant that explicitly works out the number base.
2. **Improve match_letters**: Add a "list correspondences first" step
   in the prompt. The model needs to reason before guessing letters.
3. ~~**Test with gpt-5-6-sol**: Available on the Arkor endpoint, may be
   the strongest reasoner.~~ Done — GPT-5 is very accurate (first
   fill_blanks answer was exact) but ~20s/problem = too slow for the
   30 min T4 limit on 160 problems. Could be used selectively on hard
   problems if we add a confidence-based routing layer.

### P1: Fine-tuning (needs GPU)
1. **Prepare training data**: Convert all 160 Linguini problems to
   chat format with task-specific prompts as the system message.
2. **Fine-tune Qwen2.5-7B**: SFT with LoRA, 3 epochs, on the full
   Linguini dataset.
3. **Hold-out evaluation**: Split 80/20, measure generalization gap.

### P2: Submission pipeline
1. **Quantize**: 4-bit bitsandbytes for T4 16GB
2. **Test timing**: 160 problems in 30 min = ~11s per problem.
   Current Gemma inference is ~2s per problem via API, but local
   inference on T4 will be slower.
3. **Ship**: Push weights + script.py to public HF repo
4. **Submit**: Enter repo ID in competition Space

### P3: Human jury track (optional)
1. Add `explanation` column to submission.csv
2. Short, human-readable explanation of the model's reasoning
3. Not a raw trace — a summary of the key linguistic insight
