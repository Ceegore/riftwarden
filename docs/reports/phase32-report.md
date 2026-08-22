# Phase 32 Report — Expedition Line (Content Model + Economy + 12-Type Node Registry)

Status date: 2026-08-22 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.
Gate: **G32 BLOCKED on operator evidence only** — all 12 machine items
satisfied; the 8 blockers are operator-side (upstream G31 proof, device
renders, a11y protocols, device visual goldens, full-app browser E2E,
performance, shipped release-count content, real save migrations). Per the
handbook stop rule, no PASS is claimed on machine items alone.

## Scope (kit authority)

Per `docs/reports/phase32-input-contract.md` and the Phase 32 handbook, the
S40–S45 expedition screens, full UI rendering on real devices, accessibility/
performance evidence, and save migration stay operator-side behind the G31
gate. This milestone implements the pure expedition content + economy
contract layer — the 12-type closed node registry, 30 pinned events,
visit state machine, node transaction semantics, run economy with reward
pool, and full suites of fixture-driven tests.

## Production layer (`src/game/expedition/`, 25 new/existing modules + 11 handler families)

### Core extensions (pre-existing modules)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | (extended) | Closed 12-type `ExpeditionNodeType` union, `contentRevision`, `VisitStatus` |
| `node-registry.ts` | (extended) | `NODE_TYPE_DISTRIBUTION` table, `contentRevision` dispatch |
| `expedition-error.ts` | (extended) | 16 closed error codes, `ExpeditionError` class |
| `node-flow.ts` | (unchanged) | Forward pass, diagnostic chain |
| `map-generator.ts` | (extended) | Versioned type assignment, 80 map profiles, reachability invariants |
| `stable.ts` | (extended) | Node snapshots (visit-state id), outcome-command id ordering |
| `reachability.ts` | (unchanged) | Pure BFS, indexed node ids |
| `run-reducer.ts` | (unchanged) | Pure node-flow reducer w/ run config |
| `run-state.ts` | (existing) | Run bootstrap, seed injection |

### Node domain (`src/game/expedition/nodes/`)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | 160 | Tagged `NodeSnapshot` union (offer/event/reward/empty), `VisitStatus` FSM, `offerId`/`troopTypeId` on recruitment types, `CommitResult` with `newState` |
| `registry.ts` | 57 | 12 handler families, 6 non-combat topologies (event/merchant/recruitment/choice/anchor/story), versioned dispatch per `contentRevision` |
| `run-state.ts` | 49 | `createNodeRunState` — bootstrap visit map from run |
| `visit-state.ts` | 60 | `VisitStatus` FSM: IDLE → PREPARING → COMMITTING → COMMITTED; COMMITTED → (new) COMMITTING for multi-action nodes; prepare always resets to PREPARING |
| `node-transaction.ts` | 148 | Exactly-once `commitTransaction`, kill-point drivers (5 kill points), event fault injection, transaction ledger per node |

### Handler families (`src/game/expedition/nodes/handlers/`)

| Module | Lines | Contract |
| --- | --- | --- |
| `index.ts` | 32 | Registry — 12 handler families keyed by node type |
| `common.ts` | 68 | `prepareVisit`, `commitFlow`, `hasCommittedAction`, `replaceSnapshot`, `resolveFlow` — shared helpers used by all handlers |
| `combat.ts` | 131 | Combat node — troop engagement, damage resolution, loot drop from reward pool |
| `event.ts` | 73 | Event node — draw from 30 pinned events, snapshot negotiation, outcome application |
| `merchant.ts` | 112 | Merchant node — 4 pinned offers, buy/reroll loop, visit-state reset for multi-action |
| `recruitment.ts` | 134 | Recruitment node — per-node offer slate (3 offers), copy-limit enforcement, troop accumulation |
| `treasure.ts` | 44 | Treasure node — single-action loot with fixed gold/item award, one-shot terminal-action guard |
| `workshop.ts` | 51 | Workshop node — action-limited (ledger-based), upgrade/item spend, one-shot terminal-action guard |
| `altar.ts` | 55 | Altar node — sacrifice/boon choice, one-shot terminal-action guard |
| `scout.ts` | 44 | Scout node — reveal/preview, one-shot terminal-action guard |
| `anchor.ts` | 86 | Anchor/Story nodes — progression unlock + story beat, one-shot terminal-action guard |
| `choice.ts` | 10 | Re-export barrel for the four choice-node handler families |

### Event system (`src/game/expedition/events/`)

| Module | Lines | Contract |
| --- | --- | --- |
| `event-types.ts` | 26 | `SnapshottedEvent` and dependent types for snapshot protocol |
| `event-content.ts` | 260 | **Generated** from pinned fixture `contracts/phase32/fixtures/events-30.json` — 30 events with closed outcome branches, regeneration tool at `tools/sim/write-phase32-event-content.mjs` |
| `event-validator.ts` | 54 | Shape validation per event, structural invariants |
| `event-service.ts` | 138 | `drawEvent`, `applyOutcome`, snapshot protocol |

### Offer system (`src/game/expedition/offers/`)

| Module | Lines | Contract |
| --- | --- | --- |
| `offer-service.ts` | 96 | `pickMerchantOffers` (4 pinned), `pickRecruitmentOffers` (3 per node), `rerollMerchant` (replaces snapshot, max 1 reroll) |

### Economy & rewards

| Module | Lines | Contract |
| --- | --- | --- |
| `run-economy.ts` | 100 | Bias-controlled loot drops, per-node event draw, map-generation seed stability |
| `reward-pool.ts` | 97 | Deterministic item draw from bias-weight pools, single call-site for all handlers |
| `outcome-commands.ts` | 153 | Immutable outcome command algebra, id tracking, committed-then-replay semantics |

## Contracts + fixtures (`contracts/phase32/`)

Ported byte-identical from the kit: `phase32-constants.json`, `golden-registry.json`,
`map-qa-report.json`, and eight fixtures:
`events-30.json` (30 events),
`merchant-cases.json` (4 offers),
`recruitment-cases.json` (3 offers + copyLimit),
`choice-node-cases.json` (4 cases),
`kill-storage-matrix.json` (5 kill points),
`loot-cases.json` (4 cases),
`node-registry-cases.json` (13 entries),
`map-profiles.json` (80 profiles).

Plus 11 contract documents (`.md`) from the kit and generated readiness contract.

## Golden harness (`contracts/phase32/golden-registry.json`)

`tools/sim/phase32-golden-harness.mjs` (with `phase32-kernel-entry.ts`) bundles
the offer service + event service through Vite SSR, pins both sets
byte-for-byte, and runs a 10,000-input deterministic permutation sweep —
**0 failures**. Kernel source hash pinned; `phase32:golden:write/check`
scripts wired.

## 100k map QA (`contracts/phase32/map-qa-report.json`)

`tools/sim/phase32-map-qa.mjs` (with `phase32-mapqa-entry.ts`) runs
100,000 map generations across 11 node types — **0 failures, 0 structural
violations**, all 11 types reachable ("story" shares anchor handler).
`phase32:mapqa:write/check` scripts wired.

## Tests (`tests/sim/phase32-*.test.ts`, 9 suites / 98 tests)

All vitest `phase32` project, 9 files, ~1,329 lines:

- `phase32-contracts.test.ts` (16) — constants vs phase32-constants.json,
  12-type registry fixture, choice/merchant/recruitment cases, loot/kill
  storage fixtures, events-30 byte-identical fixture round-trip.
- `phase32-event-service.test.ts` (11) — draw every event, apply every outcome
  branch, snapshot protocol round-trip, deterministic consistency.
- `phase32-offer-service.test.ts` (14) — merchant 4-offer slate, buy/reroll
  loop, reroll replaces snapshot, one-reroll max, buy reduces gold.
- `phase32-recruitment.test.ts` (9) — 3 per-node offers, copy-limit enforcement,
  duplicate troop accumulation, offer id stability.
- `phase32-choice-nodes.test.ts` (10) — treasure/workshop/altar/scout:
  one-shot terminal guards, workshop action limit, altar sacrifice/boon,
  scout preview.
- `phase32-combat.test.ts` (8) — troop engagement, damage resolution,
  loot drop from reward pool, deterministic seed replay.
- `phase32-node-transaction.test.ts` (17) — exactly-once commit, 5 kill points
  in canonical order, event fault injection (all 16 error codes), transaction
  ledger immutability.
- `phase32-run-economy.test.ts` (7) — bias-controlled loot, per-node event
  draw, deterministic replay with pinned seeds.
- `phase32-recovery.test.ts` (6) — visit state machine full FSM: prepare,
  commit, recover, multi-action cycles.

## Readiness gate

`tools/sim/validate-phase32-readiness.mjs` + `contracts/phase32/phase32-readiness.expected.json`:
12 machine items satisfied, 8 operator blockers reported. Scripts wired:
`test:phase32`, `phase32:golden:write/check`, `phase32:mapqa:write/check`,
`phase32:validate-readiness`, `phase32:gate`.

## Machine evidence (all run on this machine)

- `pnpm typecheck` — clean
- `pnpm lint` — clean
- `node tools/format/check-format.mjs` — clean
- `pnpm check:file-length` — clean (all modules ≤300 lines)
- `npx vitest run --project phase32` — 98/98 green (9 suites)
- `phase32:golden:check` — 10,000 sweep, 0 failures
- `phase32:mapqa:check` — 100,000 maps, 0 failures
- `node tools/sim/audit-kernel-imports.mjs` — 0 findings
- `pnpm build:release` — OK

## G32 status

**BLOCKED by design** on the 8 operator codes (G31/architecture proof, device
renders, screenreader protocols, device visual goldens, full-app browser E2E,
device performance, shipped release-count content, real save migrations). All
12 machine-verifiable items are satisfied; no PASS is claimed on machine
items alone per the stop rule.

## Files

- Production: `src/game/expedition/` (25 modules + 11 handler families, ~2,238 lines)
- Contracts: `contracts/phase32/` (constants + 8 fixtures + golden registry + map QA + readiness)
- Tests: `tests/sim/phase32-{helpers,contracts,event-service,offer-service,recruitment,choice-nodes,combat,node-transaction,run-economy,recovery}.ts`
- Harnesses: `tools/sim/phase32-golden-harness.mjs`, `tools/sim/phase32-map-qa.mjs`
- Validator: `tools/sim/validate-phase32-readiness.mjs`
- Kernel entries: `tools/sim/phase32-kernel-entry.ts`, `tools/sim/phase32-mapqa-entry.ts`
- Generator: `tools/sim/write-phase32-event-content.mjs`
- Wiring: `vitest.config.ts` project `phase32`, package.json scripts
