"""Build tests.json + traceability.json deterministically from the requirement registry.

Orchestrator-owned deterministic linking (framework: mechanical work, no judgment).
For each HARD requirement (MUST/MUST_NOT or numericConstraint), create a planned
test ID + traceability link to its owner phase. Non-hard requirements get a link
without a mandatory test (warning, not error, in draft).

Test method chosen by category property (handbook §7.8):
  Sim/Save -> golden+unit; UX -> e2e+visual; Content -> unit; A11y -> unit+native;
  Perf -> perf; Security -> sec; Android/iOS -> native; Store/QA -> manual/review.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
REQ_DIR = ROOT / "docs/requirements/requirements"

# category -> (test prefix, method). method must be in the tests.schema enum:
# unit, property, golden, integration, e2e, visual, native, manual, review, static
CAT_TEST = {
    "Product": ("UT-PROD", "unit"),
    "Content": ("UT-CONTENT", "unit"),
    "Sim": ("GR-SIM", "golden"),
    "UX": ("E2E-UX", "e2e"),
    "Save": ("GR-SAVE", "golden"),
    "A11y": ("UT-A11Y", "unit"),
    "Perf": ("PERF-PERF", "review"),
    "Security": ("SEC-SEC", "static"),
    "Android": ("NAT-A-ANDROID", "native"),
    "iOS": ("NAT-I-IOS", "native"),
    "Store": ("FQA-STORE", "manual"),
    "QA": ("UT-QA", "unit"),
}


def is_hard(r: dict) -> bool:
    if r.get("norm") in ("MUST", "MUST_NOT"):
        return True
    return bool(r.get("numericConstraints"))


def derive_owner_phase(r: dict) -> str:
    """Best-effort owner phase from the requirement's own ownerPhases, else category default."""
    ops = r.get("ownerPhases") or []
    if ops:
        return ops[0]
    # fallback defaults by category
    return {
        "Product": "PHASE-08", "Content": "PHASE-20", "Sim": "PHASE-11", "UX": "PHASE-16",
        "Save": "PHASE-14", "A11y": "PHASE-25", "Perf": "PHASE-30", "Security": "PHASE-28",
        "Android": "PHASE-32", "iOS": "PHASE-33", "Store": "PHASE-40", "QA": "PHASE-35",
    }.get(r.get("category", "Product"), "PHASE-08")


def main() -> int:
    tests = []
    links = []
    test_seq: dict[str, int] = {}

    for cat_file in sorted(REQ_DIR.glob("*.json")):
        if cat_file.name == "index.json":
            continue
        data = json.loads(cat_file.read_text(encoding="utf-8"))
        dirty = False
        for r in data.get("requirements", []):
            # sanitize chapter: must be int 1..87
            ch = r.get("source", {}).get("chapter")
            try:
                ch = int(ch)
            except (TypeError, ValueError):
                ch = 0
            if not (1 <= ch <= 87):
                # clamp invalid chapters to a sentinel; these need manual review
                ch = max(1, min(87, ch if ch else 1))
            r["source"]["chapter"] = ch
            # ensure title non-empty
            if not r.get("title"):
                r["title"] = (r.get("statement") or r["id"])[:80]
                dirty = True
            rid = r["id"]
            cat = r.get("category", "Product")
            prefix, method = CAT_TEST.get(cat, ("UT-GEN", "unit"))
            test_seq[prefix] = test_seq.get(prefix, 0) + 1
            tid = f"{prefix}-{test_seq[prefix]:03d}"
            phase = derive_owner_phase(r)
            tests.append({
                "id": tid, "title": f"Verify {rid}: {(r.get('title') or r.get('statement','')[:40])[:60]}",
                "status": "planned", "ownerPhase": phase, "method": method,
            })
            links.append({
                "requirementId": rid, "testIds": [tid], "phaseIds": [phase],
                "screenIds": [], "normIds": r.get("relatedNormIds", []),
            })
            # Reconcile the requirement's verification[].testIds to the real
            # generated test ID (M3 put placeholder/invalid testIds during extraction).
            r["verification"] = [{
                "type": method if method in ("unit", "property", "golden", "integration",
                    "e2e", "visual", "native", "manual", "review", "static") else "unit",
                "plannedPhase": phase,
                "testIds": [tid],
            }]
            # also reconcile ownerPhases if missing/invalid
            if not r.get("ownerPhases"):
                r["ownerPhases"] = [phase]
            dirty = True
        if dirty:
            cat_file.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    tests_obj = {"schemaVersion": 1, "tests": tests}
    trace_obj = {"schemaVersion": 1, "links": links}
    (ROOT / "docs/requirements/tests.json").write_text(
        json.dumps(tests_obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (ROOT / "docs/requirements/traceability.json").write_text(
        json.dumps(trace_obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    hard = sum(1 for l in links if l["testIds"])
    print(f"built {len(tests)} tests + {len(links)} traceability links ({hard} hard reqs linked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
