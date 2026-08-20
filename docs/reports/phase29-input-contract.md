# Phase 29 Input Contract Assessment — Ash King Vertical Slice Quality Proof

**Status: BLOCKED on operator evidence (G28 not proven). Machine-design inputs are ready.**

Source: `Phasen/Phase_29/` kit (handbook, source map, input audit, blocker
register, contracts, fixtures, evidence templates) and the Phase 28→29
handoff (`handoff/PHASE29_INPUT_CONTRACT.json`). This assessment audits the
Phase 29 entry conditions in the real repository; it claims no gate result.

## 1. Phase 29 scope (kit authority)

- Phase 29 is the **first production-near quality proof**: the "Ash King"
  vertical slice must use the same architecture as the release build.
- Exactly four heroes, six troops and the authorized Act-I/Ash-King roster;
  every id must exist, be revision-bound, referentially closed and free of
  substitution logic (`SLICE_MANIFEST_CONTRACT`).
- Mandatory outputs: `vertical-slice-manifest.json` with exactly selected
  slice content; complete E2E flows without fake profiles or fake saves;
  production-near visual/audio/voice/haptic manifests with real files;
  reliability evidence (kill, corruption, resume, context loss, reward
  idempotency); performance/readability/architecture gate report; G29 only
  `PASS` or `BLOCKED` on real evidence.
- Reliability: canonical seeds across all speed×quality combinations;
  kill-injection at cast/projectile/phase/spawn/result/reward; identical end
  hashes and exactly one reward (`RELIABILITY_GOLDEN_CONTRACT`).
- Performance/architecture gate: real minimum/target devices, 30-minute runs,
  cold/warm loads, memory, draw calls, long tasks, thermals, accessibility
  and an independent GO/BLOCKED review (`PERFORMANCE_ARCHITECTURE_GATE`).
- Constants: 4 heroes, 6 troops, battle snapshot interval 150 ticks, speed
  multipliers ×5/10/20/30 (×0.5–×3), critical repeat count 10, max maintained
  file length 500 (warning at 300).

## 2. Hard input gate: G28

`PHASE29_INPUT_CONTRACT.json` (Phase 28 kit) requires `G28` with
`gateStatus: "NOT_PROVEN"`. Real-repository G28 audit (from
`docs/reports/phase28-report.md` + `pnpm phase28:gate`):

| Evidence item | Status |
|---|---|
| Constants, profiles, generator, reachability, node flow, run domain, golden registry, modules, tests (9 machine items) | **Complete (machine)** |
| Real G27 proof upstream | OPEN (operator) |
| S40/S41/S49 UI device render | OPEN (operator) |
| TalkBack/VoiceOver screenreader protocols | OPEN (operator) |
| Device visual goldens | OPEN (operator) |
| Full-app browser E2E | OPEN (operator) |
| Device performance measurements | OPEN (operator) |

Consequence (kit `03_PHASE28_INPUT_AUDIT.md` + handbook stop rule): without a
real G28 proof an implementation agent may prepare contracts, tests and
artifacts but must never report G29 as passed.

## 3. Machine-proven inputs available in the repository

- **Phase 28 expedition layer** (`src/game/expedition/`): map generator with
  golden seeds + 10k gate, run domain, node flow, closed registry — the
  `DUNGEON_MAP`/`NODE_PREVIEW`/`REWARD_OR_ANCHOR` route legs and the
  exactly-once transaction semantics the slice E2E flows drive.
- **Phase 27 formation layer** (`src/game/formation/`): formation model,
  presets, disclosure, atomic start guard — the `GROUP`/`FORMATION`/
  `PREBATTLE` route legs and the exactly-once battle-start contract.
- **Phase 25/26 render + HUD layers**: capability/lifecycle, context
  recovery, pause/speed lifecycle, selection — the `BATTLE`/`RESULT` legs and
  the reliability kill/context-loss matrix build on these ports.
- **Phase 23/24 save layer**: SaveService transactions, battle snapshot
  (150-tick interval contract), resume/recovery — the save/commit legs and
  the reward-idempotency ledger build on these ports.
- **Harness infrastructure**: the context-loss + battle-start browser harness
  and the map visual golden harness are directly reusable for the slice E2E
  and visual/audio evidence gathering; the golden-harness pattern (Vite SSR +
  pinned registries) is the template for `hash-matrix` and `commit-ledger`.

## 4. Kit blocker and decision register (P29)

| ID | Type | Status | Rule |
|---|---|---|---|
| P29-B01 | Gate | OPEN | G28 must be really proven |
| P29-B02 | Content | OPEN | Exact 4 heroes / 6 troops from the authoritative roster |
| P29-B03 | Assets | OPEN | Final formats, provenance and budgets need real files |
| P29-B04 | Audio | OPEN | DE/EN cues, subtitles and mix need real media |
| P29-B05 | Device | OPEN | Minimum/target devices must be really measured |
| P29-D01 | Decision | FORBIDDEN | Never improvise ids, mechanics, dependencies or permissions |
| P29-D02 | Decision | FORBIDDEN | No placeholder counts as a production-near PASS |

## 5. Hard design rules for the eventual implementation

- Slice manifest ids come exclusively from authorized content ids; referential
  closure and revision binding are validated, never repaired or substituted.
- E2E flows define stable route ids, entry conditions, back/lifecycle,
  commit reasons, resume targets and exactly-once battle/result/reward
  transactions — no fake profiles, no fake saves.
- Reliability goldens: canonical seeds × all speed/quality combinations end on
  identical hashes with exactly one reward; kill-injection is deterministic
  at the eight pinned boundaries.
- Performance evidence is device-measured (minimum/target), including
  30-minute runs and cold/warm loads; the architecture gate is an independent
  GO/BLOCKED review.
- File budget: no maintained file above 500 lines, warning at 300.

## 6. Recommendation

1. Keep gates honest: G28 stays BLOCKED on the six operator codes above; G29
   can never be claimed on machine items alone.
2. Machine-closeable work that can proceed now without violating the
   stop-gate: the pure slice tooling — `slice-validator` (closed roster
   validation), `route-machine` (closed E2E route order), `commit-ledger`
   (exactly-once commit kinds) and `hash-matrix` (speed×quality end-hash
   invariance) — prepared as authoritative design exactly like Phases
   25–28, plus harness extensions that turn the operator evidence items into
   one-command runs.
3. The real E2E, asset/audio, device, accessibility and performance evidence
   stays operator-side behind the G28 gate.

## Kit integrity note

All 48 Phase 29 kit files verify against the pinned manifest — the first
fully clean kit since Phase 26 (no hash mismatches).
