# WP P00-T02h – Requirements Fill-in (chapters 36-47)
- Version: 1 | Phase: PHASE-00 | Idempotency Key: rw-p00-t02h-v1-20260722
- Status: APPROVED | Disjunct write target: docs/requirements/requirements/_staging/chunk-h.json
## Goal: Extract ALL normative reqs from GDD ch36-47 into atomic REQ records.
## Read: docs/requirements/generated/chapters/chapter-36.txt..chapter-47.txt + chapter-index.json
## Method: read each small chapter file, extract normative statements (MUST/MUST_NOT/SHOULD/MAY,
  hard numbers, counts, limits, catalogs), TEMP id REQ-TEMP-H-NNNN, fields per handbook §5.4,
  quoteHash=sha256(excerpt). Write staging file once when done. Call finalize_report.
## Budgets: max_changed_files 2, timeout 3000s, repair rounds 3.
