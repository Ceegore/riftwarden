# WP P00-T02g – Requirements Fill-in Chunk (chapters 51-58)

## Identity
- Version: 1
- Phase: PHASE-00
- Idempotency Key: rw-p00-t02g-v1-20260722
- Branch: feat/00-autorit-t-requirements-und-traceability
- Status: APPROVED
- Note: fills the ch51-58 gap (chunk-b only reached ch35; chunk-c started at 59).

## Goal
Extract ALL normative requirements from GDD V5 chapters 51..58 into atomic REQ records.
## Sole Write Target (DISJUNCT)
docs/requirements/requirements/_staging/chunk-g.json
## Read Inputs
- docs/requirements/generated/chapters/chapter-51.txt ... chapter-58.txt
- docs/requirements/generated/chapter-index.json
- Phase 00 handbook §5.4, §7
## Method
- Read each chapter text file (small). Extract normative statements as atomic REQs.
- TEMP id REQ-TEMP-G-0001.. Fields per §5.4. context-only if no normative content.
- Write staging file once when all chapters done. Call finalize_report.
## Budgets: max_changed_files 2, timeout 3000s, repair rounds 3.
