#!/usr/bin/env python3
"""Find possible unresolved markers in extracted DOCX structure.

Every finding starts as 'open'. A human/agent must classify it as resolved or
false_positive with a concrete rationale. The tool never silently waives findings.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

PATTERNS = {
    "TODO": re.compile(r"\bTODO\b", re.I),
    "TBD": re.compile(r"\bTBD\b", re.I),
    "FIXME": re.compile(r"\bFIXME\b", re.I),
    "HACK": re.compile(r"\bHACK\b", re.I),
    "PUBLISHER_PLACEHOLDER": re.compile(r"\[PUBLISHER(?:_[A-Z0-9_]+)?\]", re.I),
    "EXAMPLE_INVALID": re.compile(r"\bexample\.invalid\b", re.I),
    "OPEN_DECISION_DE": re.compile(r"\b(?:noch\s+festzulegen|offene\s+entscheidung|ungeklärt|ausstehend)\b", re.I),
}


def snippets(block: dict) -> list[tuple[str, str]]:
    if block.get("type") == "paragraph":
        return [("text", str(block.get("text", "")))]
    if block.get("type") == "table":
        result = []
        for row_index, row in enumerate(block.get("rows", [])):
            for cell_index, cell in enumerate(row):
                result.append((f"row:{row_index}/cell:{cell_index}", str(cell)))
        return result
    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("structure", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    structure = json.loads(args.structure.read_text(encoding="utf-8"))
    findings = []
    counter = 1
    for block in structure.get("blocks", []):
        for sub_locator, text in snippets(block):
            for marker, pattern in PATTERNS.items():
                for match in pattern.finditer(text):
                    excerpt = text[max(0, match.start() - 80): min(len(text), match.end() + 80)]
                    fingerprint = hashlib.sha256(
                        f"{block.get('blockIndex')}|{sub_locator}|{marker}|{excerpt}".encode("utf-8")
                    ).hexdigest()
                    findings.append({
                        "id": f"SOURCE-FINDING-{counter:04d}",
                        "marker": marker,
                        "locator": f"block:{block.get('blockIndex')}/{sub_locator}",
                        "excerpt": excerpt,
                        "fingerprint": f"sha256:{fingerprint}",
                        "status": "open",
                        "classification": None,
                        "rationale": None,
                        "reviewedBy": None,
                        "reviewedAt": None,
                    })
                    counter += 1
    payload = {
        "schemaVersion": 1,
        "sourceSha256": structure.get("source", {}).get("sha256"),
        "findings": findings,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.out} with {len(findings)} open findings.")


if __name__ == "__main__":
    main()
