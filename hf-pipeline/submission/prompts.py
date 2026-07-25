"""
Shared prompt and answer-parsing logic for the IOL submission.

Imported by both script.py (competition harness, needs torch) and
test_local.py (local testing via Arkor API, no torch needed).
"""

import re

# --- Prompt engineering ---
# The key insight: IOL problems require step-by-step deduction from examples.
# We ask the model to reason inside <analysis> tags, then produce
# <answers> tags with one answer per numbered item, each on its own line.
# This separation lets us extract clean answers even if the reasoning is verbose.
SYSTEM_PROMPT = """\
You are an expert linguistic analyst competing in the International Linguistics Olympiad (IOL). \
You are given data from a language you have never seen, plus enough examples to deduce its rules. \
You must reason step by step from the examples, then give your final answers.

Rules:
- Work through the problem methodically: identify patterns, morphemes, number systems, \
or syntactic rules from the examples.
- Do NOT use outside knowledge. Everything you need is in the problem data.
- Answer EVERY numbered item in the query, in order.
- For match_letters/correspondence tasks, give one letter per item.
- For text_to_num, give the numeral (digits). For num_to_text, give the spelled-out form.
- Keep answers concise: a single word, number, or phrase per item.
- If you are unsure, give your best guess rather than leaving a blank.

Format your response as:
<analysis>
Your step-by-step reasoning here.
</analysis>
<answers>
answer to item 1
answer to item 2
...
</answers>
"""

USER_TEMPLATE = """\
{context}

{query}"""

# Simpler prompt without chain-of-thought. Better for models that waste
# tokens on analysis or don't follow the <answers> tag format.
SYSTEM_PROMPT_SIMPLE = """\
You solve International Linguistics Olympiad problems. You are given data \
from a language you have never seen, plus enough examples to deduce its rules. \
Answer every numbered item in the query. Put each answer on its own line, \
in order, with no numbering, no bullet points, and no extra text. \
If unsure, give your best guess."""


def count_query_items(query: str) -> int:
    """Estimate how many numbered items are in the query."""
    n = len(re.findall(r"^\s*\d+[\.\)]", query, re.MULTILINE))
    return n


def parse_answers(text: str, n_expected: int = 0) -> list[str]:
    """Extract answers from model output, handling <answers> tags or fallback.

    Tries in order:
    1. Content between <answers>...</answers> tags
    2. Numbered lines (1. foo, 2. bar) stripped of numbering, but only
       if they appear AFTER any <analysis> block
    3. All non-empty lines as a last resort (excluding analysis prose)
    """
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
            # Everything after the last </analysis> tag
            tail = post_analysis[-1].strip()
            if tail:
                answers = [ln.strip() for ln in tail.splitlines() if ln.strip()]

    # 3. If still no answers, try numbered lines from the whole text
    #    but only accept them if they look like actual answers (not analysis headers)
    if not answers:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        numbered = []
        for ln in lines:
            m = re.match(r"^\d+[\.\)]\s*(.+)", ln)
            if m:
                content = m.group(1).strip()
                # Skip lines that look like analysis steps
                if not re.match(
                    r"^(Analyze|Identify|Apply|Note|Pattern|Step|First|Second|"
                    r"Third|Now|Then|Next|Look|Check|The\s|This\s|We\s|For\s)",
                    content,
                    re.IGNORECASE,
                ):
                    numbered.append(content)
        if numbered:
            answers = numbered

    # 4. Last resort: use all non-empty lines, filtering out obvious analysis
    if not answers:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        # Filter out lines that are clearly analysis prose
        filtered = []
        for ln in lines:
            # Skip markdown headers, bullet points, analysis keywords
            if ln.startswith(("#", "- ", "* ", "**")):
                continue
            if re.match(
                r"^(Analyze|Identify|Apply|Note|Pattern|Step|First|Second|"
                r"Third|Now|Then|Next|Look|Check|The\s|This\s|We\s|For\s)",
                ln,
                re.IGNORECASE,
            ):
                continue
            filtered.append(ln)
        if filtered:
            answers = filtered

    # 5. Clean up: strip stray numbering, bullet points, extra whitespace
    cleaned = []
    for a in answers:
        a = re.sub(r"^\d+[\.\)]\s*", "", a)  # strip "1. " prefix
        a = a.strip("- *•\t ")
        # Strip markdown bold/italic markers
        a = re.sub(r"\*{1,2}(.+?)\*{1,2}", r"\1", a)
        if a:
            cleaned.append(a)

    # 6. Ensure we have at least one answer
    if not cleaned:
        cleaned = [""]

    # 7. If we know how many to expect and got too many, trim
    if n_expected and len(cleaned) > n_expected:
        cleaned = cleaned[:n_expected]

    return cleaned
