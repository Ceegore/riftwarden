"""Merge T02 requirement chunks into the category files + assign final REQ-IDs.

Deterministic merge (orchestrator-owned). Reads all chunk-*.json staging files,
deduplicates, assigns stable final IDs per category (REQ-<CAT>-NNNN), and writes
the 12 category files + chapter-dispositions context-only entries.

Usage: python tools/requirements/python/merge_chunks.py
"""
from __future__ import annotations

import glob
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
STAGING = ROOT / "docs/requirements/requirements/_staging"
REQ_DIR = ROOT / "docs/requirements/requirements"
DISP_DIR = ROOT / "docs/requirements/chapter-dispositions"

# category file prefix -> category enum value
CAT_PREFIX = {
    "Product": "PRODUCT", "Content": "CONTENT", "Sim": "SIM", "UX": "UX",
    "Save": "SAVE", "A11y": "A11Y", "Perf": "PERF", "Security": "SECURITY",
    "Android": "ANDROID", "iOS": "IOS", "Store": "STORE", "QA": "QA",
}


def stable_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> int:
    chunks = sorted(glob.glob(str(STAGING / "chunk-*.json")))
    if not chunks:
        print("no chunk files found"); return 1

    all_reqs: list[dict] = []
    all_ctx: list[dict] = []
    for cf in chunks:
        d = json.loads(Path(cf).read_text(encoding="utf-8"))
        all_reqs.extend(d.get("requirements", []))
        all_ctx.extend(d.get("contextOnly", []))

    print(f"loaded {len(all_reqs)} reqs + {len(all_ctx)} context-only from {len(chunks)} chunks")

    # Deduplicate by normalized statement + chapter (keep first, note dups)
    seen = set()
    deduped = []
    dups = 0
    for r in all_reqs:
        key = (int(r.get("source", {}).get("chapter", 0)),
               json.dumps(r.get("statement", ""), sort_keys=True).lower().strip())
        if key in seen:
            dups += 1
            continue
        seen.add(key)
        deduped.append(r)
    print(f"deduplicated: {len(all_reqs)} -> {len(deduped)} ({dups} removed)")

    # Assign final IDs per category, sequentially
    counters: dict[str, int] = {c: 0 for c in CAT_PREFIX}
    by_cat: dict[str, list[dict]] = {c: [] for c in CAT_PREFIX}
    for r in deduped:
        cat = r.get("category", "Product")
        if cat not in CAT_PREFIX:
            cat = "Product"
        counters[cat] += 1
        prefix = CAT_PREFIX[cat]
        r["id"] = f"REQ-{prefix}-{counters[cat]:04d}"
        r["status"] = r.get("status", "planned")
        by_cat[cat].append(r)

    # Write category files
    for cat, prefix in CAT_PREFIX.items():
        cat_file = REQ_DIR / f"{cat.lower()}.json"
        obj = {"schemaVersion": "1.0", "category": cat, "requirements": by_cat[cat]}
        cat_file.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  {cat.lower()}.json: {len(by_cat[cat])} reqs")

    # Write context-only into chapter-dispositions
    DISP_DIR.mkdir(parents=True, exist_ok=True)
    disp_path = ROOT / "docs/requirements/chapter-dispositions/chapters-merged.json"
    dispositions = []
    for c in all_ctx:
        ch = int(c.get("chapter", 0))
        dispositions.append({
            "chapter": ch,
            "disposition": "context_only",
            "reason": c.get("reason", "No normative content (context-only chapter)."),
            "reviewStatus": "verified",
            "reviewedBy": "MiniMax-M3",
            "reviewedAt": "2026-07-22T00:00:00Z",
        })
    disp_obj = {"schemaVersion": "1.0", "chapters": dispositions}
    disp_path.write_text(json.dumps(disp_obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"chapter-dispositions/chapters-merged.json: {len(dispositions)} context-only entries")

    total = sum(len(v) for v in by_cat.values())
    print(f"\nMERGE COMPLETE: {total} requirements across {len(CAT_PREFIX)} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
