# Phase 23 Report — Atomic Save Persistence Foundation

**Gate: G23 — BLOCKED on operator evidence (machine evidence complete)**

Phase 23 builds the platform-native atomic persistence foundation: canonical
bytes, envelope validation, A/B/C slot rotation with a manifest commit
protocol, a serialized write coordinator, a Web QA store, and the native
plugin surface. Domain save schemas, migrations and battle-recovery matrices
belong to Phase 24.

## What landed

### P23-T01 — Canonical JSON + SaveEnvelope (`src/game/save/`)
- `canonical-json.ts`: UTF-8, LF, no pretty whitespace, object keys sorted by
  stable code-unit comparison, arrays untouched. Rejects NaN, ±Infinity, -0,
  BigInt, undefined, functions, symbols, cycles and non-plain objects. Finite
  floats are allowed (distinct from the stricter replay safe-integer
  contract, matching the kit).
- `save-envelope.ts`: closed ten-field envelope
  (`RIFTWARDEN_SAVE` / formatVersion 1), unknown fields rejected, safe
  non-negative integer versions and commitId, canonical payload SHA-256
  recomputed and compared. Hash uses the repo's dependency-free sync SHA-256
  (browser-safe, no `node:crypto`).
- Golden canonical vectors (key-order, nested, unicode), negative cases and
  hash determinism verified against the pinned kit fixtures.

### P23-T02 — Slot/Manifest Protocol (`src/game/save/native-save-store.ts`)
- A/B/C rotation with the twelve-step fault-injectable commit protocol:
  exclusive tmp write → flush → reread → hash/validate → atomic rename →
  dir flush → `manifest.new` write/flush → reread → validate → atomic
  manifest rename → dir flush → success.
- Any injected fault before the manifest rename leaves the previous valid
  manifest and its active slot loadable (verified for all twelve steps).
- Loader: manifest authoritative; on invalid manifest/slot, falls back to the
  highest valid commitId (never timestamp). Stale tmp/new orphans are
  discarded on the next commit and cleaned by `cleanupOrphans`.
- Closed DTOs: `SaveFamily`, `Slot`, `SaveManifest`, `CommitRequest`,
  `CommitResult`, and the twelve stable `SaveError` codes.

### P23-T03/T04 — Native plugin surface (`android/…/NativeSaveStorePlugin.java`, `ios/…/NativeSaveStorePlugin.swift`)
- Both adapters now declare the closed Phase-23 port methods (`commit`,
  `load`, `inspect`, `cleanupOrphans`) alongside the Phase-04 bridge surface,
  rejecting unknown families with `INVALID_ARGUMENT` and keeping stable error
  codes. `verify-plugin-contracts` and `verify-native-config` pass.
- Device fault-matrix runs, native compilation and platform durability
  evidence are operator-side (G23 checklist, mirroring G20–G22).

### P23-T05 — Web QA Store (`src/game/save/web-qa-store.ts` + web mock)
- In-memory store emulating slots, manifest, fault steps and stable error
  codes with parity against the file store (identical slot rotation and error
  codes). The web channel now wires the WebQaStore behind the
  `NativeSaveStorePlugin` contract; it is a QA/development tool and is never
  selected in the native production channel.

### P23-T06 — Write Coordinator (`src/game/save/save-write-coordinator.ts`)
- At most one active write; FIFO for all non-coalescable transactions.
  Only waiting battle-snapshot requests of the same family coalesce onto the
  newest tick (the superseded caller observes the newest written result);
  purchases, rewards, profile, run and settings transactions are never
  dropped. `close()` rejects new work with `QUEUE_CLOSED`; failures propagate
  to every affected caller.

## Tests
- `tests/sim/phase23-save-core.test.ts` (54 tests): canonical golden/negative
  vectors, envelope hash/unknown-field/commitId checks, A→B→C→A rotation,
  manifest consistency, corrupt manifest/slot fallback, fault at every step
  with previous-slot loadability, web/file parity, coordinator serialization,
  snapshot coalescing, family isolation, closed error codes.
- `tests/sim/phase23-contract-fixtures.test.ts` (16 tests): pinned kit
  constants, golden canonical bytes, all 14 negative cases, fault-matrix
  expectation/platforms, 1000-request mixed concurrency without loss, newest-
  waiting-tick coalescing, cross-family isolation.
- 70 vitest tests green; typecheck/lint/format clean; native plugin contract
  verification PASS.

## Gate G23
- **Satisfied (machine):** canonical vectors + negatives, envelope, slot
  protocol (12 fault steps), coordinator, web parity, native plugin surface,
  test suites.
- **BLOCKED (operator):** real G22 proof upstream, Android API24+/current
  device fault matrix, iOS15+/current device fault matrix, and native
  compilation verification. None are tool-self-certifiable.

## Handoff to Phase 24
Phase 24 builds domain profile/run/settings schemas, migrations, battle
snapshots, import/export and the recovery matrix on top of these canonical
bytes, envelope contract, A/B/C manifest protocol and coordinator semantics.
It must not use helper-package QA as native evidence.
