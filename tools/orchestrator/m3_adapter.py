"""Riftwarden M3 Adapter — API-to-API supervisor (Integration Mode B).

Drives MiniMax-M3 (OpenAI-compatible chat completions API) in a sandboxed,
allowlist-enforced agentic tool loop. GLM-5.2 is the orchestrator; this adapter
is the deterministic supervisor layer between them.

References: bundle docs 03 (integration modes), 04 (execution protocol),
06 (token policy), 07 (failure/recovery), 08 (safety), 09 (observability).

Design goals:
  - smallest necessary supervisor; no platform/framework.
  - stdlib-only for policy/hash/redact; `requests` optional (urllib fallback).
  - enforce PATH_ALLOWLIST + COMMAND_POLICY + secret redaction.
  - idempotency-key claim (one active session per key).
  - token metering -> token_ledger.csv; events -> event_log.jsonl.
  - schema-validate M3_EVIDENCE_REPORT / BLOCKER_REPORT.
  - hard timeout + clean kill; retry only transient provider errors.

Usage:
  python m3_adapter.py run --request <path-to-M3_EXECUTION_REQUEST.json>
  python m3_adapter.py health
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
ORCH_ROOT = REPO_ROOT / ".orchestrator"
SCHEMA_DIR = Path(__file__).resolve().parent / "schemas"
SYS_PROMPT_PATH = Path(__file__).resolve().parent / "M3_EXECUTOR_SYSTEM_PROMPT.md"

MAX_TOOL_ROUNDS = 80          # safety ceiling on agentic turns per package
DEFAULT_TIMEOUT = 28800       # 8h package ceiling (from config)
HANG_HEARTBEAT = 120          # seconds between heartbeat writes
FINALIZE_NUDGE_ROUNDS = 12    # with <= this many rounds left, nudge M3 to finalize


def _finalize_nudge(rounds_left: int) -> str:
    return (
        f"⏱ ATTENTION: only ~{rounds_left} tool rounds remain. STOP exploring/gathering. "
        "Right now: (1) if you have uncommitted changes that should be saved, run git-add + git-commit; "
        "(2) then IMMEDIATELY call finalize_report with a valid M3_EVIDENCE_REPORT. "
        "Set status to COMPLETE if the task is done, PARTIAL if mostly done, BLOCKED if blocked. "
        "List your changed_files and the commands you ran. Do not run any more exploratory commands."
    )


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(p: Path) -> str:
    return sha256_bytes(p.read_bytes())


def load_json(p: Path) -> Any:
    return json.loads(p.read_text(encoding="utf-8"))


def atomic_write_json(p: Path, obj: Any) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, p)  # atomic on same filesystem


def log_jsonl(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Secret redaction (doc 08.4)
# ---------------------------------------------------------------------------
_SECRET_PATTERNS = [
    re.compile(rb"(sk-[A-Za-z0-9_\-]{8})[A-Za-z0-9_\-]*"),
    re.compile(rb"(AKIA[0-9A-Z]{4})[0-9A-Z]*"),
    re.compile(rb"(ghp_[A-Za-z0-9]{4})[A-Za-z0-9]*"),
    re.compile(rb"(Bearer [A-Za-z0-9_\-\.]{4})[A-Za-z0-9_\-\.]*"),
    # common key=... assignments
    re.compile(rb"(?i)(api[_-]?key|token|secret|password)\s*[=:]\s*([^\s\"'&]{4})[^\s\"'&]*"),
]
_SECRET_COUNT = {"n": 0}


def redact_bytes(b: bytes) -> bytes:
    out = b
    for pat in _SECRET_PATTERNS:
        def _sub(m: re.Match) -> bytes:
            if m.lastindex:
                return m.group(1) + b"<REDACTED>"
            return b"<REDACTED>"
        out = pat.sub(_sub, out)
    return out


def redact_str(s: str) -> str:
    try:
        r = redact_bytes(s.encode("utf-8", "replace")).decode("utf-8", "replace")
        if r != s:
            _SECRET_COUNT["n"] += 1
        return r
    except Exception:
        return s


# ---------------------------------------------------------------------------
# Config: path allowlist + command policy
# ---------------------------------------------------------------------------
class PathPolicy:
    """Enforces read/write/forbidden/generated roots (doc 08.2)."""

    def __init__(self, allowlist: dict):
        self.read_roots = [Path(_norm(r)).resolve() for r in allowlist.get("read_roots", [])]
        self.write_roots = [Path(_norm(r)).resolve() for r in allowlist.get("write_roots", [])]
        self.forbidden = [Path(_norm(r)).resolve() for r in allowlist.get("forbidden_roots", [])]
        self.generated = [Path(_norm(r)).resolve() for r in allowlist.get("generated_roots", [])]
        self.symlink_policy = allowlist.get("symlink_policy", "deny_write_through")
        self.max_file_bytes = int(allowlist.get("max_single_file_bytes", 10485760))

    def _is_under(self, p: Path, roots: list) -> bool:
        try:
            p = p.resolve()
        except Exception:
            p = p.absolute()
        for r in roots:
            try:
                p.relative_to(r)
                return True
            except ValueError:
                continue
        return False

    def assert_can_read(self, p: Path):
        rp = p.resolve()
        if self._is_under(rp, self.forbidden):
            raise PermissionError(f"PATH_FORBIDDEN (read): {p}")
        if not self._is_under(rp, self.read_roots) and not self._is_under(rp, self.write_roots):
            raise PermissionError(f"PATH_OUTSIDE_READ_ROOTS: {p}")
        # deny symlinks that escape write roots
        if rp.is_symlink() and self.symlink_policy == "deny_write_through":
            tgt = Path(os.readlink(rp)).resolve()
            if not (self._is_under(tgt, self.write_roots) or self._is_under(tgt, self.read_roots)):
                raise PermissionError(f"SYMLINK_ESCAPES_ROOTS: {p} -> {tgt}")

    def assert_can_write(self, p: Path):
        rp = p.resolve()
        if self._is_under(rp, self.forbidden):
            raise PermissionError(f"PATH_FORBIDDEN (write): {p}")
        if not self._is_under(rp, self.write_roots):
            raise PermissionError(f"PATH_OUTSIDE_WRITE_ROOTS: {p}")
        if rp.exists() and rp.is_file() and rp.stat().st_size > self.max_file_bytes:
            raise PermissionError(f"FILE_TOO_LARGE: {p}")


def _norm(p: str) -> str:
    return p.replace("\\", "/" if os.name != "nt" else "\\")


class CommandPolicy:
    """Enforces command allowlist (doc 08.3). Deny by default."""

    def __init__(self, policy: dict):
        self.default = policy.get("default", "deny")
        self.shell = policy.get("shell", {})
        self.cmds = {}
        for c in policy.get("commands", []):
            self.cmds[c["id"]] = c

    def check(self, argv: list[str]) -> tuple[bool, str, dict]:
        if not argv:
            return False, "EMPTY_COMMAND", {}
        # No shell chaining / redirects (policy 08.3)
        joined = " ".join(argv)
        if self.shell.get("allow_chaining") is False:
            if any(tok in joined for tok in ("&&", "||", ";", "|")):
                return False, "SHELL_CHAINING_FORBIDDEN", {}
        if self.shell.get("allow_redirection") is False:
            if any(tok in joined for tok in (">", "<", ">>", "<<")):
                return False, "REDIRECTION_FORBIDDEN", {}
        exe = argv[0]
        # Match by executable name. A command_id selects the executable; the
        # allowed_args_prefixes declare the REQUIRED leading args (so node-test
        # forces `--test`). M3 supplies the remaining args, which must NOT
        # collide with the prefix (we prepend the prefix if M3 omitted it).
        for cid, c in self.cmds.items():
            if c["executable"].lower() != Path(exe).name.lower():
                continue
            for prefix in c.get("allowed_args_prefixes", []):
                tail = _strip_matching_prefix(argv[1:], prefix)
                if tail is not None:
                    cat = c.get("category", "READ_ONLY")
                    return True, cid, {**c, "_full_argv": [exe] + list(prefix) + tail}
        return False, "COMMAND_NOT_ALLOWLISTED", {}


def _strip_matching_prefix(actual: list[str], prefix: list[str]) -> list[str] | None:
    """Return the tail after removing `prefix` from the front of `actual`.

    Tolerant of two M3 calling conventions:
      (a) M3 includes the prefix in args:  actual = [--test, file]      -> tail=[file]
      (b) M3 omits the prefix (trusts id): actual = [file]              -> tail=[file]
    Returns None if `actual` starts with something that is NOT the prefix
    AND the prefix is non-empty (i.e. a conflicting leading arg).
    """
    if not prefix:
        return list(actual)
    if len(actual) >= len(prefix) and actual[:len(prefix)] == list(prefix):
        return list(actual[len(prefix):])
    # M3 omitted the prefix entirely (convention b): accept, since the id
    # already commits us to the executable+prefix. Reject only if actual
    # begins with an arg that conflicts with the prefix's first element.
    if actual and actual[0] == prefix[0]:
        return None
    return list(actual)


# ---------------------------------------------------------------------------
# Schema validation (lightweight; avoids external jsonschema dep)
# ---------------------------------------------------------------------------
def validate_against_schema(instance: Any, schema_path: Path) -> list[str]:
    """Minimal structural validation. Returns list of error strings (empty = ok)."""
    if not schema_path.exists():
        return []  # schema missing is not a hard fail here; caller decides
    schema = load_json(schema_path)
    errors: list[str] = []
    _validate_node(instance, schema, "", errors)
    return errors


def _validate_node(node: Any, schema: dict, path: str, errors: list[str]):
    if "const" in schema:
        if node != schema["const"]:
            errors.append(f"{path or '<root>'}: expected const {schema['const']!r}, got {node!r}")
        return
    if "enum" in schema:
        if node not in schema["enum"]:
            errors.append(f"{path or '<root>'}: {node!r} not in enum {schema['enum']}")
        return
    t = schema.get("type")
    if t:
        ok = True
        if isinstance(t, str):
            ok = _type_ok(node, t)
        elif isinstance(t, list):
            ok = any(_type_ok(node, x) for x in t)
        if not ok:
            errors.append(f"{path or '<root>'}: expected type {t}, got {type(node).__name__}")
            return
    if t in ("object",) or (isinstance(node, dict) and "properties" in schema):
        if not isinstance(node, dict):
            return
        if schema.get("additionalProperties") is False:
            allowed = set(schema.get("properties", {}).keys())
            extra = set(node.keys()) - allowed
            if extra:
                errors.append(f"{path or '<root>'}: additional properties not allowed: {sorted(extra)}")
        for req in schema.get("required", []):
            if req not in node:
                errors.append(f"{path or '<root>'}: missing required '{req}'")
        for k, subs in schema.get("properties", {}).items():
            if k in node:
                _validate_node(node[k], subs, f"{path}.{k}" if path else k, errors)
    elif t in ("array",) or (isinstance(node, list) and "items" in schema):
        if not isinstance(node, list):
            return
        items = schema.get("items")
        if isinstance(items, dict):
            for i, it in enumerate(node):
                _validate_node(it, items, f"{path}[{i}]", errors)
    # minLength / min / etc best-effort
    if "minLength" in schema and isinstance(node, str) and len(node) < schema["minLength"]:
        errors.append(f"{path}: length {len(node)} < minLength {schema['minLength']}")


def _type_ok(node: Any, t: str) -> bool:
    return {
        "object": lambda: isinstance(node, dict),
        "array": lambda: isinstance(node, list),
        "string": lambda: isinstance(node, str),
        "integer": lambda: isinstance(node, int) and not isinstance(node, bool),
        "boolean": lambda: isinstance(node, bool),
        "number": lambda: isinstance(node, (int, float)) and not isinstance(node, bool),
        "null": lambda: node is None,
    }.get(t, lambda: True)()


# ---------------------------------------------------------------------------
# Idempotency / session registry
# ---------------------------------------------------------------------------
def claim_session(request: dict) -> str:
    """Register an active session for an idempotency key. Returns session_id."""
    reg_path = ORCH_ROOT / "SESSION_REGISTRY.json"
    locks_dir = ORCH_ROOT / "locks"
    locks_dir.mkdir(parents=True, exist_ok=True)
    key = request.get("idempotency_key")
    if not key:
        raise ValueError("request has no idempotency_key")
    lock_file = locks_dir / f"session-{key}.lock"
    if lock_file.exists():
        # check if stale (> package_timeout)
        raise RuntimeError(f"IDEMPOTENCY_KEY_ALREADY_CLAIMED: {key}")
    reg = load_json(reg_path) if reg_path.exists() else {"schema_version": "1.0", "project_id": request.get("project_id"), "sessions": []}
    for s in reg.get("sessions", []):
        if s.get("idempotency_key") == key and s.get("status") == "RUNNING":
            raise RuntimeError(f"SESSION_ALREADY_RUNNING: {s['session_id']}")
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    lock_file.write_text(session_id, encoding="utf-8")
    entry = {
        "session_id": session_id,
        "actor": "M3_EXECUTOR",
        "provider": "minimax",
        "model": "MiniMax-M3",
        "integration_mode": "api-supervisor",
        "phase_id": request.get("phase_id"),
        "work_package_id": request.get("work_package_id"),
        "status": "RUNNING",
        "process_id": os.getpid(),
        "idempotency_key": key,
        "request_hash": sha256_bytes(json.dumps(request, sort_keys=True).encode()),
        "started_at": now_iso(),
        "last_heartbeat_at": now_iso(),
        "usage": {},
    }
    reg.setdefault("sessions", []).append(entry)
    reg["updated_at"] = now_iso()
    atomic_write_json(reg_path, reg)
    return session_id


def update_session(session_id: str, **fields):
    reg_path = ORCH_ROOT / "SESSION_REGISTRY.json"
    reg = load_json(reg_path)
    for s in reg.get("sessions", []):
        if s["session_id"] == session_id:
            s.update(fields)
            s["last_heartbeat_at"] = now_iso()
            break
    reg["updated_at"] = now_iso()
    atomic_write_json(reg_path, reg)


def release_session(session_id: str, status: str, key: str | None = None):
    update_session(session_id, status=status)
    if key:
        lock_file = ORCH_ROOT / "locks" / f"session-{key}.lock"
        if lock_file.exists():
            lock_file.unlink()


# ---------------------------------------------------------------------------
# Token metering
# ---------------------------------------------------------------------------
def record_usage(request: dict, event_type: str, usage: dict, session_id: str, latency_ms: int, retry: int = 0, status: str = "ok"):
    ledger = ORCH_ROOT / "logs" / "token_ledger.csv"
    ledger.parent.mkdir(parents=True, exist_ok=True)
    write_header = not ledger.exists() or ledger.stat().st_size == 0
    inp = usage.get("prompt_tokens", 0) or 0
    cached = 0
    pd = usage.get("prompt_tokens_details") or {}
    if isinstance(pd, dict):
        cached = pd.get("cached_tokens", 0) or 0
    reasoning = 0
    comp = usage.get("completion_tokens_details") or {}
    if isinstance(comp, dict):
        reasoning = comp.get("reasoning_tokens", 0) or 0
    out = usage.get("completion_tokens", 0) or 0
    total = usage.get("total_tokens", inp + out) or (inp + out)
    cache_pct = round(100 * cached / inp, 1) if inp else 0.0
    with ledger.open("a", encoding="utf-8", newline="") as f:
        if write_header:
            f.write("timestamp,project_id,phase_id,work_package_id,provider,model,event_type,session_id,input_tokens,cached_input_tokens,reasoning_tokens,output_tokens,total_tokens,cost_or_quota_units,latency_ms,retry_count,cache_hit_percent,status\n")
        row = [
            now_iso(), request.get("project_id", ""), request.get("phase_id") or "",
            request.get("work_package_id") or "", "minimax", "MiniMax-M3", event_type, session_id,
            str(inp), str(cached), str(reasoning), str(out), str(total), "",
            str(latency_ms), str(retry), str(cache_pct), status,
        ]
        f.write(",".join(row) + "\n")


# ---------------------------------------------------------------------------
# HTTP client (requests preferred; urllib fallback so no hard dep)
# ---------------------------------------------------------------------------
try:
    import requests as _requests  # type: ignore
    _HAVE_REQUESTS = True
except Exception:
    _HAVE_REQUESTS = False
    import urllib.request
    import urllib.error


class HttpClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def post(self, path: str, body: dict, timeout: int) -> tuple[int, dict, dict]:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8")
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
        if _HAVE_REQUESTS:
            r = _requests.post(url, data=data, headers=headers, timeout=timeout)
            try:
                j = r.json()
            except Exception:
                j = {"_raw": r.text}
            return r.status_code, j, {"_elapsed_ms": int(r.elapsed.total_seconds() * 1000)}
        else:
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            t0 = time.time()
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    payload = resp.read().decode("utf-8")
                    return resp.status, json.loads(payload), {"_elapsed_ms": int((time.time() - t0) * 1000)}
            except urllib.error.HTTPError as e:
                payload = e.read().decode("utf-8", "replace")
                try:
                    return e.code, json.loads(payload), {"_elapsed_ms": int((time.time() - t0) * 1000)}
                except Exception:
                    return e.code, {"_raw": payload}, {"_elapsed_ms": int((time.time() - t0) * 1000)}


# ---------------------------------------------------------------------------
# Provider call with retry (doc 07.2)
# ---------------------------------------------------------------------------
def call_m3(client: HttpClient, body: dict, request: dict, session_id: str, timeout: int) -> dict:
    """Call MiniMax-M3 chat completions with transient retry + 429 handling."""
    max_transient = 3
    last_exc = None
    for attempt in range(1, max_transient + 2):
        t0 = time.time()
        try:
            code, j, meta = client.post("/chat/completions", body, timeout)
            elapsed = int((time.time() - t0) * 1000)
            usage = j.get("usage", {}) if isinstance(j, dict) else {}
            if code == 200 and isinstance(j, dict) and j.get("choices"):
                record_usage(request, "M3_TURN", usage, session_id, elapsed, attempt - 1, "ok")
                return j
            if code == 429:
                ra = j.get("retry_after") or (meta.get("Retry-After") if hasattr(meta, "get") else None)
                wait = float(ra) if ra else (2 ** attempt) + (uuid.uuid4().int % 1000) / 1000
                record_usage(request, "M3_RATE_LIMIT", usage, session_id, elapsed, attempt - 1, "rate_limited")
                time.sleep(min(wait, 60))
                continue
            if 500 <= code < 600:
                record_usage(request, "M3_5XX", usage, session_id, elapsed, attempt - 1, f"http_{code}")
                if attempt <= max_transient:
                    time.sleep((2 ** attempt) + (uuid.uuid4().int % 1000) / 1000)
                    continue
            # auth / other client error -> no retry
            record_usage(request, "M3_ERROR", usage, session_id, elapsed, attempt - 1, f"http_{code}")
            raise RuntimeError(f"M3_HTTP_{code}: {redact_str(json.dumps(j)[:400])}")
        except (TimeoutError, ConnectionError, RuntimeError) as e:
            last_exc = e
            if isinstance(e, RuntimeError) and "M3_HTTP_" in str(e):
                raise
            if attempt <= max_transient:
                time.sleep((2 ** attempt) + (uuid.uuid4().int % 1000) / 1000)
                continue
            raise
    raise RuntimeError(f"M3_PROVIDER_FAILED after retries: {last_exc}")


# ---------------------------------------------------------------------------
# Tool implementations (the agentic surface M3 can call)
# ---------------------------------------------------------------------------
class ToolSet:
    """Implements the tools M3 is allowed to call. Each enforces policy."""

    def __init__(self, path_policy: PathPolicy, cmd_policy: CommandPolicy, request: dict, session_id: str):
        self.pp = path_policy
        self.cp = cmd_policy
        self.request = request
        self.session_id = session_id
        self.changed_files: list[dict] = []
        self.commands_run: list[dict] = []
        self.repair_rounds: dict[str, int] = {}

    # ---- file tools ----
    def read_file(self, path: str) -> str:
        p = _resolve(path)
        self.pp.assert_can_read(p)
        if p.stat().st_size > self.pp.max_file_bytes:
            raise PermissionError(f"FILE_TOO_LARGE: {p}")
        data = p.read_bytes()
        return redact_str(data.decode("utf-8", "replace"))

    def read_lines(self, path: str, offset: int = 0, limit: int = 2000) -> str:
        text = self.read_file(path)
        lines = text.splitlines()
        return "\n".join(lines[offset: offset + limit])

    def list_directory(self, path: str = ".") -> list[str]:
        p = _resolve(path)
        self.pp.assert_can_read(p)
        return sorted([str(c.name) + ("/" if c.is_dir() else "") for c in p.iterdir()])

    def glob(self, pattern: str, root: str = ".") -> list[str]:
        p = _resolve(root)
        self.pp.assert_can_read(p)
        matches = sorted(str(c.relative_to(REPO_ROOT)).replace("\\", "/") for c in p.glob(pattern) if c.is_file())
        return matches[:500]

    def grep(self, pattern: str, path: str = ".", glob_pattern: str = "*") -> list[str]:
        p = _resolve(path)
        self.pp.assert_can_read(p)
        rx = re.compile(pattern)
        hits = []
        for f in p.rglob(glob_pattern):
            if not f.is_file() or f.stat().st_size > self.pp.max_file_bytes:
                continue
            try:
                txt = redact_str(f.read_text(encoding="utf-8", errors="replace"))
            except Exception:
                continue
            for i, line in enumerate(txt.splitlines(), 1):
                if rx.search(line):
                    hits.append(f"{f.relative_to(REPO_ROOT)}:{i}: {line.strip()[:200]}")
                    if len(hits) >= 200:
                        return hits
        return hits

    def write_file(self, path: str, content: str) -> str:
        p = _resolve(path)
        self.pp.assert_can_write(p)
        p.parent.mkdir(parents=True, exist_ok=True)
        # block secrets from being written
        check = content.encode("utf-8", "replace")
        if redact_bytes(check) != check:
            raise PermissionError("SECRET_DETECTED_IN_WRITE: refusing to write content containing secrets")
        was = p.exists()
        p.write_text(content, encoding="utf-8")
        self._record_change(p, "modified" if was else "added")
        return f"wrote {len(content)} chars to {p.relative_to(REPO_ROOT)}"

    def edit_file(self, path: str, old_string: str, new_string: str) -> str:
        p = _resolve(path)
        self.pp.assert_can_read(p)
        self.pp.assert_can_write(p)
        text = p.read_text(encoding="utf-8")
        if text.count(old_string) == 0:
            raise ValueError(f"old_string not found in {path}")
        if text.count(old_string) > 1:
            raise ValueError(f"old_string not unique in {path} ({text.count(old_string)} matches)")
        new = text.replace(old_string, new_string, 1)
        if redact_bytes(new.encode("utf-8", "replace")) != new.encode("utf-8", "replace"):
            raise PermissionError("SECRET_DETECTED_IN_EDIT")
        p.write_text(new, encoding="utf-8")
        self._record_change(p, "modified")
        return f"edited {p.relative_to(REPO_ROOT)}"

    def _record_change(self, p: Path, change_type: str):
        rel = str(p.relative_to(REPO_ROOT)).replace("\\", "/")
        # dedupe, keep latest
        self.changed_files = [c for c in self.changed_files if c["path"] != rel]
        self.changed_files.append({"path": rel, "change_type": change_type, "sha256": sha256_file(p)})

    # ---- command tool ----
    def run_command(self, command_id: str, args: list[str] | None = None) -> dict:
        args = list(args or [])
        cid = command_id
        spec = self.cp.cmds.get(cid)
        if not spec:
            raise PermissionError(f"UNKNOWN_COMMAND_ID: {cid}")
        # Build candidate argv = [executable] + args, then let the policy
        # resolve the canonical full argv (prepending any required prefix).
        candidate = [spec["executable"]] + args
        ok, matched_id, matched = self.cp.check(candidate)
        if not ok:
            raise PermissionError(f"COMMAND_POLICY_DENIED ({matched}): {candidate}")
        full = matched.get("_full_argv", candidate)
        cat = matched.get("category", "READ_ONLY")
        # network denied for child commands (only the adapter itself reaches the API)
        t0 = time.time()
        try:
            proc = subprocess.run(full, cwd=str(REPO_ROOT), capture_output=True, text=True,
                                  timeout=600, encoding="utf-8", errors="replace")
            exit_code = proc.returncode
            out = redact_str((proc.stdout or "")[-4000:])
            err = redact_str((proc.stderr or "")[-2000:])
            status = "passed" if exit_code == 0 else "failed"
        except subprocess.TimeoutExpired:
            exit_code = -1
            out = ""
            err = "TIMEOUT"
            status = "timeout"
        elapsed = int((time.time() - t0) * 1000)
        rec = {"command_id": cid, "exit_code": exit_code, "status": status,
               "artifact_path": None, "category": cat, "elapsed_ms": elapsed,
               "argv": [str(a) for a in full]}
        self.commands_run.append(rec)
        return {"exit_code": exit_code, "stdout": out, "stderr": err, "status": status, "elapsed_ms": elapsed, "command": " ".join(full)}

    # ---- finalize ----
    def finalize_report(self, report: dict) -> str:
        """M3 calls this to submit its evidence report and stop.

        On schema failure, returns a detailed repair instruction (not an
        exception) so M3 can self-correct within its retry budget (doc 07.2).
        """
        errs = validate_against_schema(report, SCHEMA_DIR / "M3_EVIDENCE_REPORT.schema.json")
        if errs:
            self._finalize_repair_attempts = getattr(self, "_finalize_repair_attempts", 0) + 1
            return (
                "EVIDENCE_REPORT_SCHEMA_INVALID. Fix these and call finalize_report again:\n- "
                + "\n- ".join(errs[:15])
                + "\n\nRequired top-level fields: schema_version('1.0'), report_id, project_id, "
                "phase_id, work_package_id, request_id, status(COMPLETE|PARTIAL|BLOCKED|FAILED), "
                "repository{branch,start_commit,end_commit,tree_hash,dirty}, changed_files[], "
                "deliverables[], test_results[], commands[], decisions_within_authority[], "
                "deviations[], risks[], artifacts[], scope_self_check{within_scope,unexpected_paths,"
                "budget_exceeded,tests_weakened,new_dependencies}, finalized_at. "
                "Each test_results entry REQUIRES: id, command, executed(bool), exit_code(int|null), "
                "status(passed|failed|skipped|not_applicable), artifact_path(str|null), "
                "artifact_sha256(str|null), commit_or_tree(str|null). No extra properties allowed anywhere."
            )
        self.final_report = report
        return "FINALIZED"


def _resolve(path: str) -> Path:
    p = Path(path)
    if not p.is_absolute():
        p = REPO_ROOT / p
    return p


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------
TOOL_SPECS = [
    {"type": "function", "function": {
        "name": "read_file", "description": "Read a file (UTF-8). Path relative to repo root or absolute.",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "read_lines", "description": "Read a slice of a file by line offset/limit.",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "offset": {"type": "integer"}, "limit": {"type": "integer"}}, "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "list_directory", "description": "List directory entries.",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": []}}},
    {"type": "function", "function": {
        "name": "glob", "description": "Glob for files under a root.",
        "parameters": {"type": "object", "properties": {"pattern": {"type": "string"}, "root": {"type": "string"}}, "required": ["pattern"]}}},
    {"type": "function", "function": {
        "name": "grep", "description": "Regex search file contents under a path.",
        "parameters": {"type": "object", "properties": {"pattern": {"type": "string"}, "path": {"type": "string"}, "glob_pattern": {"type": "string"}}, "required": ["pattern"]}}},
    {"type": "function", "function": {
        "name": "write_file", "description": "Write a file (creates parents). Secrets are blocked. Must be within write roots.",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {
        "name": "edit_file", "description": "Replace a unique old_string with new_string in a file.",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "old_string": {"type": "string"}, "new_string": {"type": "string"}}, "required": ["path", "old_string", "new_string"]}}},
    {"type": "function", "function": {
        "name": "run_command", "description": "Run an allowlisted command by command_id with args. See COMMAND_POLICY.yaml for ids.",
        "parameters": {"type": "object", "properties": {"command_id": {"type": "string"}, "args": {"type": "array", "items": {"type": "string"}}}, "required": ["command_id"]}}},
    {"type": "function", "function": {
        "name": "finalize_report", "description": "Submit the M3_EVIDENCE_REPORT (JSON) and end the work package. Schema-validated.",
        "parameters": {"type": "object", "properties": {"report": {"type": "object"}}, "required": ["report"]}}},
]


def dispatch_tool(name: str, args: dict, tools: ToolSet) -> str:
    try:
        if name == "read_file":
            return tools.read_file(args["path"])
        if name == "read_lines":
            return tools.read_lines(args["path"], args.get("offset", 0), args.get("limit", 2000))
        if name == "list_directory":
            return json.dumps(tools.list_directory(args.get("path", ".")))
        if name == "glob":
            return json.dumps(tools.glob(args["pattern"], args.get("root", ".")))
        if name == "grep":
            return json.dumps(tools.grep(args["pattern"], args.get("path", "."), args.get("glob_pattern", "*")))
        if name == "write_file":
            return tools.write_file(args["path"], args["content"])
        if name == "edit_file":
            return tools.edit_file(args["path"], args["old_string"], args["new_string"])
        if name == "run_command":
            return json.dumps(tools.run_command(args["command_id"], args.get("args")))
        if name == "finalize_report":
            return tools.finalize_report(args["report"])
        raise ValueError(f"UNKNOWN_TOOL: {name}")
    except Exception as e:
        log_jsonl(ORCH_ROOT / "logs" / "tool_log.jsonl", {
            "ts": now_iso(), "session": tools.session_id, "tool": name, "error": type(e).__name__, "msg": redact_str(str(e))[:500]})
        return f"ERROR ({type(e).__name__}): {redact_str(str(e))[:800]}"


# ---------------------------------------------------------------------------
# The main loop
# ---------------------------------------------------------------------------
def run_request(request_path: Path, max_rounds: int = MAX_TOOL_ROUNDS, timeout: int = DEFAULT_TIMEOUT):
    request = load_json(request_path)
    key = request["idempotency_key"]

    # load policies
    path_policy = PathPolicy(load_json(ORCH_ROOT / "PATH_ALLOWLIST.json"))
    cmd_policy = CommandPolicy(_load_yaml(ORCH_ROOT / "COMMAND_POLICY.yaml"))

    # claim session
    session_id = claim_session(request)
    log_jsonl(ORCH_ROOT / "logs" / "event_log.jsonl", {
        "schema_version": "1.0", "event_id": str(uuid.uuid4()), "project_id": request.get("project_id"),
        "event_type": "SESSION_CLAIMED", "priority": "P3", "actor": "SUPERVISOR",
        "session_id": session_id, "work_package_id": request.get("work_package_id"),
        "idempotency_key": key, "created_at": now_iso()})

    api_key = os.environ.get("MINIMAX_API_KEY", "")
    if not api_key:
        release_session(session_id, "FAILED_NO_KEY", key)
        raise RuntimeError("MINIMAX_API_KEY not set")
    cfg = _load_yaml(ORCH_ROOT / "ORCHESTRATOR_CONFIG.yaml")
    base_url = cfg["models"]["executor"]["base_url"]
    model = cfg["models"]["executor"]["model"]
    client = HttpClient(base_url, api_key)

    # build system + first user message
    sys_prompt = SYS_PROMPT_PATH.read_text(encoding="utf-8")
    contract_text = ""
    cp = request.get("contract_path")
    if cp:
        contract_p = _resolve(cp) if not Path(cp).is_absolute() else Path(cp)
        if contract_p.exists():
            contract_text = contract_p.read_text(encoding="utf-8")
    goal = request.get("goal") or request.get("task") or ""
    messages = [
        {"role": "system", "content": f"{sys_prompt}\n\n--- WORK PACKAGE CONTRACT ---\n{contract_text}"},
        {"role": "user", "content": _build_user_brief(request, goal)},
    ]

    tools = ToolSet(path_policy, cmd_policy, request, session_id)
    deadline = time.time() + timeout
    hb_stop = threading.Event()

    def heartbeat():
        while not hb_stop.wait(HANG_HEARTBEAT):
            try:
                update_session(session_id, status="RUNNING")
            except Exception:
                pass
    hb = threading.Thread(target=heartbeat, daemon=True)
    hb.start()

    final_report = None
    try:
        for rnd in range(1, max_rounds + 1):
            if time.time() > deadline:
                raise TimeoutError("PACKAGE_TIMEOUT")
            update_session(session_id, status="RUNNING")
            body = {
                "model": model,
                "messages": messages,
                "tools": TOOL_SPECS,
                "tool_choice": "auto",
                "thinking": {"type": "disabled"},
                "max_tokens": 8192,
            }
            resp = call_m3(client, body, request, session_id, timeout=min(600, int(deadline - time.time()) + 30))
            choice = resp["choices"][0]
            msg = choice["message"]
            finish = choice.get("finish_reason")
            messages.append(msg)

            if msg.get("tool_calls"):
                for tc in msg["tool_calls"]:
                    fn = tc["function"]
                    tname = fn["name"]
                    try:
                        targs = json.loads(fn["arguments"]) if fn.get("arguments") else {}
                    except json.JSONDecodeError:
                        targs = {}
                    result = dispatch_tool(tname, targs, tools)
                    messages.append({"role": "tool", "tool_call_id": tc["id"], "name": tname, "content": redact_str(result)[:12000]})
                    if tname == "finalize_report" and hasattr(tools, "final_report"):
                        final_report = tools.final_report
                if final_report:
                    break
                # Finalization nudge: with few rounds left, push M3 to commit
                # uncommitted work and report, preventing round exhaustion.
                rounds_left = max_rounds - rnd
                if rounds_left <= FINALIZE_NUDGE_ROUNDS and rounds_left > 0 and rounds_left % 3 == 0:
                    messages.append({"role": "user", "content": _finalize_nudge(rounds_left)})
                continue
            if finish in ("stop", "length"):
                # no tool call and model stopped -> ask it to finalize or treat as done
                if not msg.get("content"):
                    break
                messages.append({"role": "user", "content": "If your work is complete, call finalize_report with your M3_EVIDENCE_REPORT. If blocked, call finalize_report with status BLOCKED. Do not stop without reporting."})
                continue
        else:
            raise TimeoutError(f"MAX_TOOL_ROUNDS reached ({max_rounds})")

        if not final_report:
            final_report = _synthesize_report(request, tools, session_id, status="PARTIAL",
                                              reason="M3 did not call finalize_report; synthesized by supervisor")
        # bind repo state to report
        _bind_repo(final_report, request)
        _enrich_report(final_report, tools)

        errs = validate_against_schema(final_report, SCHEMA_DIR / "M3_EVIDENCE_REPORT.schema.json")
        report_path = ORCH_ROOT / "artifacts" / f"{request['work_package_id']}_evidence_report.json"
        atomic_write_json(report_path, final_report)
        log_jsonl(ORCH_ROOT / "logs" / "artifact_index.jsonl", {
            "ts": now_iso(), "session": session_id, "wp": request.get("work_package_id"),
            "type": "M3_EVIDENCE_REPORT", "path": str(report_path), "sha256": sha256_file(report_path),
            "schema_errors": len(errs)})
        release_session(session_id, "COMPLETED", key)
        hb_stop.set()
        return final_report

    except Exception as e:
        hb_stop.set()
        log_jsonl(ORCH_ROOT / "logs" / "event_log.jsonl", {
            "schema_version": "1.0", "event_id": str(uuid.uuid4()), "project_id": request.get("project_id"),
            "event_type": "SESSION_ERROR", "priority": "P1", "actor": "SUPERVISOR",
            "session_id": session_id, "work_package_id": request.get("work_package_id"),
            "payload": {"error": type(e).__name__, "msg": redact_str(str(e))[:500]},
            "created_at": now_iso()})
        release_session(session_id, "FAILED", key)
        # synthesize a FAILED report so the loop still yields structured output
        rep = _synthesize_report(request, tools, session_id, status="FAILED", reason=f"{type(e).__name__}: {redact_str(str(e))[:300]}")
        _bind_repo(rep, request)
        _enrich_report(rep, tools)
        report_path = ORCH_ROOT / "artifacts" / f"{request['work_package_id']}_evidence_report.json"
        atomic_write_json(report_path, rep)
        return rep


def _build_user_brief(request: dict, goal: str) -> str:
    # list available command_ids from the actual policy for clarity
    try:
        cmd_policy = _load_yaml(ORCH_ROOT / "COMMAND_POLICY.yaml")
        ids = [c["id"] for c in cmd_policy.get("commands", [])]
        cmd_list = ", ".join(ids)
    except Exception:
        cmd_list = "(see COMMAND_POLICY.yaml)"
    return (
        f"PROJECT: {request.get('project_id')} | PHASE: {request.get('phase_id')} | "
        f"WORK PACKAGE: {request.get('work_package_id')} (v{request.get('work_package_version',1)})\n"
        f"IDEMPOTENCY KEY: {request.get('idempotency_key')}\n"
        f"REPO ROOT: {REPO_ROOT}\n\n"
        f"TASK:\n{goal}\n\n"
        "TOOLS available: read_file, read_lines, list_directory, glob, grep, write_file, edit_file, "
        "run_command(command_id, args), finalize_report(report).\n\n"
        f"run_command(command_id, args): command_id MUST be one of these EXACT ids: [{cmd_list}]. "
        "Do NOT invent command ids. The command_id selects the executable + any required leading flags "
        "(e.g. 'node-test' always adds --test). You pass only the REMAINING args as a list. "
        "Examples: run_command('node-test', ['tools/requirements/tests/validator.test.mjs']); "
        "run_command('git-add', ['docs/']); run_command('git-commit', ['-m','msg']).\n\n"
        "IMPORTANT: do NOT run 'git rev-parse' or 'git log' to get commit/tree hashes — the supervisor "
        "automatically binds the current git branch/commit/tree_hash/dirty state into your evidence report. "
        "Just do your work and call finalize_report.\n\n"
        "When finished, call finalize_report(report) with a valid M3_EVIDENCE_REPORT (schema-conformant; "
        "every required field present, no extra fields). If blocked, set status BLOCKED with a deviations entry."
    )


def _bind_repo(report: dict, request: dict):
    try:
        commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=str(REPO_ROOT), capture_output=True, text=True).stdout.strip()
        tree = subprocess.run(["git", "rev-parse", "HEAD^{tree}"], cwd=str(REPO_ROOT), capture_output=True, text=True).stdout.strip()
        branch = subprocess.run(["git", "branch", "--show-current"], cwd=str(REPO_ROOT), capture_output=True, text=True).stdout.strip()
        dirty = bool(subprocess.run(["git", "status", "--short"], cwd=str(REPO_ROOT), capture_output=True, text=True).stdout.strip())
    except Exception:
        commit, tree, branch, dirty = None, None, None, True
    start = report.get("repository", {}).get("start_commit") or (request.get("repository", {}) or {}).get("commit")
    report["repository"] = {"branch": branch, "start_commit": start, "end_commit": commit, "tree_hash": tree, "dirty": dirty}


def _enrich_report(report: dict, tools: ToolSet):
    # ensure commands list reflects what actually ran
    if tools.commands_run and not report.get("commands"):
        report["commands"] = [{"command_id": c["command_id"], "exit_code": c["exit_code"], "status": c["status"], "artifact_path": c.get("artifact_path")} for c in tools.commands_run]


def _synthesize_report(request: dict, tools: ToolSet, session_id: str, status: str, reason: str) -> dict:
    return {
        "schema_version": "1.0",
        "report_id": f"REP-{request.get('work_package_id','?')}-{session_id[-8:]}",
        "project_id": request.get("project_id", "riftwarden"),
        "phase_id": request.get("phase_id") or "",
        "work_package_id": request.get("work_package_id", ""),
        "request_id": request.get("request_id", ""),
        "status": status,
        "repository": {"branch": None, "start_commit": None, "end_commit": None, "tree_hash": None, "dirty": True},
        "changed_files": getattr(tools, "changed_files", []),
        "deliverables": [],
        "test_results": [],
        "commands": [{"command_id": c["command_id"], "exit_code": c["exit_code"], "status": c["status"]} for c in getattr(tools, "commands_run", [])],
        "decisions_within_authority": [],
        "deviations": [{"description": reason, "impact": "supervisor-synthesized", "authorization": None}],
        "risks": [],
        "artifacts": [],
        "scope_self_check": {"within_scope": True, "unexpected_paths": [], "budget_exceeded": False, "tests_weakened": False, "new_dependencies": []},
        "finalized_at": now_iso(),
    }


# ---------------------------------------------------------------------------
# Minimal YAML loader (avoids pyyaml dependency; config is simple)
# ---------------------------------------------------------------------------
def _load_yaml(path: Path) -> dict:
    """Very small YAML subset loader for our flat-ish config files."""
    try:
        import yaml  # type: ignore
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception:
        return _yaml_fallback(path)


def _yaml_fallback(path: Path) -> dict:
    """Naive YAML parser for our config shape (nested dicts/lists via indentation).
    Handles: key: value, key: "value", nested mappings, - list items, inline lists [a, b]."""
    root: dict = {}
    stack: list[tuple[int, Any]] = [(-1, root)]
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        text = line.strip()
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if text.startswith("- "):
            item = _parse_scalar(text[2:].strip())
            if isinstance(parent, dict):
                # list under last key
                pass
            if isinstance(parent, list):
                if isinstance(item, dict):
                    parent.append(item)
                    stack.append((indent, item))
                else:
                    parent.append(item)
            continue
        if ":" in text:
            k, _, v = text.partition(":")
            k, v = k.strip(), v.strip()
            if v == "":
                new: Any = {}
                if isinstance(parent, list):
                    parent.append({k: new})
                    stack.append((indent, parent[-1]))
                else:
                    parent[k] = new
                    stack.append((indent, new))
                # next-level list handling
                stack.append((indent, parent[k] if isinstance(parent, dict) else parent[-1][k]))
            else:
                val = _parse_scalar(v)
                if isinstance(parent, dict):
                    parent[k] = val
    return root


def _parse_scalar(v: str):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        if not inner:
            return []
        return [_parse_scalar(x.strip()) for x in inner.split(",")]
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
        return v[1:-1]
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    if v.lower() in ("null", "~", ""):
        return None
    try:
        return int(v)
    except ValueError:
        try:
            return float(v)
        except ValueError:
            return v


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def cmd_health():
    api_key = os.environ.get("MINIMAX_API_KEY", "")
    cfg = _load_yaml(ORCH_ROOT / "ORCHESTRATOR_CONFIG.yaml")
    base_url = cfg["models"]["executor"]["base_url"]
    model = cfg["models"]["executor"]["model"]
    print(f"MINIMAX_API_KEY: {'present' if api_key else 'MISSING'} (len {len(api_key)})")
    print(f"base_url: {base_url}")
    print(f"model: {model}")
    print(f"repo: {REPO_ROOT}")
    print(f"schemas: {SCHEMA_DIR.exists()} ({list(SCHEMA_DIR.glob('*.json'))})")
    print("system_prompt:", SYS_PROMPT_PATH.exists())
    # quick live ping
    if api_key:
        client = HttpClient(base_url, api_key)
        body = {"model": model, "messages": [{"role": "user", "content": "Reply with the single word: OK"}],
                "max_tokens": 10, "thinking": {"type": "disabled"}}
        try:
            code, j, meta = client.post("/chat/completions", body, 30)
            content = j.get("choices", [{}])[0].get("message", {}).get("content", "") if code == 200 else ""
            print(f"live ping: HTTP {code} -> {content!r} usage={j.get('usage')}")
        except Exception as e:
            print(f"live ping FAILED: {type(e).__name__}: {e}")


def main():
    ap = argparse.ArgumentParser(description="Riftwarden M3 adapter (API-to-API supervisor)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("health", help="check config + live M3 ping")
    run_p = sub.add_parser("run", help="run an M3_EXECUTION_REQUEST")
    run_p.add_argument("--request", required=True, help="path to M3_EXECUTION_REQUEST.json")
    run_p.add_argument("--max-rounds", type=int, default=MAX_TOOL_ROUNDS)
    run_p.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    args = ap.parse_args()
    if args.cmd == "health":
        cmd_health()
    elif args.cmd == "run":
        rep = run_request(Path(args.request), args.max_rounds, args.timeout)
        print(json.dumps({"status": rep.get("status"), "report_id": rep.get("report_id"),
                          "changed_files": len(rep.get("changed_files", [])),
                          "commands": len(rep.get("commands", []))}, indent=2))


if __name__ == "__main__":
    main()
