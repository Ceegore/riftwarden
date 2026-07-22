# WP P00-T02 – Normative Requirements Extraction (parallel, 3 chunks + merge)

## Identity
- Version: 1
- Phase: PHASE-00
- Depends on: P00-T01/T01b (source frozen + headings verified)
- Status: APPROVED (orchestrator umbrella for T02a/T02b/T02c/T02-merge)

## Goal
Extract ALL normative requirements from GDD V5 chapters 1..87 into atomic REQ
records with stable IDs, source locators, quote hashes, categories, owner phases,
and numeric constraints. Two-pass per chapter (completeness then normalization).
Executed as 3 PARALLEL chapter-range chunks (disjunct write targets) + 1 sequential merge.

## Parallelization design (framework rule 8.7: disjunct write-sets)
- Chunk A (T02a): chapters 1..29  -> docs/requirements/requirements/_staging/chunk-a.json
- Chunk B (T02b): chapters 30..58 -> docs/requirements/requirements/_staging/chunk-b.json
- Chunk C (T02c): chapters 59..87 -> docs/requirements/requirements/_staging/chunk-c.json
- Merge  (T02-merge): combines chunk-{a,b,c}.json -> category files (product/sim/etc.) + assigns final REQ-IDs.

Each chunk writes ONLY its own staging file -> no conflict. Merge is sequential (sole writer to category files).

## Atomic requirement (per handbook §7.4)
Each REQ = ONE normative statement. Split compound clauses. Extract: MUSS/MUSS NICHT/SOLL/DARF,
'ist'-statements defining fixed decisions, minima/maxima, exact counts, time limits, framerates/tickrates,
platforms, screen/content/test catalogs, state machines, forbidden features, allowed deps, content counts,
hero/item/boss defs, save/migration rules, a11y duties, store/cert rules, perf budgets, release gates,
privacy/offline, rollback/provenance.

## REQ record shape (per handbook §5.4 + requirement.schema.json)
{ id, title, statement, norm(MUST|MUST_NOT|SHOULD|MAY), category(Product|Content|Sim|UX|Save|A11y|Perf|Security|Android|iOS|Store|QA),
  source{sourceId:'gdd-v5', chapter, section|null, locator, quoteHash:'sha256:<64hex>', originalExcerpt},
  ownerPhases[], verification[]{type, plannedPhase, testIds[]}, numericConstraints[], relatedNormIds[],
  relatedScreenIds[], status:'planned', notes }

## ID assignment
- Chunks assign TEMPORARY ids: REQ-TEMP-<chunk>-<seq> (e.g. REQ-TEMP-A-0001). DO NOT assign final category IDs (merge does that to avoid collisions across parallel chunks).
- Merge assigns final IDs per category regex ^REQ-(PRODUCT|CONTENT|SIM|UX|SAVE|A11Y|PERF|SECURITY|ANDROID|IOS|STORE|QA)-\d{4}$, sequentially per category, stable, no reuse.

## Chapter coverage (handbook §7.6)
Every chapter 1..87 must yield >=1 REQ OR a verified context_only disposition. Context-only needs a concrete reason (>=20 chars), not 'nothing important'.

## Normative values (handbook §5.2): MUST, MUST_NOT, SHOULD, MAY only. No 'required'/'optional'.
## Status values: planned (extraction), implemented, verified, blocked, deferred_by_spec.

## Owner phase: derive from the dev plan / requirement nature. Phase 00 is NOT an owner phase for gameplay (handbook §7.7).

## Acceptance Criteria (merge WP)
| ID | Criterion |
|---|---|
| AC1 | Every chapter 1..87 covered (REQ or context_only) |
| AC2 | No duplicate REQ-ID |
| AC3 | Every hard REQ (MUST/MUST_NOT or numeric) has ownerPhase + testIds |
| AC4 | Every source.quoteHash = sha256:<64hex> of originalExcerpt |
| AC5 | Every category file valid against requirement.schema.json |
| AC6 | node-validate-draft PASS |

## Stop Conditions
- GDD chapter unreadable / conflicting normative statements at same authority rank (BLOCKER).
- A requirement needs a new product decision (BLOCKER).
- Quote hash mismatch (the excerpt must be exact).

## Budgets per chunk: max_changed_files 2, timeout 3600s, repair rounds 3.
## Budgets merge: max_changed_files 15, timeout 3600s.
