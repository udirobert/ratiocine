# Last Translation Benchmark V2 Export Schema

## Purpose

Convert our IOL game problems into the Last Translation Benchmark V2 submission format.

## LTB Format Reference

From the [HuggingFace dataset](https://huggingface.co/datasets/zouhar/last-translation-benchmark):

```json
{
  "id": 337,
  "source_text": "Our new nurse used to play in the men's professional football team.",
  "source_lang": "English",
  "target_lang": "German",
  "source_lang_iso": "eng",
  "target_lang_iso": "deu",
  "source_instructions": null,
  "source_media": null,
  "translations": [
    {
      "model": "human",
      "translation": "Unser neuer Krankenpfleger hat früher in der Profifußballmannschaft der Männer gespielt.",
      "verified": [true]
    },
    {
      "model": "Google Translate",
      "translation": "Unsere neue Krankenschwester spielte früher in der Profifußballmannschaft der Männer.",
      "verified": [false]
    },
    {
      "model": "Gemini 3.1 Pro",
      "translation": "Unser neuer Krankenpfleger hat früher in der Profifußballmannschaft der Männer gespielt.",
      "verified": [true]
    }
  ],
  "verification_rules": [
    "Nurse must be translated to its male version (Krankenpfleger), not Krankenschwester."
  ],
  "linguistics": [
    "Target Gap: Morph to Words",
    "Morphological"
  ],
  "attribution": "https://ratiocine.trustfall.xyz/play",
  "tags": ["LTBv2", "IOL", "morphology"]
}
```

## Our Problem Format → LTB Mapping

### Current Problem Schema (`showcase/app/play/puzzle-data.ts`)

```typescript
{
  id: "apurina_kinship",
  language: "Apurinã",
  region: "Western Amazon",
  family: "Arawakan",
  speakers: "~2,500",
  concept: "Kinship & possession",
  contextRows: [
    { source: "nukutxi", target: "my son", gated: false },
    { source: "ukupa", target: "his father", gated: false },
    // ...
  ],
  queries: [
    { prompt: "my father", answer: ["u", "ku", "pa"] },
    { prompt: "his son", answer: ["i", "kutxi"] },
    // ...
  ],
  tiles: ["u", "i", "ku", "awa", "pa", "kutxi", "nhi"],
  hint: "Notice how possession is marked..."
}
```

### Conversion Logic

#### 1. Determine `source_text` and `target_lang`

IOL problems are **few-shot deduction tasks**, not direct translation pairs. Our "source" is:
- **Evidence pairs** (bilingual examples)
- **Query prompt** (English description)
- **Task instruction** (implicit: "deduce the morphology")

**Approach:** Treat each query as a separate LTB example where:
- `source_text` = query prompt (English)
- `source_lang` = "English"
- `target_lang` = puzzle language (e.g., "Apurinã")
- `source_instructions` = full context (all evidence rows + hint + tiles available)

#### 2. Generate `verification_rules`

From the ground truth answer, we can derive rules:

Example: `queries[0] = {prompt: "my father", answer: ["u", "ku", "pa"]}`

**Verification rules:**
1. "Translation must use exactly 3 morphemes: 'u', 'ku', 'pa'."
2. "Morphemes must appear in this exact order: u-ku-pa."
3. "Translation must not use any morphemes outside the provided tile bank."
4. "Translation must express possession ('my') and the kinship term ('father')."

**Generalized rule template:**

```python
def generate_verification_rules(query, answer, tiles, context_rows):
    rules = []

    # Rule 1: Exact morpheme match
    rules.append(f"Translation must use exactly {len(answer)} morpheme(s): {', '.join(repr(m) for m in answer)}.")

    # Rule 2: Order constraint
    rules.append(f"Morphemes must appear in this exact order: {'-'.join(answer)}.")

    # Rule 3: Tile bank constraint
    rules.append(f"Translation must only use morphemes from the provided tile bank: {', '.join(tiles)}.")

    # Rule 4: Semantic constraint (extracted from query prompt)
    rules.append(f"Translation must express the meaning: '{query.prompt}'.")

    # Rule 5: Evidence consistency (check if answer aligns with evidence patterns)
    # Example: if "u" appears in evidence as "my", reject translations using "i" (his) for "my"
    for row in context_rows:
        if any(morph in row.source for morph in answer):
            rules.append(f"Translation must be consistent with the evidence pattern: '{row.source}' → '{row.target}'.")

    return rules
```

#### 3. Generate `translations` (human + model)

From solver trace data (once we have it):

```json
"translations": [
  {
    "model": "human_solver_session_abc123",
    "translation": "uku pa", // wrong (missing first morpheme)
    "verified": [false, false, true, true, false]
  },
  {
    "model": "human_solver_session_def456",
    "translation": "u ku pa",
    "verified": [true, true, true, true, true]
  },
  {
    "model": "Qwen2.5-14B-Instruct-AWQ",
    "translation": "u ku pa",
    "verified": [true, true, true, true, true]
  },
  {
    "model": "Gemini 2.5 Flash",
    "translation": "ukupa", // wrong (concatenated, not segmented)
    "verified": [false, false, true, true, false]
  }
]
```

#### 4. Annotate `linguistics`

Map our puzzles to LTB linguistic categories:

| Our Puzzle | LTB Linguistics Tags |
|------------|---------------------|
| Apurinã kinship | `["Morphological", "Target Gap: Words to Morph", "Agglutinative"]` |
| Swahili noun class | `["Morphological", "Agreement", "Nominal Classification"]` |
| Turkish case system | `["Morphological", "Case System", "Agglutinative"]` |
| Quechua verb conjugation | `["Morphological", "Verbal Inflection", "Person/Number Agreement"]` |
| Nahuatl numerals | `["Semantic/Lexical", "Numeral System", "Conventions"]` |

From the [LTB paper](https://arxiv.org/abs/2609.04173), common tags include:
- `"Morphological"`, `"Syntactic"`, `"Semantic/Lexical"`, `"Pragmatic"`, `"Orthography"`, `"Phonological"`
- `"Target Gap: Words to Morph"`, `"Target Gap: Morph to Words"`, `"Agglutinative"`, `"Polysemy"`, `"False Friends"`, `"Cultural Artifact"`, `"Meta Reasoning"`

#### 5. Add `source_instructions` (full IOL context)

```json
"source_instructions": "Given the following bilingual evidence pairs and a tile bank of morphemes, deduce the correct morpheme sequence for the query.\n\nEvidence:\n- nukutxi → my son\n- ukupa → his father\n- awanhi → our mother\n- ikutxi → his son\n\nAvailable morphemes: u, i, ku, awa, pa, kutxi, nhi\n\nHint: Notice how possession is marked by prefixes (u- for 'my', i- for 'his', awa- for 'our') and kinship terms are suffixes (-pa for 'father', -kutxi for 'son', -nhi for 'mother').\n\nQuery: my father"
```

## Example LTB Entry (Generated from Apurinã Puzzle)

```json
{
  "id": 10001,
  "source_text": "my father",
  "source_lang": "English",
  "target_lang": "Apurinã",
  "source_lang_iso": "eng",
  "target_lang_iso": "apu",
  "source_instructions": "Given the following bilingual evidence pairs and a tile bank of morphemes, deduce the correct morpheme sequence for the query.\n\nEvidence:\n- nukutxi → my son\n- ukupa → his father\n- awanhi → our mother\n- ikutxi → his son\n\nAvailable morphemes: u, i, ku, awa, pa, kutxi, nhi\n\nHint: Notice how possession is marked by prefixes (u- for 'my', i- for 'his', awa- for 'our') and kinship terms are suffixes (-pa for 'father', -kutxi for 'son', -nhi for 'mother').",
  "source_media": null,
  "translations": [
    {
      "model": "human_solver_aggregate",
      "translation": "u ku pa",
      "verified": [true, true, true, true, true]
    },
    {
      "model": "Qwen2.5-14B-Instruct-AWQ",
      "translation": "u ku pa",
      "verified": [true, true, true, true, true]
    },
    {
      "model": "Gemini 2.5 Flash",
      "translation": "ukupa",
      "verified": [false, false, true, true, false]
    },
    {
      "model": "GPT-5",
      "translation": "u pa",
      "verified": [false, false, true, true, false]
    }
  ],
  "verification_rules": [
    "Translation must use exactly 3 morphemes: 'u', 'ku', 'pa'.",
    "Morphemes must appear in this exact order: u-ku-pa.",
    "Translation must only use morphemes from the provided tile bank: u, i, ku, awa, pa, kutxi, nhi.",
    "Translation must express the meaning: 'my father'.",
    "Translation must be consistent with the evidence pattern: 'ukupa' → 'his father' (swap 'u' for 'i' to change possessor)."
  ],
  "linguistics": [
    "Morphological",
    "Target Gap: Words to Morph",
    "Agglutinative",
    "Person/Possession Agreement"
  ],
  "attribution": "https://ratiocine.trustfall.xyz/play?puzzle=apurina_kinship",
  "tags": ["LTBv2", "IOL", "morphology", "rare-language", "few-shot"]
}
```

## Export Script (Python)

```python
# scripts/export_to_ltb.py
import json
from pathlib import Path

def load_puzzle_data():
    """Load puzzle data from TypeScript (or convert to JSON first)"""
    # For now, manually convert puzzle-data.ts to puzzles.json
    with open("showcase/app/play/puzzles.json") as f:
        return json.load(f)

def generate_ltb_entry(puzzle, query_index, solver_traces=None):
    query = puzzle["queries"][query_index]
    answer = query["answer"]

    # Build source_instructions
    evidence_text = "\n".join([
        f"- {row['source']} → {row['target']}"
        for row in puzzle["contextRows"]
        if not row.get("gated", False)  # only non-gated evidence
    ])

    source_instructions = (
        f"Given the following bilingual evidence pairs and a tile bank of morphemes, "
        f"deduce the correct morpheme sequence for the query.\n\n"
        f"Evidence:\n{evidence_text}\n\n"
        f"Available morphemes: {', '.join(puzzle['tiles'])}\n\n"
        f"Hint: {puzzle['hint']}\n\n"
        f"Query: {query['prompt']}"
    )

    # Generate verification rules
    verification_rules = [
        f"Translation must use exactly {len(answer)} morpheme(s): {', '.join(repr(m) for m in answer)}.",
        f"Morphemes must appear in this exact order: {'-'.join(answer)}.",
        f"Translation must only use morphemes from the provided tile bank: {', '.join(puzzle['tiles'])}.",
        f"Translation must express the meaning: '{query['prompt']}'.",
    ]

    # Add evidence-based rules (check for possession/person agreement)
    # TODO: extract patterns from evidence rows

    # Build translations from solver traces (if available)
    translations = []
    if solver_traces:
        for trace in solver_traces:
            translations.append({
                "model": f"human_solver_{trace['session_id'][:8]}",
                "translation": " ".join(trace["answers"][query_index]),
                "verified": verify_answer(trace["answers"][query_index], answer, verification_rules)
            })

    # Add our 14B model (from Modal)
    # TODO: run the model on this query and record output

    return {
        "id": 10000 + puzzle["puzzles"].index(puzzle) * 10 + query_index,
        "source_text": query["prompt"],
        "source_lang": "English",
        "target_lang": puzzle["language"],
        "source_lang_iso": "eng",
        "target_lang_iso": get_iso_code(puzzle["language"]),  # lookup table needed
        "source_instructions": source_instructions,
        "source_media": None,
        "translations": translations,
        "verification_rules": verification_rules,
        "linguistics": infer_linguistics_tags(puzzle),
        "attribution": f"https://ratiocine.trustfall.xyz/play?puzzle={puzzle['id']}",
        "tags": ["LTBv2", "IOL", "morphology", "rare-language", "few-shot"]
    }

def verify_answer(user_answer, ground_truth, rules):
    """Check each verification rule"""
    # Rule 1: exact match (order and content)
    rule1 = user_answer == ground_truth
    # Rule 2: order (already checked in rule 1)
    rule2 = rule1
    # Rule 3: tile bank constraint (check all morphemes are valid)
    # Rule 4: semantic constraint (can't verify automatically, assume correct if rule 1 passes)
    # Rule 5: evidence consistency (can't verify without context, assume correct if rule 1 passes)
    return [rule1, rule2, True, rule1, rule1]  # simplified

def get_iso_code(language_name):
    """Map language names to ISO 639-3 codes"""
    mapping = {
        "Apurinã": "apu",
        "Swahili": "swa",
        "Turkish": "tur",
        "Quechua": "que",
        "Nahuatl": "nah"
    }
    return mapping.get(language_name, "und")  # "und" = undetermined

def infer_linguistics_tags(puzzle):
    """Map puzzle concepts to LTB linguistics tags"""
    tags = ["Morphological"]  # all our puzzles are morphological

    if "kinship" in puzzle["concept"].lower() or "possession" in puzzle["concept"].lower():
        tags.extend(["Person/Possession Agreement", "Target Gap: Words to Morph", "Agglutinative"])

    if "noun class" in puzzle["concept"].lower():
        tags.extend(["Agreement", "Nominal Classification"])

    if "case" in puzzle["concept"].lower():
        tags.extend(["Case System", "Agglutinative"])

    if "verb" in puzzle["concept"].lower() or "conjugation" in puzzle["concept"].lower():
        tags.extend(["Verbal Inflection", "Person/Number Agreement"])

    if "numeral" in puzzle["concept"].lower():
        tags.extend(["Semantic/Lexical", "Numeral System", "Conventions"])

    return tags

def export_all_puzzles(output_path="data/ltb_export.json"):
    puzzles = load_puzzle_data()
    ltb_entries = []

    for puzzle in puzzles:
        for query_idx in range(len(puzzle["queries"])):
            entry = generate_ltb_entry(puzzle, query_idx)
            ltb_entries.append(entry)

    with open(output_path, "w") as f:
        json.dump(ltb_entries, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(ltb_entries)} LTB entries to {output_path}")

if __name__ == "__main__":
    export_all_puzzles()
```

## Submission Process

From the [LTB website](https://last-translation-benchmark.vilda.net):

1. **Register as a contributor** (if not already on the author list)
2. **Submit examples via web form** or **GitHub PR**
3. **Peer review** — each submission is reviewed by 2+ linguistics experts
4. **Acceptance criteria:**
   - Example breaks at least 1 SOTA model
   - Verification rules are objective and reproducible
   - Linguistic annotation is accurate
   - Attribution is clear (we'll link to our game)

## Next Steps

1. **Manually convert `puzzle-data.ts` → `puzzles.json`** for easier scripting
2. **Implement `export_to_ltb.py`** with full verification logic
3. **Run our 14B model on all 5 puzzles** to capture its translations (for the `translations` field)
4. **Run 2-3 SOTA models** (Gemini, GPT, Claude) on our puzzles to show they break
5. **Write a 1-page summary** explaining why IOL-style problems are valuable for LTB (few-shot, morphology-heavy, rare languages)
6. **Submit 1-2 example problems** to test the review process before batch-submitting all 25 queries

## Expected Impact

- **5 puzzles × 5 queries each = 25 LTB entries** (0.7% increase over LTBv1's 3456 examples)
- **Authorship credit** on LTB V2 paper (150+ co-authors, high-impact venue)
- **Citations** back to our game as a platform for crowdsourced IOL problems
- **Community visibility** in the MT / NLP / IOL research communities
