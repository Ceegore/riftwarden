# Phase 17 Scope — Attack, Damage, Heal, Shield, and Battle-End Pipeline

> Status: **SCOPED, NOT IMPLEMENTED.** This document is the repository-side
> scoping artifact for Phase 17. It makes no claim that G16 or G17 is proven;
> implementation may only begin with real G16 evidence (Phase 16 committed and
> all gates green) and must re-read the full Phase 17 handbook plus the
> Phase-16→17 handoff once the content-release gate lifts its `[BLOCKED]`
> markers.

## 1. Source of truth

- `Phasen/Phase_17/RIFTWARDEN_PHASE_17_UMSETZUNGSHANDBUCH.md` (readable now)
- `Phasen/Phase_16/.../handoff/PHASE16_TO_PHASE17_HANDOFF.md` (`[BLOCKED]` until G16 evidence is registered)
- GDD V5 chapters 6, 8, 11, 12, 16, 17, 18, 34, 51, 73, 76
- Entwicklungsplan V2, Phase 17 section

## 2. In-scope

Phase 17 adds the combat pipeline on top of the Phase 15/16 kernel. It must
not reinterpret targeting, locks, Phase-15 geometry, or doctrine modifiers.

| Ticket | Content | Kernel stages |
|---|---|---|
| T01 | Standard-attack cycle: `ACQUIRE_TARGET → MOVE_OR_POSITION → PREPARE_ATTACK → EXECUTE_ATTACK → RECOVERY → ACQUIRE_TARGET`; `attackInstanceId`, prepare/commit/recovery/interval ticks; min interval 14 ticks; recovery locks the first `ceil(recoveryTicks/2)` ticks; interrupt before commit; retarget no earlier than next tick; never double-attack in the retarget tick | G/H (I/J consume) |
| T02 | Projectile lifecycle: stable id, spawn tick, SourceSnapshot, stored target position/lane, deterministic tick remainder velocity, `homing`/`maxTurn`, `expiryTick`, `lostTargetPolicy` (`impact_stored_position`/`expire`/`continue_straight`), `resolved=true` set exactly once before follow-up commands | H |
| T03 | AoE + hit sampling: point/line/radius in X100/lane; inclusive circle-edge contact; impact-tick sampling only; one hit per `attackInstanceId + effectIndex`; stable entity-id output order; 12% projectile cover reduction | H |
| T04 | Damage/heal/shield integer pipeline: `raw * 100 / (100 + defense)`, defense clamp `[-40, 200]`, pure damage ignores armor, boss single-hit cap 18% max LP, round-half-away-from-zero at every step, min 1 damage on a successful non-fully-negated hit, no global crit | I |
| T04 | Shield ledger: separate sources (`shieldId`, source/effect id, remaining, expiryTick, priority, applicationSequence); consumption highest-priority-then-oldest; never negative; distinct expiry/consumption events | I |
| T04 | Healing: caps at max LP, overflow decays, rift-collapse halves healing | I |
| T05 | Defeat/prevention/revive: HP may hit 0 in I but `DEFEATED` only in J after all I commands; J order = prevention → committed revive → defeated → onDefeated → remove; defeated entities not targetable; committed projectiles keep SourceSnapshot; summons alone never keep a side combat-capable; simultaneous zero-LP evaluated only after full J/L | J |
| T06 | Battle end: soft limits 2700 (normal/elite) / 3600 (boss) ticks + 450 rift-collapse ticks, hard sim limit 5400; collapse deals 8% max-LP pure damage every 90 ticks and halves healing; timeout winner by chapter-76 ratio `(Σ current LP + shields) / Σ max LP`, then regular-unit count, then boss/objective damage, else double defeat; no new gameplay events after final L | L |
| — | Snapshot/M: attack state, projectile list, effect dedup ledger, shield ledger, pending apply commands, defeat/revive queue, end-resolver state, collapse timer, stable sequence counters; hash every 30 ticks and at battle end | M |

## 3. Out-of-scope (explicit non-goals)

- Complex status stacking, full active abilities, animation/renderer authority.
- Reinterpreting TargetQuery, TargetLock, target score tiebreaks, Phase-15
  geometry (distance/lane/movement/spawn/collision/anti-stuck).
- Doctrine modifiers granting direct stat bonuses.
- New physics/pathfinding dependency, floats as state, `localeCompare`,
  array-index tiebreaks, unsorted map/object iteration as result authority.

## 4. New modules (from handbook §14, budgets enforced)

| Module | Responsibility | Budget (lines) |
|---|---|---:|
| `basic-attack-system.ts` | Attack lifecycle (G/H) | ≤300 |
| `projectile-system.ts` | Projectile state (H) | ≤300 |
| `area-sampler.ts` | AoE targets (H) | ≤240 |
| `combat-application.ts` | Damage/heal apply (I) | ≤300 |
| `shield-ledger.ts` | Shield sources/FIFO (I) | ≤280 |
| `defeat-resolver.ts` | Death/revive hooks (J) | ≤280 |
| `battle-end-resolver.ts` | Timeout/outcome (L) | ≤260 |

## 5. Contract surface changes (expected)

- Commands: attack lifecycle, projectile spawn, hit/apply commands, heal,
  shield add/consume/expire, defeat/revive, battle-end — each allowlisted per
  stage (G/H/I/J/L).
- Events: `AttackPrepared` (exists), `AttackInterrupted`, `AttackCommitted`,
  `AttackRecoveryStarted`, `AttackCycleCompleted`, `InvalidTargetPrevented`,
  projectile/AoE/apply/shield/defeat/end events — payloads per §8.4.
- Entity/battle schema: additive attack state, projectile list, ledgers,
  queues, collapse timer, end-resolver state — all with validation + migration
  defaults (same all-or-none migration pattern as Phase 15/16).

## 6. Order of work (handbook §15)

1. Preflight: real G16 evidence + source map; type/rounding/event contracts.
2. Contract/boundary tests first (golden 2699/2700, 3599/3600, 5399/5400,
   collapse intervals, tie-break order, retarget next-tick, interval minimum).
3. Attack lifecycle + G/H integration.
4. Projectile + AoE with snapshot/resume.
5. Damage/heal/shield apply in I + ledger events.
6. Defeat/revive only in J.
7. Battle end only in L; hash/snapshot in M.
8. Golden/mirror/permutation/cross-runtime/fault tests; source policy, line
   budgets, full CI, phase report, independent review.

## 7. Gate

G17 is `PASS` only with real repository artifacts: G16 green, all six tickets
implemented, typecheck/lint/unit/integration/golden/cross-runtime green,
save/resume green, source policy green, no open P0/P1, file budgets met, real
commands/revisions/artifact paths documented. Otherwise `BLOCKED` — never an
estimated PASS.
