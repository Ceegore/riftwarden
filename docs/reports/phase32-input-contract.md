# Phase 32 Input Contract — Vollständiger Dungeon, Events, Händler und Lootflows

Status date: 2026-08-22 — branch `feat/09-content-schemas-sourceformat-und-compilerg` (unchanged).
Source revision: `bc003f5` — clean working tree at scope time.
Kit: `Phasen/Phase_32/` — verified 57/57 files byte-identical against
`PACKAGE_MANIFEST.json` (incl. `starter-kit/tests/run-tests.ts`; no benign
mismatch this kit). The outer `.zip.sha256` (`ba8bb4…`) does not match the
current zip (`9f2fd9…`), but the zip hash matches the kit's own ZIP-QA report
and the extracted tree verifies fully against the manifest — treated as a
stale hash file, not an integrity issue.

## Gate context (from the phase kit, verbatim)

- G31: `NOT_PROVEN` — real profile/economy evidence, transaction ledger
  evidence, content revisions 10/18/42/6, compatibility registry, save
  migrations, screen restore and open defects stay operator-side.
- G32: `NOT_PROVEN`. This package claims no repository integration success.
- Repository/CI/browser/Android/iOS evidence: `NOT RUN`.

## Scope (binding)

| Ticket | Scope | Abnahme |
| --- | --- | --- |
| P32-T01 | Closed node registry: battle, elite, boss, event, merchant, recruitment, treasure, workshop, altar, scout, anchor, story — exactly one handler each | every content node mapped, no fallthrough, save roundtrip |
| P32-T02 | Event S42: exactly 30 events, 2–3 options, visible cost/consequence/risk, deterministic roll slots resolved once + saved, confirm/decline, outcome commands, commit before navigation | structure, reload stability, insufficient prerequisite |
| P32-T03 | Merchant S43 + Recruitment S44: 4 offers + 1 service, ≤1 authorized reroll, deterministic offers, buy/reroll commit, 2–3 recruitment candidates, copy limit (phase 31: 3), choose/decline once | last stock, no funds, reroll max, copy max, reload/kill/double callback |
| P32-T04 | Treasure S45, Workshop S46, Altar S47, Scout S48: full consequences visible, exactly-one workshop action, altar benefit+downside parallel with confirmation, scout info stored as run knowledge | every action/decline/back/kill, consequence preview, no hidden loss |
| P32-T05 | Run economy + loot security: secured/unsecured loot, relic limits 6/8 per mode, ownership/duplicate/replacement, sell/polish/kit temporary rules, exact commit before UI success, retreat/loss | first/repeat loot, duplicate, full relic cap, loss/secure, no negative currency, idempotent reward ids |
| P32-T06 | Full generator/flow QA: 100,000 maps across 20 missions × NORMAL/ASCENSION × MINIMAL/FULL (80 pinned profiles), 5–8 visits, anchor/preparation/boss, reachability, compatibility, stable parallel merge | zero structural violations, failures persist seed/profile |

## Binding constants (`contracts/phase32-constants.json`)

phase 32 · eventCount 30 · merchantOfferCount 4 · merchantServiceCount 1 ·
merchantMaxRerolls 1 · recruitmentMinOffers 2 · recruitmentMaxOffers 3 ·
mapValidationRuns 100000 · logicalLayers 6 · minVisits 5 · maxVisits 8 ·
gate G32.

## GDD anchors used

- §18 Riftinstabilität: 0–100, enter-time only, cap at 100; standard
  reductions klein −8 / mittel −15 / stark −25.
- §19.1 node table: battle +8, elite +12, merchant +3, recruitment +4,
  treasure +5, event +3..+10 by option, workshop +2, altar +8..+15, scout +2,
  anchor +0, boss no extra.
- §20.1 event rules: outcome fixed at open (no reroll on reload), invisible
  options stay visible-but-greyed with reason, ≥1 free option, no permanent
  removal of heroes/contracts/unlocks/fame.
- §22 relics: 6 active default (8 in ascension mode per §19/contract), replace
  or decline at full cap, weights common/selten/legendär 70/27/3, sell
  55/100/180.
- §23 economy: defeat keeps secured + 60% run gold; retreat at anchor keeps
  secured + gold to anchor + 80% late gold; duplicates convert at 45% of
  merchant base value; wallets never negative.
- §41 data contracts: stable lowercase ASCII ids, references validated at
  build, unknown id = hard error.
- §58 save/recovery: canonical JSON, commit-before-success-UI, slot rotation.

## Repo integration decisions (deviations from starter-kit, per handbook §16)

1. **Lowercase node types** — the starter-kit's uppercase `NodeType` union is
   adapted to the repo's existing lowercase convention (`battle`, `anchor`,
   `event`, …). The kit fixture `node-registry-cases.json` (uppercase) is
   normalized in tests.
2. **Registry deltas** — existing phase-28 pinned values stay untouched
   (`battle +5`, `anchor −10`); new types get GDD §19.1 defaults (elite +12,
   merchant +3, recruitment +4, treasure +5, workshop +2, altar +8, scout +2,
   event +3, boss 0, story 0). Precise per-option deltas live in the handlers
   and event options.
3. **Events as compiled content** — `events/event-content.ts` mirrors the
   pinned `events-30.json` byte-faithfully (ids, labelKeys, costs, previews,
   rollSlots, prerequisites); a test asserts deep parity, so content drift is
   a failing test, not a silent change.
4. **Exactly-once transactions** — phase-32 ledger semantics are implemented
   on the repo's immutable `RunState` conventions (revision checks,
   `committedTransactionIds`), with a phase-32 `LedgerEntry` record that
   replays stored results with zero mutation.
5. **Stop-gate** — S40–S49 screens, device/a11y/performance evidence and the
   real 100k browser runs stay operator-side (G32 blockers), exactly like
   G25–G31. This milestone ships the pure contract layer + machine evidence.
6. **Phase-28 test update** — `phase28-node-flow-registry.test.ts` asserts
   "exactly the two minimum types"; Phase 32's closed registry contract
   supersedes it (12 required types), so the two assertions are updated to the
   12-type registry. No assertion of behavior is weakened.

## Planned files (budgets)

- `src/game/expedition/types.ts` (extend: 12 node types) ·
  `node-registry.ts` (extend: 12 definitions)
- `src/game/expedition/nodes/types.ts`, `registry.ts`, `visit-state.ts`,
  `node-transaction.ts`
- `src/game/expedition/nodes/handlers/{combat,event,merchant,recruitment,choice,anchor}.ts` + `index.ts` (≤260 each)
- `src/game/expedition/events/{event-content,event-validator,event-service}.ts`
- `src/game/expedition/offers/offer-service.ts`
- `src/game/expedition/{outcome-commands,run-economy,reward-pool}.ts`
- `tools/sim/phase32-golden-harness.mjs`, `tools/sim/phase32-map-qa.mjs`,
  `tools/sim/validate-phase32-readiness.mjs`
- `contracts/phase32/` (constants, 8 fixtures, golden-registry.json,
  map-qa-report.json, phase32-readiness.expected.json)
- `tests/sim/phase32-*.test.ts` (vitest project `phase32`) + two `.test.mjs`
  CI wrappers (golden, map QA)

## Hard blockers carried into G32 (operator-side)

Upstream G31 evidence, real node/event/merchant device renders, a11y
screenreader protocols, device visual goldens, full-app browser E2E,
performance device measurements, shipped release-count content, real save
migrations, and the 100k runs on real devices — all `NOT RUN` here and
reported as operator blockers, never machine self-certified.
