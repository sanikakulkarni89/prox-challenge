#!/usr/bin/env python3
"""Render all PDF pages to PNG images for the manual page viewer.

Usage:
    pip install pymupdf
    python3 scripts/render-pages.py

Output: public/pages/{source}/page-{n:03d}.png (144 DPI, ~2x display resolution)
"""
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF not installed. Run: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

SOURCES = [
    ("owner-manual",      "files/owner-manual.pdf"),
    ("quick-start-guide", "files/quick-start-guide.pdf"),
    ("selection-chart",   "files/selection-chart.pdf"),
]

ROOT = Path(__file__).parent.parent

def render_source(source: str, rel_path: str) -> int:
    pdf_path = ROOT / rel_path
    if not pdf_path.exists():
        print(f"  SKIP {source}: {pdf_path} not found")
        return 0

    out_dir = ROOT / "public" / "pages" / source
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    rendered = 0
    for i, page in enumerate(doc):
        out_file = out_dir / f"page-{i + 1:03d}.png"
        if out_file.exists():
            continue
        mat = fitz.Matrix(2.0, 2.0)  # 144 DPI
        pix = page.get_pixmap(matrix=mat)
        pix.save(str(out_file))
        rendered += 1
    doc.close()

    total = len(list(out_dir.glob("page-*.png")))
    print(f"  {source}: {total} pages  ({rendered} new)")
    return total

if __name__ == "__main__":
    print("Rendering PDF pages...")
    total = 0
    for source, path in SOURCES:
        total += render_source(source, path)
    print(f"\nDone. {total} total page images in public/pages/")
    print("Add 'python3 scripts/render-pages.py' to your Vercel build command if needed.")
