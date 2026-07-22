# WP P00-T02i – Requirements Fill-in (chapters 48-58)
- Version: 1 | Phase: PHASE-00 | Idempotency Key: rw-p00-t02i-v1-20260722
- Status: APPROVED | Disjunct write target: docs/requirements/requirements/_staging/chunk-i.json
## Goal: Extract ALL normative reqs from GDD ch48-58 into atomic REQ records.
## Read: docs/requirements/generated/chapters/chapter-48.txt..chapter-58.txt + chapter-index.json
## Method: read each small chapter file, extract normative statements (MUST/MUST_NOT/SHOULD/MAY,
  hard numbers, counts, limits, catalogs), TEMP id REQ-TEMP-I-NNNN, fields per handbook §5.4,
  quoteHash=sha256(excerpt). Write staging file once when done. Call finalize_report.
## Budgets: max_changed_files 2, timeout 3000s, repair rounds 3.
