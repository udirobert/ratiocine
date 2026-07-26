"""
Shared prompt and answer-parsing logic for the IOL submission.

Strategy: direct task-specific prompting with robust answer parsing.
The model outputs answers directly (one per line). Qwen3 models may use
<think>...</think> tags for reasoning, which we extract for the explanation
column and then parse the final answer.

CRITICAL FIX from v1: The _looks_like_analysis filter is REMOVED.
It was dropping ~5% of correct translation answers that started with
common English words (The, We, There, Where, etc.).
"""

import re

USER_TEMPLATE = """\
{context}

{query}"""

# --- Task-specific system prompts (direct, no CoT) ---

_PROMPTS = {
    "translation": """\
You are an expert linguistic analyst solving International Linguistics Olympiad translation problems. \
You are given bilingual examples from a language you have never seen. \
Deduce the vocabulary and grammar from the examples, then translate the requested items.

Output format (REQUIRED):
<analysis>
Step 1: Identify the source word for each numbered item and look up its meaning from the examples.
Step 2: Note any grammar (case, tense, agreement) that must be applied.
Step 3: Compose the EXACT target-language form, preserving notation like You_{sg}, You_{pl}.
</analysis>
<answers>
[translation 1]
[translation 2]
...
</answers>

Rules:
- Work out word meanings, affixes, and word order from the examples.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer every numbered item in the <answers> section, one per line, in order.
- Preserve notation like You_{sg}, You_{pl} exactly as used in the examples.
- The <answers> section is the ONLY thing that gets scored — be exact.
- If unsure, give your best guess rather than leaving a blank.""",

    "fill_blanks": """\
You are an expert linguistic analyst solving International Linguistics Olympiad fill-in-the-blank problems. \
You are given morphological or syntactic paradigms from a language you have never seen. \
Deduce the pattern, then fill each blank.

Output format (REQUIRED):
<analysis>
Step 1: Identify the pattern (prefix, suffix, stem change, or syntactic rule).
Step 2: Apply the pattern to each blank, noting any irregularities.
Step 3: Write the EXACT filled form, preserving notation like 1sg, 2pl.
</analysis>
<answers>
[form 1]
[form 2]
...
</answers>

Rules:
- Identify prefixes, suffixes, stem changes, or syntactic patterns from the examples.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer every numbered item in the <answers> section, one per line, in order.
- The <answers> section is the ONLY thing that gets scored — be exact.
- If unsure, give your best guess rather than leaving a blank.""",

    "text_to_num": """\
You are an expert linguistic analyst solving International Linguistics Olympiad number transliteration problems. \
You are given number words in an unfamiliar language with their values. \
Work out the number system (bases, multipliers, additives), then convert.

Rules:
- Identify the base system (e.g. base-5, base-10, base-20) and how numbers combine.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer every numbered item, one per line, in order.
- Give ONLY the numeral in digits (e.g. 111), nothing else. No words, no explanation.
- If unsure, give your best guess rather than leaving a blank.""",

    "num_to_text": """\
You are an expert linguistic analyst solving International Linguistics Olympiad number transliteration problems. \
You are given number words in an unfamiliar language with their values. \
Work out the number system (bases, multipliers, additives), then convert.

Rules:
- Identify the base system (e.g. base-5, base-10, base-20) and how numbers combine.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer every numbered item, one per line, in order.
- Give ONLY the number in the target language's words, nothing else. No numerals, no explanation.
- If unsure, give your best guess rather than leaving a blank.""",

    "match_letters": """\
You match words to their translations in an unfamiliar language. \
The words and translations are given in arbitrary order.

You MUST output ONLY single capital letters, one per line, in the order of the numbered items. \
Do NOT explain your reasoning. Do NOT output words or sentences. \
Output ONLY the letters (A, B, C, ...), one per line.

Example output:
A
C
B
D

Now match each item. Output ONLY letters, nothing else.""",
}

# Fallback for unknown task types
_DEFAULT_PROMPT = """\
You are an expert linguistic analyst competing in the International Linguistics Olympiad. \
You are given data from a language you have never seen, plus enough examples to deduce its rules. \
Answer every numbered item in the query. Put each answer on its own line, \
in order, with no numbering, no bullet points, and no extra text. \
If unsure, give your best guess rather than leaving a blank."""

# Legacy aliases
SYSTEM_PROMPT = _DEFAULT_PROMPT
SYSTEM_PROMPT_SIMPLE = _DEFAULT_PROMPT


def get_system_prompt(task_type: str = "") -> str:
    """Select the best system prompt for a given task type."""
    if task_type and task_type in _PROMPTS:
        return _PROMPTS[task_type]
    return _DEFAULT_PROMPT


def count_query_items(query: str) -> int:
    """Estimate how many numbered items are in the query."""
    n = len(re.findall(r"^\s*\d+[\.\)]", query, re.MULTILINE))
    return n


def parse_answers(text: str, n_expected: int = 0, task_type: str = "") -> list[str]:
    """Extract answers from model output, handling various formats.

    Strategies (tried in order):
    1. Content after </think> tag (Qwen3 thinking mode)
    2. Content between <answers>...</answers> tags
    3. Content after </analysis> tag
    4. Numbered lines (1. foo, 2. bar) stripped of numbering
    5. All non-empty lines (last resort)

    IMPORTANT: We do NOT filter "analysis-like" lines. The v1 parser had a
    _looks_like_analysis filter that dropped ~5% of correct translation
    answers (e.g. "We shuddered.", "The woman is afraid of my dog.") because
    they started with common English words. That filter is removed.
    """
    answers: list[str] = []

    # 0. If Qwen3 thinking mode, extract content after </think>
    think_split = re.split(r"</think>", text, flags=re.DOTALL)
    if len(think_split) > 1:
        text = think_split[-1].strip()

    # 1. Try <answers> tags
    ans_match = re.search(r"<answers>\s*(.*?)\s*</answers>", text, re.DOTALL)
    if ans_match:
        raw = ans_match.group(1)
        answers = [ln.strip() for ln in raw.splitlines() if ln.strip()]

    # 2. If no <answers> tag, try content after </analysis> tag
    if not answers:
        post_analysis = re.split(r"</analysis>", text, flags=re.DOTALL)
        if len(post_analysis) > 1:
            tail = post_analysis[-1].strip()
            if tail:
                answers = [ln.strip() for ln in tail.splitlines() if ln.strip()]

    # 3. Try numbered lines, stripping numbering
    if not answers:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        numbered = []
        for ln in lines:
            m = re.match(r"^\d+[\.\)]\s*(.+)", ln)
            if m:
                numbered.append(m.group(1).strip())
        if numbered:
            answers = numbered

    # 4. Last resort: all non-empty lines, skip obvious markdown/headers
    #    NOT skipping analysis prose — that was the v1 bug.
    if not answers:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        filtered = []
        for ln in lines:
            if ln.startswith(("#", "- ", "* ", "**", "|", "<", "```")):
                continue
            filtered.append(ln)
        if filtered:
            answers = filtered

    # 5. Clean up: strip numbering, bullets, markdown
    cleaned = []
    for a in answers:
        a = re.sub(r"^\d+[\.\)]\s*", "", a)  # strip "1. " prefix
        a = a.strip("- *•\t ")
        a = re.sub(r"\*{1,2}(.+?)\*{1,2}", r"\1", a)  # strip markdown bold/italic
        if a:
            cleaned.append(a)

    # 6. Task-specific post-processing
    if task_type == "match_letters":
        cleaned = _extract_letters(cleaned, n_expected)
    elif task_type == "text_to_num":
        cleaned = _extract_numbers(cleaned, n_expected)

    # 7. Ensure at least one answer
    if not cleaned:
        cleaned = [""]

    # 8. Pad if we got fewer than expected
    if n_expected and len(cleaned) < n_expected:
        cleaned.extend([""] * (n_expected - len(cleaned)))

    # 9. Trim if we got more than expected
    if n_expected and len(cleaned) > n_expected:
        cleaned = cleaned[:n_expected]

    return cleaned


def extract_analysis(text: str) -> str:
    """Extract reasoning for the explanation column (human jury track).

    For Qwen3 thinking mode, extracts the <think>...</think> content.
    For direct-prompt mode, returns a brief note.
    """
    # Try <think> tags (Qwen3)
    m = re.search(r"<think>(.*?)</think>", text, re.DOTALL)
    if m:
        analysis = m.group(1).strip()
        if len(analysis) > 500:
            analysis = analysis[:497] + "..."
        return analysis

    # Try <analysis> tags
    m = re.search(r"<analysis>\s*(.*?)\s*</analysis>", text, re.DOTALL)
    if m:
        analysis = m.group(1).strip()
        if len(analysis) > 500:
            analysis = analysis[:497] + "..."
        return analysis

    # For direct prompts, provide a minimal explanation
    # If there's thinking content (text before </think>), use it
    think_split = re.split(r"</think>", text, maxsplit=1)
    if len(think_split) > 1 and think_split[0].strip():
        analysis = think_split[0].strip()
        if len(analysis) > 500:
            analysis = analysis[:497] + "..."
        return analysis

    return "Direct translation using deduced linguistic patterns from examples."


def _extract_letters(answers: list[str], n_expected: int) -> list[str]:
    """For match_letters: extract single capital letters from the output."""
    letters = []
    for a in answers:
        m = re.search(r"\b([A-Z])\b", a)
        if m:
            letters.append(m.group(1))
        elif len(a) == 1 and a.isalpha():
            letters.append(a.upper())
        elif len(a) == 2 and a[1].isalpha() and a[0].isdigit():
            letters.append(a[1].upper())
        else:
            m = re.search(r"([A-Z])(?:\s*[->:\|]\s*|\s*$)", a)
            if m:
                letters.append(m.group(1))
            else:
                letters.append(a)

    if n_expected and len(letters) < n_expected:
        letters.extend(["A"] * (n_expected - len(letters)))

    return letters


def _extract_numbers(answers: list[str], n_expected: int) -> list[str]:
    """For text_to_num: extract the numeral from the answer."""
    numbers = []
    for a in answers:
        m = re.search(r"(\d+(?:\s*[-+^=]\s*\d+)*)", a)
        if m:
            numbers.append(m.group(1).replace(" ", ""))
        else:
            numbers.append(a)

    return numbers
