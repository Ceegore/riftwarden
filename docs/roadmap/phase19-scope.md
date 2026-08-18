# Phase 19 Scope — Ability-Trigger Framework, Target Queries and Effect Commands

> Status: **SCOPED, NOT STARTED.** This is the repository-side scoping artifact
> for Phase 19. It makes no claim that G18 is proven; the Phase-18 gate
> remains `BLOCKED` on operator device evidence (G17 WebViews/perf) plus the
> content-side items below. Phase 19 must not start before
> `phase18:validate-readiness` is green.

## 1. Source of truth

- `Phasen/Phase_19/RIFTWARDEN_PHASE_19_UMSETZUNGSHANDBUCH.md`
- GDD V5 chapters on abilities, targeting, charge/cooldown, status effects
- Phase 18 handoff: closed `StatusKind`/events, `set_statuses` (I/K),
  `queue_cleanse_dispel` (H) + `clear_pending_cleanses` (K) plumbing, the
  periodic/control/cleanse/dispel pure modules

## 2. In-scope

| Ticket | Content | Kernel surface |
|---|---|---|
| T01 | Closed trigger/predicate DSL (§5): `battle_start`, `tick_interval`, `hp_threshold_crossed`, `ally_event`/`enemy_event`, `status_present`/`status_absent`, `target_condition`, `once`, `charge_ready`, `entity_defeated`, `boss_phase`, `count_in_range`, `all`/`any`/`not` — pure evaluator, no eval/strings | stages B/C (trigger) |
| T02 | Target query DSL (§6): closed target spaces, filters/profiles, deterministic tie order (score → authorized metric → distance → lane → entityId, code-unit compares) | stage E |
| T03 | Effect command composition (§7): `damage/heal/shield`, `apply_status/remove_status/cleanse/dispel`, `move/lane_change`, `spawn_request`, `modify_charge`, `taunt/mark` — executor enqueues into existing stage queues, no own logic, duplicate `commandId`/`effectIndex` hard error | stages G/H/I/K |
| T04 | Charge/cooldown/cast lifecycle (§8): closed state machine, silence gate, 35% interrupt charge-loss default, commit snapshot semantics, recovery | stage G |
| T05 | Invalid-target + meaningful-use policies (§9) | stage G + diagnostics |
| T06 | Scenario builder + coverage inventory (§10) | tooling |

## 3. Consumes from Phase 18 (already in place)

- `set_statuses` (I/K), `queue_cleanse_dispel` (H), `clear_pending_cleanses` (K)
- `status-collection` queries (by target/kind/stack-group/source) as the
  `status_present`/`status_absent` and cleanse/dispel predicate surface
- `apply_lp_delta`, `set_shields`, `queue_combat_application` for
  damage/heal/shield effect commands
- The six `Effect*` event types plus the Phase-19 `Ability*` event set

## 4. Out-of-scope

Full summon/construct lifecycle (§6.1 — Phase 20; Phase 19 ports only the
typed slot), arbitrary scripting/`eval`, renderer/UI authority, hidden-RNG
preview disclosure, and any new runtime/physics dependency.

## 5. New modules (handbook §14 budgets)

| Module | Responsibility | Budget |
|---|---|---:|
| `trigger-definition.ts` | closed trigger/predicate types + validator | ≤300 |
| `trigger-evaluator.ts` | pure evaluation, `{matched, reasonCode, evidence}` | ≤300 |
| `ability-target-query.ts` | target DSL/resolver + stable ties | ≤300 |
| `effect-command.ts` | closed commands + IDs | ≤280 |
| `effect-executor.ts` | stage enqueue, no own logic | ≤300 |
| `ability-system.ts` | lifecycle state machine | ≤300 |
| `invalid-target-policy.ts` | wait/retarget/consume | ≤220 |
| `battle-scenario.ts` | explicit fixture builder | ≤300 |
| `ability-coverage.ts` | inventory/blocker report | ≤220 |

## 6. Order of work (handbook §15)

1. T01 closed trigger DSL + validator.
2. T02 target query DSL and stable ties.
3. T03 effect commands and stage enqueue.
4. T04 charge/cooldown/cast/interrupt lifecycle.
5. T05 invalid-target + meaningful-use policies.
6. T06 scenario builder, per-ability contract tests, coverage inventory.
7. Snapshot/replay version, migration, goldens, evidence, independent review.

## 7. Gate G19

G19 is `PASS` only with real artifacts: G18 green, all six tickets, complete
trigger/target/effect/lifecycle matrices, save/resume and cross-runtime
green, typecheck/lint/unit/source-policy green, no P0/P1, file budgets met,
real revisions/commands/artifact paths documented, and the coverage inventory
fully `covered`. Otherwise `BLOCKED`/`FAIL` — never an estimated PASS.
