"""Direct-only prompts (no CoT) for the IOL submission.

Use this variant when time is tight or CoT is failing. Direct prompts
are ~3x faster than CoT but produce lower exact match scores on hard tasks.

Trade-offs:
- Direct: 256 tokens, ~5-8s/problem, total ~22 min for 160 problems
- CoT: 512 tokens, ~17s/problem, total ~30 min for 160 problems

Use direct when:
- Total time budget is <25 min
- The model is reliably producing exact answers
- chrF score is the priority (fuzzy overlap)

Use CoT when:
- Total time budget is >30 min
- EM is critical (exact match matters)
- Problems require careful reasoning (translation, fill_blanks)
"""

import re
from prompts import (
    _PROMPTS,
    _DEFAULT_PROMPT,
    USER_TEMPLATE,
    parse_answers,
    extract_analysis,
    count_query_items,
    get_system_prompt,
)

# Direct mode uses simpler, more focused prompts without CoT instructions
_DIRECT_PROMPTS = {
    "translation": """\
You are an expert at solving International Linguistics Olympiad translation problems. \
You are given bilingual examples from an unfamiliar language. \
Deduce the vocabulary and grammar, then translate the numbered items.

Output ONLY the translation, one per line, in order. No numbering, no labels, no notes.
Preserve notation like You_{sg}, You_{pl} exactly as used in the examples.
Always give your best guess — never leave an item blank.""",

    "fill_blanks": """\
You are an expert at solving International Linguistics Olympiad fill-in-the-blank problems. \
You are given morphological or syntactic paradigms from an unfamiliar language. \
Deduce the pattern, then fill each blank.

Output ONLY the filled form, one per line, in order. No numbering, no labels, no notes.
Always give your best guess — never leave an item blank.""",

    "text_to_num": """\
You convert number words in an unfamiliar language to digits. \
Work out the base system from the examples, then convert.

Output ONLY the numeral in digits (e.g. 111), one per line, in order. No words, no explanation.
Always give your best guess — never leave an item blank.""",

    "num_to_text": """\
You convert digits to number words in an unfamiliar language. \
Work out the base system from the examples, then convert.

Output ONLY the number in the target language's words, one per line, in order.
Always give your best guess — never leave an item blank.""",

    "match_letters": """\
You match words to their translations in an unfamiliar language.

Output ONLY single capital letters (A, B, C, ...), one per line, in order.
Do NOT explain your reasoning. Output ONLY the letters.""",
}


def get_direct_system_prompt(task_type: str = "") -> str:
    """Get a direct (non-CoT) system prompt for the given task type."""
    if task_type and task_type in _DIRECT_PROMPTS:
        return _DIRECT_PROMPTS[task_type]
    return _DEFAULT_PROMPT


__all__ = [
    "USER_TEMPLATE",
    "parse_answers",
    "extract_analysis",
    "count_query_items",
    "get_direct_system_prompt",
    "get_system_prompt",
]
