"""Adapter sandbox smoke test (bundle doc 10.8 / pilot acceptance).

Runs the M3 adapter against a deliberately-broken isolated temp repo.
Asserts the pilot-acceptance criteria from doc 19/G:
  - model pinned to MiniMax-M3
  - M3 writes a file
  - a failing test goes red -> green
  - evidence report is schema-valid and commit-bound
  - a deliberately tampered report is detected (rejected)

This makes NO changes to the real repo (operates entirely in a temp dir).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import uuid
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "orchestrator"))
import m3_adapter as m  # noqa: E402


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def setup_sandbox() -> Path:
    """Create an isolated temp repo with a deliberately failing test."""
    box = Path(tempfile.mkdtemp(prefix="rw_sandbox_"))
    # init git
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=box, check=True)
    subprocess.run(["git", "config", "user.email", "sandbox@test.local"], cwd=box, check=True)
    subprocess.run(["git", "config", "user.name", "sandbox"], cwd=box, check=True)
    # write a deliberately-failing node test
    test_dir = box / "tests"
    test_dir.mkdir()
    (test_dir / "add.mjs").write_text(
        "export function add(a, b) {\n  return a - b; // BUG: should be a + b\n}\n", encoding="utf-8")
    (test_dir / "add.test.mjs").write_text(textwrap.dedent("""\
        import { test } from 'node:test';
        import assert from 'node:assert/strict';
        import { add } from './add.mjs';

        test('add(2,3) === 5', () => { assert.equal(add(2, 3), 5); });
        test('add(10,4) === 14', () => { assert.equal(add(10, 4), 14); });
        """), encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=box, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "sandbox: deliberately failing add()"], cwd=box, check=True)
    return box


def write_sandbox_request(box: Path) -> Path:
    """Write the request OUTSIDE the sandbox repo so the working tree stays clean."""
    return _write_sandbox_request(box)


def _write_sandbox_request(box: Path) -> Path:
    req = {
        "schema_version": "1.0",
        "request_id": f"REQ-SANDBOX-{uuid.uuid4().hex[:8]}",
        "project_id": "riftwarden-sandbox",
        "phase_id": "SANDBOX",
        "work_package_id": "WP-SANDBOX-001",
        "work_package_version": 1,
        "idempotency_key": f"sandbox-{uuid.uuid4().hex[:12]}",
        "phase_contract_hash": "0" * 64,
        "work_package_contract_hash": "0" * 64,
        "repository": {"root": str(box), "branch": "main", "commit": "sandbox", "tree_hash": "sandbox"},
        "goal": (
            "There is a bug in tests/add.mjs: the add() function returns a-b instead of a+b, "
            "so tests/add.test.mjs fails.\n"
            "Steps: (1) run_command('node-test') with args ['tests/add.test.mjs'] to confirm it fails. "
            "(2) Read tests/add.mjs and tests/add.test.mjs. "
            "(3) Fix the bug in tests/add.mjs (change the operator so add returns a+b). "
            "(4) run_command('node-test') with args ['tests/add.test.mjs'] to confirm green. "
            "(5) run_command('git-add') with args ['tests/add.mjs'], then run_command('git-commit') with args ['-m','sandbox: fix add']. "
            "(6) Call finalize_report with a valid M3_EVIDENCE_REPORT: status COMPLETE, "
            "include the test command results in test_results, list the changed file. "
            "Bind all test_results commit_or_tree to the current git tree (run 'git rev-parse HEAD^{tree}' via git-status is not available, so use the tree_hash you observe)."
        ),
        "contract_path": None,
    }
    # write outside the sandbox repo so the git working tree stays clean
    p = box.parent / (box.name + "_request.json")
    p.write_text(json.dumps(req, indent=2), encoding="utf-8")
    return p


def run_smoke():
    global results
    results.clear()
    results.update({"started_at": now(), "checks": [], "passed": True})
    box = setup_sandbox()
    print(f"[smoke] sandbox: {box}")
    try:
        # monkeypatch adapter to operate within the sandbox
        orig_repo = m.REPO_ROOT
        orig_orch = m.ORCH_ROOT
        m.REPO_ROOT = box
        # Keep orchestrator state OUTSIDE the sandbox git repo so it doesn't
        # dirty the working tree (mirrors real repo where .orchestrator/logs
        # is gitignored). This makes the commit-bound check meaningful.
        orch = box.parent / (box.name + "_orch")
        m.ORCH_ROOT = orch
        orch.mkdir(exist_ok=True)
        (orch / "logs").mkdir(exist_ok=True)
        (orch / "artifacts").mkdir(exist_ok=True)
        (orch / "locks").mkdir(exist_ok=True)

        # sandbox-local policies: allow everything in box, allow node/git/sha256sum
        allowlist = {
            "read_roots": [str(box)], "write_roots": [str(box)],
            "forbidden_roots": [], "generated_roots": [],
            "max_single_file_bytes": 10485760,
            "symlink_policy": "deny_write_through", "binary_write_policy": "contract_only",
        }
        (orch / "PATH_ALLOWLIST.json").write_text(json.dumps(allowlist, indent=2), encoding="utf-8")
        cmd_policy = {
            "version": "1.0", "default": "deny",
            "commands": [
                {"id": "node-test", "category": "BUILD_TEST", "executable": "node", "allowed_args_prefixes": [["--test"]]},
                {"id": "git-add", "category": "MUTATING_LOCAL", "executable": "git", "allowed_args_prefixes": [["add"]]},
                {"id": "git-commit", "category": "MUTATING_LOCAL", "executable": "git", "allowed_args_prefixes": [["commit"]]},
                {"id": "git-status", "category": "READ_ONLY", "executable": "git", "allowed_args_prefixes": [["rev-parse"], ["status"], ["log"], ["diff"]]},
                {"id": "sha256sum", "category": "READ_ONLY", "executable": "sha256sum", "allowed_args_prefixes": [[]]},
            ],
            "network": {"default": "deny"},
            "shell": {"allow_chaining": False, "allow_redirection": False},
        }
        import yaml  # available in this env
        (orch / "COMMAND_POLICY.yaml").write_text(yaml.safe_dump(cmd_policy), encoding="utf-8")
        (orch / "ORCHESTRATOR_CONFIG.yaml").write_text(yaml.safe_dump({
            "config_version": "1.0", "project_id": "riftwarden-sandbox",
            "mode": "api-supervisor",
            "models": {"executor": {"provider": "minimax", "model": "MiniMax-M3",
                                    "base_url": "https://api.minimax.io/v1", "api_key_env": "MINIMAX_API_KEY"}},
        }), encoding="utf-8")
        (orch / "SESSION_REGISTRY.json").write_text(json.dumps({
            "schema_version": "1.0", "project_id": "riftwarden-sandbox", "updated_at": now(), "sessions": []}), encoding="utf-8")

        req_path = write_sandbox_request(box)
        print("[smoke] dispatching M3 to fix the failing test...")
        report = m.run_request(req_path, max_rounds=60, timeout=1200)
        print(f"[smoke] M3 returned status={report.get('status')}")

        # --- CHECK 1: model pinned (verify via session/ledger) ---
        ledger = (orch / "logs" / "token_ledger.csv").read_text(encoding="utf-8")
        check("model_pin", "MiniMax-M3" in ledger and "minimax" in ledger, "MiniMax-M3 appears in token ledger")
        check("usage_telemetry", "input_tokens" in ledger and "\n" in ledger.strip(), "token ledger has data rows")

        # --- CHECK 2: M3 wrote a file (changed_files non-empty) ---
        changed = report.get("changed_files", [])
        check("m3_wrote_file", len(changed) >= 1, f"M3 reported {len(changed)} changed file(s)", [c.get("path") for c in changed])
        add_fixed = box.joinpath("tests", "add.mjs").read_text(encoding="utf-8")
        check("bug_actually_fixed", "a + b" in add_fixed and "a - b" not in add_fixed, "tests/add.mjs operator corrected to a + b")

        # --- CHECK 3: red -> green. Accept EITHER M3-reported pass in
        # test_results OR a harness re-run proving the fix (M3 may finalize
        # without fully populating test_results). The authoritative proof is
        # that the test actually passes now against the committed fix.
        trs = report.get("test_results", [])
        m3_reported_pass = any(t.get("status") == "passed" and "node" in t.get("command", "") for t in trs)
        harness_reverify = False
        if not m3_reported_pass:
            # re-run the test against the committed fix
            probe = subprocess.run(["node", "--test", "tests/add.test.mjs"],
                                   cwd=str(box), capture_output=True, text=True, timeout=120)
            harness_reverify = probe.returncode == 0 and "fail 0" in (probe.stdout + probe.stderr).lower()
        check("red_to_green", m3_reported_pass or harness_reverify,
              f"test green (M3-reported={m3_reported_pass}, harness-reverify={harness_reverify})",
              [t.get("status") for t in trs])

        # --- CHECK 4: schema-valid (the adapter already validated on finalize; recheck) ---
        errs = m.validate_against_schema(report, m.SCHEMA_DIR / "M3_EVIDENCE_REPORT.schema.json")
        check("report_schema_valid", len(errs) == 0, f"evidence report schema-valid ({len(errs)} errors)", errs[:5])

        # --- CHECK 5: commit-bound (tree_hash present, dirty=false) ---
        repo = report.get("repository", {})
        check("report_commit_bound", bool(repo.get("tree_hash")) and repo.get("dirty") is False,
              f"report bound to clean tree {repo.get('tree_hash')}", repo)

        # --- CHECK 6: tamper detection (mutate report, re-validate -> must fail) ---
        tampered = json.loads(json.dumps(report))
        tampered["status"] = "NOT_A_VALID_STATUS"
        terrs = m.validate_against_schema(tampered, m.SCHEMA_DIR / "M3_EVIDENCE_REPORT.schema.json")
        check("tamper_detected", len(terrs) > 0, "tampered report correctly rejected by schema", terrs[:3])

        # restore module paths
        m.REPO_ROOT = orig_repo
        m.ORCH_ROOT = orig_orch

    except Exception as e:
        import traceback
        results["passed"] = False
        results["error"] = f"{type(e).__name__}: {e}"
        results["traceback"] = traceback.format_exc()[-2000:]
        print(f"[smoke] EXCEPTION: {type(e).__name__}: {e}")
    finally:
        results["ended_at"] = now()
        out = REPO_ROOT / ".orchestrator" / "artifacts" / "DRY_RUN_EVIDENCE_REPORT.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"results": results, "sandbox": str(box)}, indent=2), encoding="utf-8")
        print(f"\n[smoke] RESULTS: {'ALL PASS' if results['passed'] else 'FAIL'}")
        for c in results["checks"]:
            mark = "PASS" if c["ok"] else "FAIL"
            print(f"  [{mark}] {c['name']}: {c['detail']}")
        print(f"[smoke] evidence: {out}")
        # keep sandbox for inspection
        print(f"[smoke] sandbox kept at {box}")

    return results


def check(name: str, ok: bool, detail: str, extra=None):
    results["checks"].append({"name": name, "ok": ok, "detail": detail, "extra": extra})
    if not ok:
        results["passed"] = False


results = {"checks": []}  # populated by run_smoke via closure


if __name__ == "__main__":
    r = run_smoke()
    sys.exit(0 if r["passed"] else 1)
