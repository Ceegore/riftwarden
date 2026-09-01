# Phase 28 Input Contract Assessment — Dungeon Map, Node Flow, Expedition Minimum (S40/S41/S49)

**Status: BLOCKED on operator evidence (G27 not proven). Machine-design inputs are ready.**

Source: `Phasen/Phase_28/` kit (handbook, source map, input audit, blocker
register, contracts, fixtures, evidence templates) and the Phase 27→28
handoff (`handoff/PHASE28_INPUT_CONTRACT.json`). This assessment audits the
Phase 28 entry conditions in the real repository; it claims no gate result.

## 1. Phase 28 scope (kit authority)

- Minimal production-ready expedition framework for the vertical slice:
  deterministic dungeon maps, immutable run state, reachability, transactional
  node flows, S40 map, S41 node preview and S49 anchor minimum.
- Map: six logical levels, stable node/edge IDs (independent of render order),
  target visit length 5–8, mandatory roles anchor/preparation/boss on a valid
  route, start→boss always reachable. Generator: max 50 attempts, then the
  profile's versioned fallback template; mandatory rules are never relaxed.
  All randomness is resolved through authorized streams and materialized in
  the result — a restart must not reroll route or offers.
- Node flow: `previewed -> entering -> entered -> resolving ->
  decision_pending -> reward_pending -> exiting -> completed`; every durable
  boundary has transactionId, expected run revision, payload hash and a single
  pending lock. Commit precedes success UI/navigation; duplicate callbacks
  with identical payload are idempotent, mismatched payload under the same
  transactionId is a hard conflict; process kill resumes at the last confirmed
  boundary. Back opens pause and never leaves the expedition.
- Run domain: immutable, saveable `RunState` (schemaVersion, runId, modeId,
  missionId, mapProfileId, seed, stream states, mapHash, currentLevel,
  currentNodeId, visited/available node ids, instability, integer resources,
  secured/unsecured loot, committed formation/relic references, pending
  transaction, optional battle reference). Every transition validates the
  expected revision and transaction identity; resources never go negative;
  duplicate committed transactions return the prior receipt without mutation.
- Anchor S49: data-authorized loot securing, formation access, voluntary
  retreat and instability reduction; every action declares costs, gains,
  secured/unsecured consequences and confirmation before commit; double
  secure/retreat idempotent; storage failure leaves prior state + recovery UI.
- Node registry is closed and extensible: minimum types `battle` + `anchor`
  only; full event families (merchant, recruitment, treasure, workshop, altar,
  scout) are deliberately Phase 32 and must not be improvised here.
- Generator QA: PR gate 10,000 deterministic maps with zero structural
  violations; RC tooling prepared for 100,000 maps; deterministic worker
  partitions and merged reports sorted by case index.

## 2. Hard input gate: G27

`PHASE28_INPUT_CONTRACT.json` (Phase 27 kit) requires `G27` with
`gateStatus: "NOT_PROVEN"`. Real-repository G27 audit (from
`docs/reports/phase27-report.md` + `pnpm phase27:gate`):

| Evidence item | Status |
|---|---|
| Constants, rule/warning matrices, presets, disclosure, atomic start, modules, tests (9 machine items) | **Complete (machine)** |
| Real G26 proof upstream | OPEN (operator) |
| S13/S14/S50 UI device render | OPEN (operator) |
| TalkBack/VoiceOver screenreader protocols | OPEN (operator) |
| Device visual goldens | OPEN (operator) |
| Browser E2E | OPEN (operator) |
| Device performance measurements | OPEN (operator) |

Consequence (kit `03_PHASE27_INPUT_AUDIT.md`): Phase 28 must start with a hard
preflight and block when G27 evidence is missing. Before any real map screen
code, the stop-gate must re-verify the checkout (clean tree, SourceRevision,
lockfile hash), the formation/pre-battle layer, content world data,
SaveService, simulation/content/save versions, existing expedition types and
open P0–P2 issues.

## 3. Machine-proven inputs available in the repository

- **Phase 27 formation domain** (`src/game/formation/`): nine-slot formation
  model, validator codes, presets, disclosure selectors, draft store and
  atomic start guard — the committed-formation/relic references and the
  exactly-once initial snapshot contract that Phase 28 builds against.
- **Phase 23/24 save layer** (`src/game/save/`): atomic NativeSaveStore,
  SaveService commit matrix, canonical JSON, migration chain, battle
  snapshot/resume and recovery engine — the run-state persistence and
  pending-transaction recovery build on these ports.
- **Phase 22 sim/hash tooling**: golden-harness pattern (Vite SSR bundling of
  kernel modules) is directly reusable for the map golden-seed harness and the
  10k generator gate; `tools/sim/phase26-golden-harness.mjs` is the template.
- **Phase 13–17 deterministic RNG/snapshot infrastructure**: authorized u32
  streams (`nextU32`/`fnv1a` in the starter-kit map to repo sim primitives);
  structural hashing conventions from the snapshot layer.
- **Phase 25/26 render/HUD contract layers**: S40/S41 selection/preview
  semantics align with the Phase 26 selection/live-region contracts and the
  Phase 25 capability/lifecycle gates.

## 4. Kit blocker and decision register (P28)

| ID | Status | Rule |
|---|---|---|
| P28-B01 | OPEN-GATE | G27 not proven — check real evidence before repository work |
| P28-B02 | AUTHORITY-BOUNDARY | Full node families are intentionally absent; Phase 32, never improvise |
| P28-B03 | DATA-DEPENDENCY | Mission/map profiles must come from content data; stop when profiles are unreadable |
| P28-D01 | LOCKED | Resolve randomness at generation and persist; no restart reroll |
| P28-D02 | LOCKED | Attempt cap 50 plus fixed fallback; no automatic mandatory-rule relaxation |
| P28-D03 | LOCKED | Back never leaves the run; opens pause/overlay |
| P28-D04 | LOCKED | Anchor commits before success/navigation; no optimistic success |

## 5. Hard design rules for the eventual implementation

- No new runtime dependency, permission, network function, cloud function or
  offline progression. No wallclock-derived gameplay as authority.
- References are ids plus version references — never UI text or object
  identity. `securedLoot` and `unsecuredLoot` stay separate.
- Every run mutation is a pure reducer with `expectedRevision`; resources are
  safe integers and never negative; duplicate committed transactions return
  the prior receipt without mutation.
- Structural map hash uses canonical nodes, edges, resolved offers and profile
  revision — presentation order excluded. Error reports include seed, profile,
  revision, attempt count and structural hash.
- File budgets (handbook §13): `run-state.ts` ≤300, `run-reducer.ts` ≤300,
  `map-generator.ts` ≤300, `reachability.ts` ≤240, `node-flow.ts` ≤300,
  `node-registry.ts` ≤240, S40 ≤300, S41 ≤260, S49 ≤280, analysis tools ≤300
  each; 301–500 needs split analysis, >500 is inadmissible.
- UI/input/a11y: only currently reachable nodes are selectable; hover is
  optional; touch, keyboard and gamepad offer the same actions; DE/EN/pseudo
  and 200% text never cover a primary action.

## 6. Recommendation

1. Keep gates honest: G27 stays BLOCKED on the six operator codes above; G28
   cannot claim anything until G27 is operator-proven.
2. Machine-closeable work that can proceed now without violating the
   stop-gate: (a) the run-domain/map-generator/node-flow pure contract layer
   (`run-state`, `run-reducer`, `map-generator`, `reachability`, `node-flow`,
   `node-registry`) with fixture-driven tests — prepared as authoritative
   design exactly like Phases 25/26/27; (b) the golden-seed harness and the
   10k-map generator gate reusing the established golden-harness pattern.
3. The S40/S41/S49 screens, device integration and operator evidence stay
   behind the G27 gate; the pure layer is the machine milestone.

## Kit integrity note

49/50 Phase 28 kit files verify against the pinned manifest;
`starter-kit/src/tests/contract-tests.ts` differs from its pinned hash but its
content matches the documented semantics (single-line formatting, no
line-ending artifact) — same benign pattern as Phase 27's `model.ts`.
