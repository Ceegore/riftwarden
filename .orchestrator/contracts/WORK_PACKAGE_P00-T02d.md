# WP P00-T02d – Requirements Fill-in Chunk (chapters 36-50)

## Identity
- Version: 1
- Phase: PHASE-00
- Idempotency Key: rw-p00-t02d-v1-20260722
- Branch: feat/00-autorit-t-requirements-und-traceability
- Risk Class: medium
- Status: APPROVED
- Parallel group: T02 fill-in (disjunct write target)
- Note: smaller chunk (36-50) to fit the round budget. Previous wider chunks
  (b: 30-58, c: 59-87) only covered their first ~6 chapters before exhausting rounds.

## Goal
Extract ALL normative requirements from GDD V5 chapters 36..50 into atomic REQ
records, per T02 umbrella + handbook §7. Write ONLY to your staging file.

## Sole Write Target (DISJUNCT)
docs/requirements/requirements/_staging/chunk-d.json
(shape: {"schemaVersion":"1.0","chunk":"d","chapterRange":{"lo":36,"hi":50},"requirements":[...],"contextOnly":[...]})

## Read Inputs (SMALL, FOCUSED per-chapter files)
- docs/requirements/generated/chapters/chapter-36.txt ... chapter-50.txt (one small file per chapter)
- docs/requirements/generated/chapter-index.json (chapter->file map)
- Phase 00 handbook §5.4, §7

## Method (be EFFICIENT with rounds)
- read each chapter text file (they are SMALL: 5-133 lines each).
- extract normative statements as atomic REQs (split compound clauses).
- TEMP id REQ-TEMP-D-0001.. per record.
- fields: statement, norm(MUST|MUST_NOT|SHOULD|MAY), category, source{sourceId:'gdd-v5',chapter,locator:'block:N',quoteHash:'sha256:'+sha256(excerpt),originalExcerpt}, ownerPhases[], verification[]{type,plannedPhase,testIds[]}, numericConstraints[], status:'planned'.
- context-only entry if a chapter has no normative content (reason >=20 chars).
- write the staging file ONCE when all chapters processed; do NOT write incrementally.
- Call finalize_report when done.

## Out of Scope: chapters outside 36-50. Final IDs (merge). Category files.

## Acceptance: chunk file valid JSON; every chapter 36-50 has req or context-only; quoteHash correct.

## Budgets: max_changed_files 2, timeout 3000s, repair rounds 3.
