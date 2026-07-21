# WP P00-T01 – Source-Freeze & Document Audit

## Identity
- Version: 1
- Phase: PHASE-00
- Phase Contract Hash: e8ba78c3ee858cb6f490b0b7d21fe909783786169484a73dee09727304a7f3df
- Idempotency Key: rw-p00-t01-v1-20260722
- Start Commit/Tree: 9f1c39fd67f3c9f20499dd60b91a49d932de4c54 / 32d36c9e82367f0c5fcc95831843ba554cdc0771
- Branch: feat/00-autorit-t-requirements-und-traceability (create from main)
- Risk Class: low
- Status: APPROVED
- WP Contract SHA-256: 36c9dd5903fa67092f2f2d9580c0227feedf8cf32a900f73cd9fb44ebb70f2ae

## Goal
Freeze the GDD V5 source identity and verify its structure: compute SHA-256, extract DOCX
structure, confirm exactly 87 chapters (1-87, unique, verified), scan for open source markers,
populate source-manifest.json, and get the draft validator green.

## Required Inputs
- docs/source/Riftwarden_GDD_V5_0.docx (sha256 f550bdf3...6ed9, 232607 bytes)
- Starter-kit (copy from Phasen/Phase_00/entpackt/Riftwarden_Phase_00_Umsetzungspaket/Riftwarden_Phase_00_Umsetzungspaket/starter-kit/)
- Phase 00 handbook §3, §6 (preflight + P00-T01)

## In Scope
- Copy starter-kit into repo (skip-existing, do not overwrite real content).
- Create the verbindlicher Default branch: `feat/00-autorit-t-requirements-und-traceability`.
- Run `python-extract-docx` -> docs/requirements/generated/source-structure.json.
- Run `python-find-markers` -> docs/requirements/source-findings.json.
- Populate docs/requirements/source-manifest.json: authorityStatus, publisherConfirmation
  (status 'pending' — DECLARED GAP, do NOT fabricate 'confirmed'), files[0] sha256/byteSize,
  chapterAudit.status, frozenAt/frozenBy.
- Verify 87 chapters via `node-audit-headings` (headings start requires_review — that's expected
  for T01; full verification to 'verified' is part of completing T01).
- Run `node-validate-draft` -> docs/reports/phase-00-validation-draft.json (must be green / no errors).
- Commit changes on the phase branch.

## Out of Scope
- Gate-mode validation green (G00 PASS) — BLOCKED by declared publisher-confirmation gap; draft only.
- Requirements extraction (T02), norms (T03), external values (T04) — separate WPs.
- Any game code.

## Deliverables
- D1: starter-kit copied into repo (tools/requirements/*, docs/requirements/*).
- D2: docs/requirements/generated/source-structure.json (from DOCX extraction).
- D3: docs/requirements/source-findings.json (markers classified).
- D4: docs/requirements/source-manifest.json (frozen source, hash set, publisher pending).
- D5: docs/reports/phase-00-validation-draft.json (draft validator green).
- D6: commit on feat/00-... branch with message "feat(requirements): freeze GDD source and authority".

## Allowed Read Paths
- Whole repo (PATH_ALLOWLIST read_roots).

## Allowed Write Paths
- docs/, tools/ (starter-kit + generated). NOT .git, NOT .orchestration_source, NOT Phasen/.

## Forbidden Paths
- .git, .orchestration_source, Phasen/, backup/, Meldungen/, .ssh, .config.

## Immutable Interfaces and Behaviors
- Do NOT change stable ID regexes, status enums, or NORM values in the starter-kit.
- Do NOT set publisherConfirmation.status to 'confirmed' (that would be fabrication; gap is declared).
- Do NOT auto-update the source hash to match an unexpected file change — that must block.

## Implementation Constraints
- Validators use Node stdlib only; DOCX tools use Python stdlib only. No new dependencies.
- Deterministic output (stable JSON key sort).
- Files: goal 0-250 lines, warn 301-500, blocker 501+.

## Allowed Local Decisions
- Internal helper naming, file splitting within the starter-kit tree if a file exceeds limits
  (document the split), adding unit tests for new validator cases.

## Decisions Requiring Escalation
- New dependency. Any change to stable ID/status/norm contracts. Publisher confirmation claim.
- A second GDD V5 candidate with a different hash. Unreadable tables. Source hash mismatch.

## Exact Acceptance Criteria
| ID | Criterion | Evidence Required |
|---|---|---|
| AC1 | starter-kit present under repo (tools/requirements, docs/requirements) | file tree listing |
| AC2 | source-structure.json exists and non-empty | file + sha256 |
| AC3 | source-manifest.json files[0].sha256 == f550bdf3...6ed9 | manifest JSON |
| AC4 | source-manifest publisherConfirmation.status == 'pending' (NOT confirmed) | manifest JSON |
| AC5 | node-validate-draft exit 0 (no errors) | validation JSON + exit code |
| AC6 | node-test exit 0 (starter-kit tests pass) | test output |
| AC7 | changes committed on phase branch | git log |

## Required Test Commands
| ID | Command | Working Dir | Timeout | Required Exit |
|---|---|---|---|---|
| T1 | run_command('node-test', ['tools/requirements/tests/validator.test.mjs']) | . | 120 | 0 |
| T2 | run_command('python-extract-docx', ['docs/source/Riftwarden_GDD_V5_0.docx','--out','docs/requirements/generated/source-structure.json']) | . | 60 | 0 |
| T3 | run_command('python-find-markers', ['docs/requirements/generated/source-structure.json','--out','docs/requirements/source-findings.json']) | . | 60 | 0 |
| T4 | run_command('node-validate-draft', ['--json','docs/reports/phase-00-validation-draft.json']) | . | 60 | 0 |

## Baseline Expectations
- Repo clean before start. No pre-existing phase-00 artifacts.

## Retry Budget
- 3 repair rounds per error class (adapter default).

## File/Diff/Token/Time Budgets
- max_changed_files: 80 (starter-kit has ~62 files). max_diff_lines: 20000. timeout: 7200s.

## Mandatory Checkpoints
- After starter-kit copy (before validation).

## Heartbeat Contract
- Adapter default (120s).

## Stop Conditions
- GDD hash mismatch. Unreadable DOCX. New dependency required. File >500 lines.
- Publisher-confirmation fabrication pressure. Conflicting V5 source.

## Evidence Artifacts
- docs/reports/phase-00-validation-draft.json
- source-manifest.json, source-structure.json, source-findings.json
- M3_EVIDENCE_REPORT (schema-valid, commit-bound)

## Completion Output Schema
- schemas/M3_EVIDENCE_REPORT.schema.json (status COMPLETE recommended; PARTIAL acceptable if draft validator has only declared-gap warnings).

## Handoff Notes
- Sets the frozen source identity for T02-T06. Report exact frozen hash + byte size + chapter count.
- Explicitly state publisher-confirmation gap status (must remain pending).
