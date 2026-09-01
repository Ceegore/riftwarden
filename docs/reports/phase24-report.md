# Phase 24 Report — Domain Persistence Layer (Schemas, Migrations, Resume, Transfer, Recovery)

**Gate: G24 — BLOCKED on operator evidence (machine evidence complete)**

Phase 24 builds the domain persistence layer on top of the Phase 23 atomic
NativeSaveStore: strictly validated Profile/Run/Settings payloads, an n→n+1
migration registry, the SaveService commit matrix with idempotency keys, the
battle snapshot/resume contract, quarantine-based import/export and the pure
recovery decision table plus diagnostics model.

## What landed

### Schemas (`src/game/save/schema/`)
- Shared `SaveHeader`, `TextScale` (exactly 100/125/150/175/200),
  `SaveCommitReason` (10 reasons), `RecoveryReason` (7 reasons) and the three
  payload interfaces.
- `settings-schema.ts`: strict closed-field decoder — unknown fields,
  missing fields, future schemas, invalid language/scale/volume are distinct
  stable errors.
- `profile-save.ts`: permanent progress, inventory (non-negative safe
  integers), renown, unlocks/achievements (stable ids), statistics and the
  settings reference.
- `run-save.ts`: run mode/status enums, map state, loadout, loot, decision
  list, seed reference and the optional battle snapshot.
- Shared decoder utilities enforce `additionalProperties:false` semantics and
  distinguish INVALID_OBJECT / UNKNOWN_FIELD / MISSING_FIELD / INVALID_SCHEMA /
  FUTURE_SCHEMA / INVALID_ENUM / INVALID_RANGE / INVALID_REFERENCE.

### Migrations (`src/game/save/migrations/`)
- `migrations.ts`: sequential n→n+1 chain only; gaps, cycles and future
  versions are hard errors; every edge is applied to a deep clone (the
  original is never mutated), must advance schemaVersion by exactly one and
  validates input/output. Idempotency: re-migrating current data is a no-op.
- `settings-migrations.ts`: the v1→v2 edge (adds `subtitleBackdrop:false`)
  with a validated registry.

### Commit matrix (`save-service.ts`, `commit-coordinator.ts`)
- Strictly monotonic commitId, stable idempotency keys, duplicate events
  rejected without side effects (double click / doubled lifecycle / retry).
- All ten SaveCommitReasons route through the atomic store; only waiting
  battle snapshots coalesce onto the newest tick (verified through the
  persisted envelope); profile, reward and final-outcome commits never
  coalesce.

### Battle snapshot / resume (`battle-resume.ts`)
- Snapshot validation: safe tick/sequence, non-empty RNG streams, unique
  entity ids, 64-hex pre-resume hash. Resume always starts paused, never
  auto-resumes, and follows rebuild → verify hash → views → audio/input →
  user continue. Golden `golden_save_301` contract pinned (cut points and
  same-end-hash expectation from the kit fixture).

### Transfer + quarantine (`transfer/`)
- `.riftwarden-save` container with 10 MiB total / 8 MiB per entry, known
  root files only. Rejects traversal (slash/backslash/..), absolute paths,
  hidden files, links, duplicates, oversized entries/totals and compression
  bombs (>200:1). Import validates in quarantine, builds a preview, plans a
  full replace (merge forbidden) and leaves active saves untouched until the
  confirmed final commit. All 17 malicious-corpus classes exercised.

### Recovery + diagnostics (`recovery/`)
- Pure decision table with the priority order from handbook §10: disk full →
  renderer loss → migration failed → content mismatch → run invalid (with
  confirmation) → newest slot invalid (highest valid commitId fallback,
  never auto-delete). All eight recovery-matrix rows covered.
- Opt-in diagnostics export with minimized data (versions, slot integrity,
  recovery decisions, renderer capability, stable error codes) — no personal
  data, paths, device ids or payload content.

## Tests
- `tests/sim/phase24-schema-migration.test.ts` (16 tests): pinned constants,
  settings/profile/run valid + invalid cases, 1000-sample text-scale
  property, migration chain, idempotency, future/gap/edge rejection and the
  pinned migration cases.
- `tests/sim/phase24-service-transfer-recovery.test.ts` (24 tests): commit
  coordinator, SaveService commit matrix (all 10 reasons, duplicate
  rejection, no-coalesce for business commits, snapshot coalescing), battle
  resume plan + golden contract, transfer policy malicious corpus (17 cases),
  quarantine/preview/commit-plan, recovery decision table (8 rows),
  diagnostics minimization.
- 40 vitest tests green; typecheck/lint/format/file-length clean.

## Gate G24
- **Satisfied (machine):** schemas (3 kinds + fixture), migrations (registry +
  edges + fixture), commit matrix (10 reasons), battle resume (150-tick
  interval + golden), transfer (limits + 17-case corpus), recovery (8 rows),
  test suites.
- **BLOCKED (operator):** real G23 proof upstream, native transfer device
  evidence, battle-resume device evidence and recovery-UX device evidence.
  None are tool-self-certifiable.

## Handoff to Phase 25
Phase 25 may build renderer/context-loss integration on these ports, but must
not use helper-package QA as repository or device evidence. The migration
registry, commit matrix, golden resume hashes, transfer security matrix and
recovery decisions are the pinned contracts to extend.
