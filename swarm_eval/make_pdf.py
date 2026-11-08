#!/usr/bin/env python3
"""Render swarm_eval/REPORT.md to a print-ready PDF via headless Chrome.

Usage: python3 swarm_eval/make_pdf.py [--md swarm_eval/REPORT.md] [--out report.pdf]
"""

import argparse
import html
import re
import subprocess
import tempfile
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: Letter; margin: 0.75in; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt;
       line-height: 1.45; color: #111; max-width: 100%; }
h1 { font-size: 17pt; margin: 0 0 2pt; }
h2 { font-size: 12.5pt; margin: 14pt 0 5pt; border-bottom: 1px solid #ccc;
     padding-bottom: 2pt; }
h3 { font-size: 11pt; margin: 10pt 0 4pt; }
p { margin: 5pt 0; text-align: justify; }
ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }
li { margin: 2pt 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0;
        font-size: 9.5pt; }
th, td { border: 1px solid #999; padding: 3pt 6pt; text-align: left; }
th { background: #f0f0f0; }
code { font-family: Menlo, monospace; font-size: 9pt; }
img { max-width: 100%; display: block; margin: 10pt auto; }
.subtitle { color: #444; font-size: 11pt; margin-bottom: 10pt; }
"""


def md_to_html(md_text: str, base: Path) -> str:
    body = markdown.markdown(
        md_text, extensions=["tables", "fenced_code", "sane_lists"]
    )

    # resolve relative image paths against the markdown file's directory —
    # the HTML itself is rendered from a temp file
    def abs_src(m):
        src = m.group(1)
        if src.startswith(("http", "data:", "/")):
            return m.group(0)
        return f'src="{(base / src).resolve().as_uri()}"'

    body = re.sub(r'src="([^"#]+)"', abs_src, body)
    # strip the leading h1 — we render our own title block
    body = re.sub(r"^<h1>.*?</h1>", "", body, count=1, flags=re.S)
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>{CSS}</style></head><body>{body}</body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", type=Path, default=ROOT / "swarm_eval/REPORT.md")
    ap.add_argument("--out", type=Path, default=ROOT / "swarm_eval/report.pdf")
    args = ap.parse_args()

    md_text = args.md.read_text()
    # split off title lines for a proper title block
    lines = md_text.splitlines()
    title = lines[0].lstrip("# ").strip() if lines else "Report"
    rest = "\n".join(lines[1:])
    html_doc = md_to_html(rest, args.md.parent)
    html_doc = html_doc.replace(
        "<body>",
        f"<body><h1>{html.escape(title)}</h1>",
        1,
    )

    with tempfile.NamedTemporaryFile(
        "w", suffix=".html", delete=False, encoding="utf-8"
    ) as f:
        f.write(html_doc)
        html_path = f.name

    args.out.parent.mkdir(exist_ok=True)
    subprocess.run(
        [
            CHROME,
            "--headless",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={args.out}",
            html_path,
        ],
        check=True,
        capture_output=True,
    )
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
