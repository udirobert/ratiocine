"""
Shared prompt and answer-parsing logic for the IOL submission.

Imported by both script.py (competition harness, needs torch) and
test_local.py (local testing via Arkor API, no torch needed).

Strategy: task-aware prompting. Each IOL task_type requires different
reasoning and output formatting. We select the system prompt based on
the task_type field in the test data, and use robust multi-strategy
parsing to extract answers regardless of model output format.
"""

import re

USER_TEMPLATE = """\
{context}

{query}"""

# --- Task-specific system prompts ---
# The competition task_types: translation, fill_blanks, text_to_num,
# num_to_text, match_letters. The live set may include other IOL task types.

_PROMPTS = {
    "translation": """\
You are an expert linguistic analyst solving International Linguistics Olympiad translation problems. \
You are given bilingual examples from a language you have never seen. \
Deduce the vocabulary and grammar from the examples, then translate the requested items.

Rules:
- Work out word meanings, affixes, and word order from the examples.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer every numbered item, one per line, in order.
- Give ONLY the translation, nothing else. No numbering, no labels, no notes.
- Preserve notation like You_{sg}, You_{pl} exactly as used in the examples.
- If unsure, give your best guess rather than leaving a blank.""",

    "fill_blanks": """\
You are an expert linguistic analyst solving International Linguistics Olympiad fill-in-the-blank problems. \
You are given morphological or syntactic paradigms from a language you have never seen. \
Deduce the pattern, then fill each blank.

Rules:
- Identify prefixes, suffixes, stem changes, or syntactic patterns from the examples.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer every numbered item, one per line, in order.
- Give ONLY the filled form, nothing else. No numbering, no labels, no notes.
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

# Fallback for unknown task types (the live test set may include new types)
_DEFAULT_PROMPT = """\
You are an expert linguistic analyst competing in the International Linguistics Olympiad. \
You are given data from a language you have never seen, plus enough examples to deduce its rules. \
Answer every numbered item in the query. Put each answer on its own line, \
in order, with no numbering, no bullet points, and no extra text. \
If unsure, give your best guess rather than leaving a blank."""

# Legacy prompts kept for backward compatibility
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
    1. Content between <answers>...</answers> tags
    2. Content after </analysis> tag
    3. Numbered lines (1. foo, 2. bar) stripped of numbering
    4. All non-empty lines, filtering out analysis prose

    For match_letters: extracts single capital letters specifically.
    """
    # Special case for match_letters: scan the entire text for letter patterns
    if task_type == "match_letters":
        letters = _extract_letters_from_text(text, n_expected)
        if letters:
            return letters

    answers: list[str] = []

    # 1. Try <answers> tags first (preferred format)
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

    # 3. Try numbered lines, filtering out analysis headers
    if not answers:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        numbered = []
        for ln in lines:
            m = re.match(r"^\d+[\.\)]\s*(.+)", ln)
            if m:
                content = m.group(1).strip()
                if not _looks_like_analysis(content):
                    numbered.append(content)
        if numbered:
            answers = numbered

    # 4. Last resort: all non-empty lines, filtering out analysis
    if not answers:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        filtered = []
        for ln in lines:
            if ln.startswith(("#", "- ", "* ", "**", "|")):
                continue
            if _looks_like_analysis(ln):
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

    # 8. Trim if we got more than expected
    if n_expected and len(cleaned) > n_expected:
        cleaned = cleaned[:n_expected]

    return cleaned


def _extract_letters_from_text(text: str, n_expected: int) -> list[str]:
    """Scan the full model output for match_letters answers.

    Instead of relying on line-by-line parsing, we look for patterns like:
    - Lines that are just a single capital letter: "A"
    - Numbered items followed by a letter: "1. A", "1) A"
    - Letter followed by arrow/colon: "A -> word", "A: word"
    - Lines with "Answer: A" or similar

    Returns a list of single capital letters.
    """
    letters: list[str] = []

    # Strategy 1: Lines that are just a single capital letter
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Remove common prefixes like "1.", "1)", "- "
        cleaned = re.sub(r"^\d+[\.\)]\s*", "", line)
        cleaned = re.sub(r"^[-*•]\s*", "", cleaned)
        cleaned = cleaned.strip()

        if len(cleaned) == 1 and cleaned.isalpha() and cleaned.isupper():
            letters.append(cleaned)
        elif re.match(r"^[A-Z]\s*[->:\|]", cleaned):
            # "A -> word" or "A: word"
            letters.append(cleaned[0])
        elif re.match(r"^\d+\s*[->:\|]\s*[A-Z]\b", cleaned):
            # "1 -> A" or "1: A"
            m = re.search(r"([A-Z])\b", cleaned[2:])
            if m:
                letters.append(m.group(1))

    # Strategy 2: If we didn't find enough, look for "Answer: X" patterns
    if n_expected and len(letters) < n_expected:
        for m in re.finditer(r"(?:answer|item)\s*\d*\s*[:=]\s*([A-Z])\b", text, re.IGNORECASE):
            letters.append(m.group(1))

    # Strategy 3: If still not enough, find all standalone capital letters
    # that appear at the start of lines (after stripping numbering)
    if n_expected and len(letters) < n_expected:
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            cleaned = re.sub(r"^\d+[\.\)]\s*", "", line).strip()
            if cleaned and cleaned[0].isupper() and cleaned[0].isalpha():
                # Check if it looks like a letter answer (not a sentence)
                if len(cleaned) <= 3 or cleaned[1:2] in (" ", "->", ":", "|"):
                    letters.append(cleaned[0])

    # Pad if needed
    if n_expected and len(letters) < n_expected:
        letters.extend(["A"] * (n_expected - len(letters)))

    # Trim if needed
    if n_expected and len(letters) > n_expected:
        letters = letters[:n_expected]

    return letters


def _looks_like_analysis(line: str) -> bool:
    """Check if a line looks like analysis prose rather than an answer."""
    analysis_patterns = (
        r"^(Analyze|Identify|Apply|Note|Pattern|Step|First|Second|"
        r"Third|Now|Then|Next|Look|Check|The\s|This\s|We\s|For\s|"
        r"Let|So|Therefore|Thus|Hence|Because|Since|If|When|Where|"
        r"Which|What|How|Why|Each|Every|Both|All|Some|Most|These|"
        r"Those|Here|There|Above|Below|Overall|Summary|Conclusion)"
    )
    return bool(re.match(analysis_patterns, line, re.IGNORECASE))


def _extract_letters(answers: list[str], n_expected: int) -> list[str]:
    """For match_letters: extract single capital letters from the output.

    The model might output "A", "1. A", "Item 1: A", or even entire
    paragraphs with scattered letters. We want just the letters A-Z.
    """
    letters = []
    for a in answers:
        # Try to find a standalone capital letter A-Z
        m = re.search(r"\b([A-Z])\b", a)
        if m:
            letters.append(m.group(1))
        elif len(a) == 1 and a.isalpha():
            letters.append(a.upper())
        elif len(a) == 2 and a[1].isalpha() and a[0].isdigit():
            # Like "1A" or "3D"
            letters.append(a[1].upper())
        else:
            # If it's a longer string, try to find letter patterns
            m = re.search(r"([A-Z])(?:\s*[->:\|]\s*|\s*$)", a)
            if m:
                letters.append(m.group(1))
            else:
                letters.append(a)  # keep as-is, may be wrong

    # If we got fewer letters than expected, pad with 'A'
    if n_expected and len(letters) < n_expected:
        letters.extend(["A"] * (n_expected - len(letters)))

    return letters


def _extract_numbers(answers: list[str], n_expected: int) -> list[str]:
    """For text_to_num: extract the numeral from the answer.

    The model might output "111", "The answer is 111", "111 (one hundred...)", etc.
    """
    numbers = []
    for a in answers:
        # Try to find a number (possibly with operators like +, ^, -, =)
        m = re.search(r"(\d+(?:\s*[-+^=]\s*\d+)*)", a)
        if m:
            numbers.append(m.group(1).replace(" ", ""))
        else:
            numbers.append(a)

    return numbers
