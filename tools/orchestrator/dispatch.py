"""Build an M3_EXECUTION_REQUEST.json from a work-package id and dispatch it.

Usage:
  python dispatch.py <work_package_id> [--goal "..."] [--dry-run]

Reads .orchestrator/contracts/WORK_PACKAGE_<id>.md to get the contract hash and
goal, builds the immutable request, writes it, and (unless --dry-run) runs the
adapter. The request is idempotency-keyed; re-running with the same key is a
no-op until the prior session's lock is released.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ORCH = REPO / ".orchestrator"


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def git(field: str) -> str:
    cmd = {"commit": ["rev-parse", "HEAD"], "tree": ["rev-parse", "HEAD^{tree}"],
           "branch": ["branch", "--show-current"]}[field]
    r = subprocess.run(["git"] + cmd, cwd=str(REPO), capture_output=True, text=True)
    return r.stdout.strip()


def find_contract(wp_id: str) -> Path:
    # WP ids like P00-T01 -> WORK_PACKAGE_P00-T01.md
    p = ORCH / "contracts" / f"WORK_PACKAGE_{wp_id}.md"
    if p.exists():
        return p
    # try with hyphens normalized
    cands = list((ORCH / "contracts").glob(f"WORK_PACKAGE_*{wp_id}*.md"))
    if cands:
        return cands[0]
    raise FileNotFoundError(f"no work package contract for {wp_id} in {ORCH/'contracts'}")


def build_request(wp_id: str, goal_override: str | None, version: int, dry_run: bool) -> Path:
    contract = find_contract(wp_id)
    contract_text = contract.read_text(encoding="utf-8")
    # extract phase contract hash + wp hash from the contract metadata
    import re
    pc_hash_m = re.search(r"Phase Contract Hash:\s*([0-9a-f]{64})", contract_text)
    wp_hash_m = re.search(r"WP Contract SHA-256:\s*([0-9a-f]{64})", contract_text)
    phase_m = re.search(r"Phase:\s*(PHASE-\d+)", contract_text)
    branch_m = re.search(r"Branch:\s*`?([^\s`]+)`?", contract_text)
    pc_hash = pc_hash_m.group(1) if pc_hash_m else "0" * 64
    wp_hash = wp_hash_m.group(1) if wp_hash_m else "0" * 64
    phase_id = phase_m.group(1) if phase_m else "PHASE-00"
    branch = branch_m.group(1) if branch_m else "main"

    # default goal: the "## Goal" section of the contract
    goal = goal_override
    if not goal:
        gm = re.search(r"## Goal\s*\n+(.*?)(?=\n## )", contract_text, re.S)
        goal = gm.group(1).strip() if gm else "Implement the work package per its contract."

    request = {
        "schema_version": "1.0",
        "request_id": f"REQ-{wp_id}-v{version}-{uuid.uuid4().hex[:8]}",
        "project_id": "riftwarden",
        "phase_id": phase_id,
        "work_package_id": wp_id,
        "work_package_version": version,
        "idempotency_key": f"rw-{wp_id.lower()}-v{version}-{uuid.uuid4().hex[:8]}",
        "phase_contract_hash": pc_hash,
        "work_package_contract_hash": wp_hash,
        "repository": {"root": str(REPO), "branch": git("branch"),
                       "commit": git("commit"), "tree_hash": git("tree")},
        "goal": goal + "\n\nFULL CONTRACT:\n" + contract_text,
        "contract_path": str(contract.relative_to(REPO)).replace("\\", "/"),
    }
    out_dir = ORCH / "contracts"
    out = out_dir / f"M3_EXECUTION_REQUEST_{wp_id}.json"
    out.write_text(json.dumps(request, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[dispatch] request -> {out}")
    print(f"[dispatch] wp={wp_id} phase={phase_id} branch={branch} goal_len={len(goal)}")
    if dry_run:
        print("[dispatch] --dry-run: not executing")
        return out
    # run the adapter
    r = subprocess.run([sys.executable, str(REPO / "tools/orchestrator/m3_adapter.py"),
                        "run", "--request", str(out)], cwd=str(REPO))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work_package_id", help="e.g. P00-T01")
    ap.add_argument("--goal", default=None, help="override the goal text")
    ap.add_argument("--version", type=int, default=1)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    build_request(args.work_package_id, args.goal, args.version, args.dry_run)


if __name__ == "__main__":
    main()
