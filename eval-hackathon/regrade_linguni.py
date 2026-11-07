#!/usr/bin/env python3
"""Re-grade stored Linguini generations with an improved answer extractor.

run_linguni_eval.py scores with prompts.parse_answers, which misses answers
when frontier models don't emit the <answers> protocol — e.g. an
unterminated '<answers>' tag yields the literal string '<answers>' as the
prediction, and freeform finals ('810\\n88' at end of reasoning) are never
reached. This script recomputes em/chrf from stored `raw` + `gold` using:

  1. parse_answers (original path)
  2. lines after the last '<answers>' tag (terminated or not)
  3. last-n non-empty lines of the raw output (enumeration stripped)

plus unicode normalization (superscript digits -> ^n, fullwidth forms)
so '5² + 3' matches gold '5^2 + 3'.

Usage: python3 eval-hackathon/regrade_linguni.py [file ...]
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "eval-hackathon"))
sys.path.insert(0, str(ROOT / "scripts"))

from prompts import parse_answers  # noqa: E402
from run_linguni_eval import chrf, normalize  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"

SUPERSCRIPTS = {ord(d): f"^{i}" for i, d in enumerate("⁰¹²³⁴⁵⁶⁷⁸⁹")}
SUBSCRIPTS = {ord(d): f"_{i}" for i, d in enumerate("₀₁₂₃₄₅₆₇₈₉")}
BARE_TAG = re.compile(r"</?[a-zA-Z_]+>")
ENUM = re.compile(
    r"^\s*(?:(?:Final\s+)?[Aa]nswers?\s*[:：]\s*|"
    r"\(?\d{1,2}[\.)\:\-]|[\(（]\d{1,2}[\)）])\s*"
)


def norm_text(s: str) -> str:
    # superscripts first: NFKC would decompose '²' to '2' and lose '^2'
    s = s.translate(SUPERSCRIPTS).translate(SUBSCRIPTS)
    return unicodedata.normalize("NFKC", s)


def clean_lines(text: str) -> list[str]:
    out = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln or BARE_TAG.fullmatch(ln):
            continue
        out.append(ln)
    return out


def extract_answers(
    raw: str, n_expected: int, task_type: str, context: str
) -> list[str]:
    """Best-effort answer list, original parser first."""
    cands: list[str] = []

    if "<answers>" in raw:
        # lines after the last <answers> tag (works even unterminated)
        tail = raw.rsplit("<answers>", 1)[1]
        cands.extend(clean_lines(tail))
    else:
        # No answers tag: frontier models put final answers at the end of
        # freeform reasoning. Trailing lines are the most reliable source;
        # parse_answers' numbered-line strategy grabs 'Step 1:' headers.
        cands.extend(clean_lines(raw)[-n_expected:])

    parsed = parse_answers(
        raw, n_expected=n_expected, task_type=task_type, context=context
    )
    cands.extend(x for x in parsed if x and not BARE_TAG.fullmatch(x.strip()))
    # last resort: whole-output tail (covers tag-at-EOF cases)
    cands.extend(clean_lines(raw)[-n_expected:])

    # dedupe preserving order, strip enumeration
    seen, out = set(), []
    for c in cands:
        c = ENUM.sub("", c).strip()
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out[:n_expected] if n_expected else out


def em_for(pred: str, refs) -> float:
    n_pred = normalize(norm_text(pred))
    for r in refs:
        rr = r if isinstance(r, str) else str(r)
        if n_pred == normalize(norm_text(rr)):
            return 1.0
    return 0.0


def regrade_file(path: Path) -> None:
    recs = json.loads(path.read_text())
    if not isinstance(recs, list):
        return
    changed = 0
    for r in recs:
        if "raw" not in r or "gold" not in r or not r.get("raw"):
            continue
        gold = r["gold"]
        if isinstance(gold, str):
            import ast

            try:
                gold = ast.literal_eval(gold)
            except Exception:
                gold = [gold]
        n = len(gold) if isinstance(gold, list) else 1
        context = (r.get("context") or "") + "\n" + (r.get("query") or "")
        preds = extract_answers(r["raw"], n, r.get("task_type", ""), context)

        em_scores, chrf_scores = [], []
        for j, pred in enumerate(preds):
            if j >= len(gold):
                break
            ref = gold[j]
            refs = ref if isinstance(ref, list) else [ref]
            em_scores.append(em_for(pred, refs))
            chrf_scores.append(max(chrf(norm_text(pred), norm_text(x)) for x in refs))
        # keep list lengths aligned with gold like the runner does
        while len(em_scores) < len(gold):
            em_scores.append(0.0)
            chrf_scores.append(0.0)

        if preds != r.get("pred_answers") or em_scores != r.get("em"):
            changed += 1
        r["pred_answers"] = preds
        r["em"] = em_scores
        r["chrf"] = chrf_scores
    path.write_text(json.dumps(recs, indent=1, ensure_ascii=False))
    print(f"{path.name}: updated {changed}/{len(recs)}")


def main() -> None:
    files = [Path(a) for a in sys.argv[1:]] or sorted(RESULTS.glob("linguni_*.json"))
    for p in files:
        if p.exists():
            regrade_file(p)


if __name__ == "__main__":
    main()
