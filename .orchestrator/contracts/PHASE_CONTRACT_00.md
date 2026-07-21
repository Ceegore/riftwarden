# PHASE-00 – Autorität, Requirements und Traceability

## Metadata
- Version: 1
- Status: APPROVED
- Authority Manifest Hash: see `.orchestrator/PROJECT_AUTHORITY_MANIFEST.yaml` (sha256 da875ed2...)
- Source Lock Hash: see `.orchestrator/SOURCE_LOCK.json`
- Repository Baseline Commit: 9f1c39fd67f3c9f20499dd60b91a49d932de4c54 (main)
- Phase Contract SHA-256: e8ba78c3ee858cb6f490b0b7d21fe909783786169484a73dee09727304a7f3df
- Created by: GLM_ORCHESTRATOR
- Approved by: GLM_ORCHESTRATOR
- Created at: 2026-07-22

## Objective
Phase 00 converts the approved GDD V5.0 into a machine-readable, reviewable, and
traceable single source of truth: frozen source identity, 87 verified chapters,
atomic requirements (stable IDs), normalization ledger (NORM-001..021), external
decisions register, tests registry, traceability matrix, and a phase-report
contract that mechanically prevents unproven PASS at Gate G00.

## Non-Objectives
- App or gameplay code; React/PixiJS/Capacitor/native features.
- Balancing, content production, runtime dependencies.
- New product decisions; interpreting missing GDD values; "probably meant" corrections.
- Phase-01 governance or Phase-02 toolchain freeze.
- Migration of existing save/content/simulation contracts.

## Authoritative Sources
| Priority | Path | SHA-256 | Relevant Sections | Role |
|---|---|---|---|---|
| 1 | docs/source/Riftwarden_GDD_V5_0.docx | f550bdf3...6ed9 | chapters 1-87 (esp. 72-87) | design authority |
| 2 | Phasen/Phase_00/RIFTWARDEN_PHASE_00_UMSETZUNGSHANDBUCH.md | (handbook) | all (esp. §3-§19) | phase spec (NOT design authority) |
| 3 | docs/source/Riftwarden_Entwicklungsplan_V2_0.docx | 69bcb6aa...c4e6 | sequence/policy only | supporting |

## Preconditions
- Repository baseline clean (commit 9f1c39f, main).
- GDD V5.0 readable, hash f550bdf3...6ed9.
- Node 25.8, Python 3.12 available.
- Starter-kit (62 files) available at Phasen/Phase_00/entpackt/.../starter-kit/.
- Adapter smoke: PASS (pending this session).
- **DECLARED GAP (blocks G00 PASS, not draft work):** no publisher confirmation artifact.
  → G00 stays BLOCKED until operator provides confirmation. Phase 00 work proceeds in draft mode.

## In Scope
- P00-T01: source freeze, DOCX structure extraction, 87 verified chapters, source findings.
- P00-T02: extract all normative statements, atomic REQ records with source locator + quote hash.
- P00-T03: normalize NORM-001..021 (exactly one active each, affected REQ links).
- P00-T04: 7 mandatory EXT keys with owner, development-default, block-gates, validation rule.
- P00-T05: stable ID regex, tests registry, many-to-many traceability, orphan/duplicate checks.
- P00-T06: JSON+Markdown phase report, PASS-only-with-evidence validator, BLOCKED as valid result.
- Negative fixtures + mutation tests for every gate item.

## Out of Scope
- Any game/runtime code. Any new production dependency (Phase 02 freezes deps).
- Resolving publisher confirmation or external decision values (only registering their block rules).
- Phase-01 contracts (PR templates, branch protection, CI).

## Immutable Contracts
- Stable IDs never reused; status enum fixed; NORM values fixed (MUST/MUST_NOT/SHOULD/MAY).
- Source hash never auto-updated. "87 verified chapters" is a hard G00 condition.
- Authority order fixed: GDD ch72-87 > concrete data/contract > safety/save/store/a11y limit > numeric baseline > dev plan > ADR > error not invention.
- Files: 0-250 lines goal, 251-300 watch, 301-500 warn, 501+ blocker. No minification to evade.

## Architecture Boundaries
- Validators use Node stdlib only (no runtime deps). DOCX extraction uses Python stdlib only.
- Output tree under docs/requirements/ + docs/reports/ + tools/requirements/ (handbook §1.1).
- Deterministic JSON (stable key sort); reports byte-identical modulo documented timestamps.

## Work Packages
| ID | Title | Dependencies | Risk | Parallelizable | Expected Evidence |
|---|---|---|---|---|---|
| P00-T01 | Source-Freeze & Document Audit | none | low | no (sequential first) | source-manifest, 87 headings, findings, draft validator green |
| P00-T02 | Normative Requirements Extraction | T01 | medium | partial (see T04) | requirements index, atomic REQs, numeric constraints, chapter coverage |
| P00-T03 | Normalization Ledger (NORM-001..021) | T02 | low | no | active norms, affected REQs, superseded preserved |
| P00-T04 | External Decisions & Release Blockers | T01 | low | YES (parallel w/ T02) | 7 EXT keys, block-gates, machine-checkable rules |
| P00-T05 | Traceability Model & ID Rules | T02,T03 | low | no | tests registry, traceability matrix, orphan/duplicate report |
| P00-T06 | Phase-Report & Evidence Contract | T01-T05 | medium | no | phase-00.{json,md}, PASS-protected validator, gate validation |

**Parallelism note:** only T02 and T04 have disjunct write-sets (requirements/ vs external-decisions.json). All others are sequential due to data dependencies (traceability needs REQs+tests+norms).

## Integration Points
- Gate G00 output (PASS/BLOCKED) is the gate to Phase 01.
- docs/reports/phase-00.{json,md} + validation-gate.json are Phase-01 required inputs.

## Test Strategy
- `node --test tools/requirements/tests/validator.test.mjs` (neg + pos fixtures).
- `node tools/requirements/validate.mjs --mode=draft|gate`.
- Mutation tests: hash mismatch, missing/dup chapter, dup REQ-ID, orphan, PASS-no-evidence, double-active NORM, missing EXT.
- Determinism check (run twice, byte-compare).
- File-length check (no human file >500 lines).

## Platform Smokes
- Not applicable in Phase 00 (no app code). Phase 00 smoke = validators green.

## Performance/Quality Budgets
- Deterministic reports. Determinism regression test. No file >500 lines.
- Token budget per WP: managed by adapter; GLM reviews at completion gate only.

## Risks and Mitigations
| Risk | Severity | Mitigation |
|---|---|---|
| Publisher confirmation missing -> G00 cannot PASS | P1 | DECLARED GAP; draft-mode work; surface to operator at checkpoint |
| M3 hallucinates chapter/REQ extraction | P2 | bidirectional review, mutation tests, quote-hash binding, GLM risk-based completion review |
| DOCX unsupported elements (textboxes/SmartArt) hide content | P2 | unsupportedCounts!=0 forces visual review (handbook §6.5) |
| Phase 17/30 starter-kits missing (future) | P3 | recorded as known_gaps; rebuild from handbook at phase start |

## Human Gates
- Provide publisher confirmation artifact before G00 PASS.
- Review any context-only chapter disposition and external-decision block-rule.

## Phase Definition of Done
- All 6 work packages accepted.
- Draft validator green; gate validator green (modulo declared publisher-confirmation gap).
- No open P0/P1 (publisher-confirmation gap is a documented gate-limited blocker, not a defect).
- phase-00.{json,md} produced; traceability complete; handoff manifest ready.

## Required Handoff
- docs/reports/phase-00.{json,md}, validation-gate.json, source-manifest, requirements index,
  normalization-ledger, external-decisions, tests, traceability.

## Stop Conditions
- Missing/conflicting GDD V5 source. New design decision required. New runtime dependency.
- Unexpected existing contract. File >500 lines. Open P0/P1 unrelated to declared gap.
- Source hash would need "updating" because file changed unexpectedly.
