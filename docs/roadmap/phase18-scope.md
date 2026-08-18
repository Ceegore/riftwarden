# Phase 18 Scope — Status, Control, Periodic, Cleanse and Dispel

> Status: **SCOPED, IMPLEMENTATION STARTED.** This is the repository-side
> scoping artifact for Phase 18. It makes no claim that G17 is proven; the
> Phase-17 gate remains `BLOCKED` on device evidence (WebViews/perf). Phase 18
> begins with the pure, kernel-independent foundation and only wires into
> stages B/C/G/H/I/J/K/M after the closed types and matrices are pinned.

## 1. Source of truth

- `Phasen/Phase_18/RIFTWARDEN_PHASE_18_UMSETZUNGSHANDBUCH.md`
- `content/schemas/status.ts` and `content/source/statuses/statuses.json`
  (authoritative closed kinds, policies, dispel categories, boss policies)
- GDD V5 chapters 8, 11, 15, 16, 17, 51, 73, 75, 76, 85

## 2. In-scope

| Ticket | Content | Stages |
|---|---|---|
| T01 | `StatusInstance` DTO, closed `StatusKind` union, validation, reason codes, control categories | — |
| T02 | Immutable `StatusCollection` with the five §5.3 indices and canonically sorted queries | — |
| T02 | Five stack policies (§6): replace_if_stronger, refresh_duration, extend_duration_capped, independent_by_source, no_reapply | — |
| T03 | Periodic scheduling (first tick `startTick + intervalTicks`, `initialTick`, next/interval/tickIndex) | C (plan) / I (apply) |
| T04 | Control: hard/soft categories, boss resistance tiers, duration rounding, anti-permalock | G (consume) |
| T05 | Cleanse (categorical negative priority) and Dispel (positive; shield cap 35% max LP via ledger) | H (queue) / K (remove) |
| T06 | UI-safe events (`EffectApplied/Refreshed/Ignored/Removed/Tick/Resisted`) and read-only selectors | M |

## 3. Closed kinds (from content/schemas/status.ts)

`attack_up, attack_speed_up, move_speed_up, resistance_up, regeneration,
burn, poison, slow, weaken, silence, stun, mark, confusion`. `shield` is
excluded — shields live in the Phase-17 shield ledger (§6, §9.2) and are not
stacked/removed as status instances.

## 4. Out-of-scope

Ability-trigger DSL, eval/Function scripting, permanent CC loops, renderer
authority, arbitrary status strings, and any new runtime/physics dependency.

## 5. New modules (handbook §14 budgets)

| Module | Responsibility | Budget |
|---|---|---:|
| `status-instance.ts` | DTO, closed kinds, validation | ≤240 |
| `status-collection.ts` | immutable indices/queries | ≤280 |
| `status-stacking.ts` | five policies | ≤300 |
| `periodic-status-system.ts` | scheduling + commands | ≤280 |
| `control-resolver.ts` | resistance, caps, restore | ≤280 |
| `cleanse-dispel.ts` | priorities + removal | ≤260 |
| `status-events.ts` | UI-safe events | ≤220 |
| `selectors.ts` | pure read models | ≤220 |

## 6. Order of work (handbook §15)

1. Closed types/constants/reason codes/validators.
2. Collection/indices with roundtrip + duplicate-negative tests.
3. Stack resolver with the full pairwise matrix.
4. Periodic scheduler (C) and apply ports (I).
5. Control resolver, boss caps, interrupt, legal restore.
6. Cleanse/dispel with shield-ledger cap.
7. Events/selectors.
8. Snapshot/hash/replay + migration; dense/mirror/permutation/fault/cross-runtime.

## 7. Gate

G18 is `PASS` only with real artifacts: G17 green, all six tickets, complete
stack matrix, periodic/control/cleanse/dispel goldens, save/resume and
cross-runtime green, typecheck/lint/unit/source-policy green, no P0/P1, file
budgets met, real revisions/commands/artifact paths documented. Otherwise
`BLOCKED`/`FAIL` — never an estimated PASS.
