# WP P00-T02b – Requirements Extraction Chunk B (chapters 30-58)

## Identity
- Version: 1
- Phase: PHASE-00
- Phase Contract Hash: a5d4670e8287640fb43a72cb4e307ae0e3951245053cd0dad4b90370c388f8bc
- Idempotency Key: rw-p00-t02b-v1-20260722
- Branch: feat/00-autorit-t-requirements-und-traceability
- Risk Class: medium
- Status: APPROVED
- Parallel group: T02 (disjunct write target)

## Goal
Extract ALL normative requirements from GDD V5 chapters 30..58 into atomic REQ
records, per the T02 umbrella contract and handbook §7. Write ONLY to your staging file.

## Sole Write Target (DISJUNCT — no other chunk writes here)
docs/requirements/requirements/_staging/chunk-b.json
(shape: {"schemaVersion":"1.0","chunk":"b","chapterRange":{"lo":30,"hi":58},"requirements":[...],"contextOnly":[{"chapter":N,"reason":"..."}]})

## Read Inputs
- docs/requirements/generated/source-structure.json (block text for chapters 30-58)
- docs/requirements/source-headings/chapters-*.json (verified titles/locators)
- docs/source/Riftwarden_GDD_V5_0.docx (read text via source-structure blocks; do NOT re-extract)
- Phase 00 handbook §5.4, §7 (REQ shape + extraction rules)

## In Scope
- For EACH chapter 30..58: read its blocks from source-structure.json.
- Extract every normative statement as an atomic REQ (split compound clauses).
- Assign TEMP id REQ-TEMP-B-0001.. per record (merge assigns final category IDs).
- For each REQ: statement, norm, category, source{sourceId:'gdd-v5',chapter,section|null,locator(block index),quoteHash:'sha256:'+sha256(excerpt),originalExcerpt}, ownerPhases[], verification[]{type,plannedPhase,testIds[]}, numericConstraints[], status:'planned'.
- If a chapter has NO normative content, add a context_only entry with a concrete reason (>=20 chars).
- quoteHash MUST be sha256 of the exact originalExcerpt (verify: recompute and compare).

## Out of Scope
- Chapters outside 30-58 (other chunks). Final REQ-ID assignment (merge). Category files. Norms (T03). Traceability (T05).

## Categories: Product, Content, Sim, UX, Save, A11y, Perf, Security, Android, iOS, Store, QA.
## Norms: MUST, MUST_NOT, SHOULD, MAY only.
## Owner phase: NOT Phase 00 for gameplay (derive from requirement nature / dev plan).

## Acceptance Criteria
| ID | Criterion |
|---|---|
| AC1 | chunk-b.json exists, valid JSON |
| AC2 | every chapter 30..58 has >=1 REQ or a context_only entry |
| AC3 | every REQ has statement, norm, category, source(chapter+locator+quoteHash+excerpt) |
| AC4 | every quoteHash == sha256(originalExcerpt) |
| AC5 | every hard REQ (MUST/MUST_NOT or numericConstraint) has ownerPhases + verification.testIds |
| AC6 | no TEMP id collisions within the chunk |

## Commands
| ID | Command | Args |
|---|---|---|
| T1 | node-validate-draft | ['--json','docs/reports/phase-00-validation-draft.json'] (run at end; staging is not validated but must not break draft) |
| T2 | git-add | ['docs/requirements/requirements/_staging/chunk-b.json'] |
| T3 | git-commit | ['-m','feat(requirements): extract REQs chapters 30-58 (P00-T02b)'] |

## Stop Conditions
- Unreadable/conflicting chapter content (BLOCKER: report chapter).
- A requirement needs a new product decision (BLOCKER).
- quoteHash mismatch (excerpt must be exact).

## Budgets: max_changed_files 2, max_diff_lines 8000, timeout 3600s, repair rounds 3.
