# Environment & Adapter Capability Report

**Project:** riftwarden
**Date:** 2026-07-22
**Bundle:** GLM52_M3_ORCHESTRATION_PACKAGE v1.0.0 (BUNDLE VALID)

## Environment

| Item | Value |
|---|---|
| OS | Windows 10.0.26200 x64 |
| Shell | Git Bash |
| Host tool | ZCode (GLM-5.2 coding agent) |
| Repository | C:/Projects/_sortiert/Riftwarden (git, branch main) |
| Node | v25.8.0 |
| Python | 3.12.10 |
| Git | 2.53.0.windows.1 |
| requests lib | 2.32.5 (available) |

## GLM-5.2 Access

| Capability | Status | Evidence |
|---|---|---|
| Access type | Coding-plan agent (this session) | ZCode host |
| Model identifier | builtin:zai-coding-plan/GLM-5.2 | session |
| Model pinning | n/a (this *is* GLM) | — |
| Structured output | yes (via tool calls) | — |
| Tool calls | yes (Agent, Bash, Edit, etc.) | — |
| Thinking mode | host-managed | — |
| Usage telemetry | not exposed to caller | declared limitation |

**Result: PASS** (GLM is the orchestrator of record; not invoked per-toolstep by design.)

## MiniMax M3 Access

| Capability | Status | Evidence |
|---|---|---|
| Access type | API (OpenAI-compatible) | live ping returned HTTP 200 |
| Endpoint | https://api.minimax.io/v1/chat/completions | verified |
| Model id | MiniMax-M3 | returned in usage; pinned by adapter per-call |
| Model pinning | **proven** | every request sets model="MiniMax-M3"; ledger shows it |
| Tool calls | **proven** | finish_reason=tool_calls roundtrip succeeded |
| Thinking mode | controllable | `thinking:{type:"disabled"}` works (and default adaptive works) |
| Usage telemetry | **proven** | prompt/completion/total + cached_tokens returned, metered to token_ledger.csv |
| Cache telemetry | **proven** | prompt_tokens_details.cached_tokens present |
| Structured final report | **proven** | finalize_report schema-validated (0 errors on valid report) |
| Timeout / kill | adapter kills on package timeout + round ceiling | verified |
| Resume / recovery | idempotency-key claim; crash leaves lock for next start | implemented |
| Auth (401/403) | no auto-retry | policy 07.2 |

**Result: PASS**

## Integration Mode Tests

| Mode | Tested | Model pinning | Write isolation | Report | Cancel | Recovery | Usage | Result |
|---|---|---|---|---|---|---|---|---|
| native-subagent | yes | **FAIL** — Agent tool spawns ZCode instances, cannot pin MiniMax | n/a | n/a | n/a | n/a | REJECTED |
| api-supervisor | yes | PASS | PASS (path allowlist) | PASS (schema) | PASS | PASS | PASS | **SELECTED** |
| mailbox | available as fallback | n/a | n/a | n/a | n/a | n/a | n/a | held in reserve |

## Sandbox Task (pilot acceptance, doc 10.8)

Planted a deliberately-failing `node --test` (add() returned a-b); dispatched M3 to find, fix, commit, report.

| Criterion | Result | Evidence |
|---|---|---|
| Model pinned to MiniMax-M3 | PASS | token_ledger rows show MiniMax-M3 |
| M3 writes a file | PASS | tests/add.mjs modified |
| Red → green | PASS | harness re-run after fix: pass 2, fail 0 |
| Test evidence | PASS | commands show node-test exit 1 → exit 0 |
| Schema-valid report | PASS | 0 schema errors on valid report |
| Commit binding | PASS* | tree_hash/end_commit bound by adapter |
| Tampered report detected | PASS | mutated status → schema rejects |
| Crash recovery | PASS | killed + restarted cleanly; orphan process cleaned |
| Token ledger | PASS | per-call metering recorded |
| No out-of-allowlist changes | PASS | path policy enforced; .git/.orchestration_source forbidden |
| Secret redaction | PASS | redact_bytes scans write content; secret write blocked |

\* Commit-binding is clean when M3 commits (observed in run 1); when M3 finalizes without
committing, the adapter still binds the live tree (dirty=true), which is correct behavior.
The fix itself is always genuinely applied (harness re-verifies green).

### Iterative fixes the sandbox surfaced (exactly its purpose)
1. Schema-validation on finalize now returns **field-specific repair guidance** (not an opaque error) → M3 self-repairs reports.
2. Command-policy prefix matching now **tolerates both M3 arg conventions** (with/without prefix) and split git-add/git-commit ids.
3. **Finalization nudge** injected when rounds run low → prevents M3 exploring to exhaustion.
4. Sandbox harness keeps `.orchestrator` state **outside** the sandbox repo (mirrors real-repo gitignore).

## Selected Mode
**Integration Mode B — API-to-API Supervisor.** Adapter: `tools/orchestrator/m3_adapter.py`.

## Rejected Modes & Reasons
- **Native subagent (A):** the `Agent` tool spawns ZCode/GLM instances, not MiniMax M3; model pinning is impossible.
- **CLI-broker (C):** no standalone MiniMax coding CLI with reliable headless/machine-readable mode; API is strictly better here.
- **Mailbox (D):** held as documented fallback (`allow_mailbox_mode: true`); not needed since API mode passes all criteria.

## Limitations
- GLM usage telemetry is not exposed to the adapter (GLM runs in the host, not via adapter). GLM token share is managed by working at semantic gates only.
- M3 occasionally does not self-finalize within the round budget; mitigated by the finalization nudge and supervisor-synthesized report (always yields structured output).
- `additionalProperties:false` on M3 reports requires strict schema conformance; the adapter's field-specific repair guidance resolves this within the retry budget.

## Required Fallback
Mailbox mode is configured and ready (`.orchestrator/mailbox/`, `ORCHESTRATOR_CONFIG.yaml.fallback`) but not currently required.

## Final Readiness
**READY_WITH_DECLARED_LIMITATIONS**
- Limitation 1 (project, not adapter): publisher confirmation missing → G00 cannot PASS (proceed draft-only).
- Limitation 2 (environment): GLM usage telemetry not observable by the adapter.
