"""Split the extracted GDD source-structure.json into per-chapter text files.

Deterministic prep step (orchestrator-owned): produces one small, focused text
file per chapter so M3 requirement-extraction sessions read a digestible slice
instead of a 1 MB JSON. Output: docs/requirements/generated/chapters/chapter-NN.txt
and a chapter-index JSON mapping chapter -> file + block range + heading title.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
STRUCT = ROOT / "docs/requirements/generated/source-structure.json"
OUT_DIR = ROOT / "docs/requirements/generated/chapters"
INDEX = ROOT / "docs/requirements/generated/chapter-index.json"


def main() -> int:
    s = json.loads(STRUCT.read_text(encoding="utf-8"))
    blocks = s.get("blocks", [])
    candidates = s.get("headingCandidates", [])

    # Build chapter -> (start_block, title) from accepted heading candidates.
    # Prefer confidence 'high'; fall back to any candidate for that chapter.
    by_chapter: dict[int, dict] = {}
    for c in candidates:
        ch = c.get("chapter")
        if ch is None:
            continue
        prev = by_chapter.get(ch)
        # keep highest-confidence candidate per chapter
        rank = {"high": 3, "medium": 2, "low": 1}.get(c.get("confidence", ""), 0)
        if prev is None or rank > prev.get("_rank", -1):
            c2 = dict(c); c2["_rank"] = rank
            by_chapter[ch] = c2

    chapters = sorted(by_chapter.items())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    index = {"schemaVersion": "1.0", "sourceId": "gdd-v5", "chapters": []}
    # chapter N text spans from its heading blockIndex to the next chapter's blockIndex
    for i, (ch, c) in enumerate(chapters):
        start = int(c.get("blockIndex", 0))
        end = int(chapters[i + 1][1].get("blockIndex", len(blocks))) if i + 1 < len(chapters) else len(blocks)
        title = c.get("title", f"Chapter {ch}")
        chunk = blocks[start:end]
        lines = [f"# Chapter {ch}: {title}", f"# blocks {start}..{end-1} ({len(chunk)} blocks)", ""]
        for b in chunk:
            t = b.get("type", "")
            text = (b.get("text") or "").strip()
            if not text:
                continue
            if t == "table_row" or "cell" in t:
                lines.append(f"| {text}")
            else:
                style = b.get("styleName") or b.get("styleId") or ""
                prefix = f"[{style}] " if style and style not in ("Normal",) else ""
                lines.append(prefix + text)
        out = OUT_DIR / f"chapter-{ch:02d}.txt"
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        index["chapters"].append({
            "chapter": ch, "title": title, "file": str(out.relative_to(ROOT)).replace("\\", "/"),
            "blockStart": start, "blockEnd": end, "blocks": len(chunk), "lines": len(lines),
            "headingConfidence": c.get("confidence"),
        })

    INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"split {len(chapters)} chapters -> {OUT_DIR}")
    total_lines = sum(c["lines"] for c in index["chapters"])
    print(f"total lines: {total_lines} | index: {INDEX.relative_to(ROOT)}")
    # report size distribution
    sizes = sorted((c["lines"] for c in index["chapters"]), reverse=True)
    print(f"largest chapter: {sizes[0]} lines | smallest: {sizes[-1]} | median: {sizes[len(sizes)//2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
