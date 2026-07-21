# Selected Integration Mode

**Decision:** Integration Mode B — API-to-API Supervisor
**Date:** 2026-07-22
**Decision owner:** GLM_ORCHESTRATOR

## Rationale

The framework's mode-selection test (doc 03.6) requires testing modes in order and
choosing only one whose model-pinning, file access, structured report, timeout,
cancel, recovery, and usage/status output are *practically proven*, not assumed.

1. **Native subagent (A) — REJECTED.** The host `Agent` tool spawns ZCode/GLM
   instances, not MiniMax M3. Model pinning to MiniMax-M3 is impossible. This was
   verified by inspecting the tool semantics, not assumed.

2. **API-to-API supervisor (B) — SELECTED.** MiniMax M3 exposes an OpenAI-compatible
   chat-completions API at `https://api.minimax.io/v1`. Live verification confirmed:
   - HTTP 200 with `model: MiniMax-M3` (model pinning per request);
   - `finish_reason: tool_calls` on a function-call roundtrip;
   - `thinking:{type:"disabled"}` honoured;
   - usage telemetry including `prompt_tokens_details.cached_tokens`;
   - schema-validated structured reports via `finalize_report`.

3. **CLI-broker (C) — not selected.** No standalone headless MiniMax coding CLI with
   machine-readable status/exit is available; the API is strictly superior here.

4. **Mailbox (D) — held as fallback.** Configured (`allow_mailbox_mode: true`,
   `.orchestrator/mailbox/`) but not required since mode B passes all criteria.

## Implementation
A minimal local supervisor, `tools/orchestrator/m3_adapter.py`, drives the M3 API in
an allowlist-enforced agentic tool loop. It is the "smallest necessary supervisor layer"
(bundle doc 14); no platform/framework. GLM-5.2 is invoked only at semantic gates.

Evidence: `.orchestrator/ENVIRONMENT_AND_ADAPTER_CAPABILITY_REPORT.md`,
`.orchestrator/artifacts/DRY_RUN_EVIDENCE_REPORT.json`.
