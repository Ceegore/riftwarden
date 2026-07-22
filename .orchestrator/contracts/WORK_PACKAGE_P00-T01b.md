# WP P00-T01b – Chapter Heading Verification & Audit Completion

## Identity
- Version: 1
- Phase: PHASE-00
- Phase Contract Hash: a5d4670e8287640fb43a72cb4e307ae0e3951245053cd0dad4b90370c388f8bc
- Idempotency Key: rw-p00-t01b-v1-20260722
- Branch: feat/00-autorit-t-requirements-und-traceability
- Risk Class: low-medium
- Status: APPROVED
- WP Contract SHA-256: e9a5ec492119a4a85340177c6544077d9c17ff0cebbc7362fbac72846c572bfd
- Depends on: P00-T01 (source freeze done; manifest frozen, publisher confirmed)

## Goal
Complete P00-T01's remaining work: populate the 87 chapter headings from the
extracted source-structure.json heading candidates, verify each against the GDD,
set chapterAudit.status to complete, and re-run the heading audit + validators.

## Required Inputs
- docs/requirements/generated/source-structure.json (118 headingCandidates with real titles)
- docs/requirements/source-headings/chapters-{01-22,23-44,45-66,67-87}.json (87 placeholders)
- docs/requirements/source-headings.json (index)
- docs/source/Riftwarden_GDD_V5_0.docx (read via structure, NOT re-extract)
- Phase 00 handbook §6.6, §6.7 (heading audit rules)

## In Scope
- For each chapter 1..87: find the best matching headingCandidate in source-structure.json
  (match by chapter number + title; prefer confidence 'high' with styleHeading/outlineHeading true).
- Fill source-headings/chapters-*.json: title (real GDD title), locator (block index from candidate),
  extractionMethod ('docx_structure_extraction'), confidence (from candidate), reviewStatus 'verified',
  reviewedBy 'MiniMax-M3', reviewedAt '2026-07-22T00:00:00Z'.
- If a chapter has NO candidate, STOP and report a BLOCKER (do not invent a title).
- If multiple candidates match one chapter, choose the highest-confidence; note in deviations.
- Set source-manifest.json chapterAudit.status = 'complete'.
- Run node-audit-headings on source-headings.json (must say 'Heading audit: PASS' = exactly 87, 1..87, all verified).
- Run node-validate-draft (must stay PASS).
- Commit.

## Out of Scope
- Requirements extraction (T02). Norms (T03). External values (T04). Gate-mode PASS (T02-T06 needed first).
- Re-extracting the DOCX (use the existing source-structure.json).

## Deliverables
- D1: 4 source-headings/chapters-*.json files populated with real titles + verified status (87 total).
- D2: source-manifest.json chapterAudit.status = 'complete'.
- D3: node-audit-headings PASS.
- D4: node-validate-draft PASS.
- D5: commit.

## Acceptance Criteria
| ID | Criterion | Evidence |
|---|---|---|
| AC1 | Exactly 87 headings, chapters 1..87, no dupes/gaps | audit-headings output |
| AC2 | Every heading reviewStatus == 'verified' | headings json |
| AC3 | Every title is a real GDD title (from a candidate), NOT a placeholder | headings json (no REPLACE_WITH_) |
| AC4 | chapterAudit.status == 'complete' | manifest json |
| AC5 | node-validate-draft exit 0 | validation json |
| AC6 | committed | git log |

## Required Commands
| ID | Command | Args |
|---|---|---|
| T1 | node-audit-headings | ['docs/requirements/source-headings.json'] |
| T2 | node-validate-draft | ['--json','docs/reports/phase-00-validation-draft.json'] |
| T3 | git-add | ['docs/requirements/source-headings/', 'docs/requirements/source-manifest.json', 'docs/reports/phase-00-validation-draft.json'] |
| T4 | git-commit | ['-m','feat(requirements): verify 87 GDD chapter headings (P00-T01b)'] |

## Allowed Write Paths
docs/requirements/source-headings/, docs/requirements/source-manifest.json, docs/reports/

## Stop Conditions
- A chapter 1..87 has no plausible candidate (BLOCKER: report which chapter).
- Source-structure.json missing or unreadable.
- A heading title would need to be invented.

## Budgets
- max_changed_files: 8. max_diff_lines: 3000. timeout: 3600s. repair rounds: 3.
