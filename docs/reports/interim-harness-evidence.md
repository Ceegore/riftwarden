# Interim Harness Evidence (G25/G26 machine-closeable gaps)

Status date: 2026-08-20 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.

This report covers the three cross-cutting deliverables that close the
machine-closeable portions of the G25/G26 operator-evidence gaps. The gates
themselves remain BLOCKED: certification is operator-side (real-device runs,
visual goldens, performance measurement). These harnesses turn each blocker
into a one-command, reproducible run.

## 1. Speed/pause golden harness (`tools/sim/phase26-golden-harness.mjs`)

- Bundles the Phase 26 HUD kernel (`src/game/hud/pause-controller.ts`) through
  the same Vite SSR pipeline as the existing sim goldens and replays all 17
  pinned speed/pause cases from `contracts/phase26/golden/registry.json`.
- Proves hash invariance: every case — including pause/resume cycles, the
  0.5×–3× speed bounds and the idempotent pause-confirm at the next safe tick —
  ends on the identical sequence hash and end hash.
- Wiring: `phase26:golden:write` / `phase26:golden:check` scripts; a gate
  wrapper test at `tests/sim/phase26-golden.test.mjs` pins the registry in CI.
- Evidence: `contracts/phase26/golden/registry.json` (committed, 17 cases).

## 2. Pixi scene-graph adapter (`src/game/render/scene-graph.ts` + `src/features/battle-render/`)

- Pure, renderer-free scene-graph contract: fixed layers 0–7, entity/effect/
  pool nodes, visual-state transitions, code-unit stable ordering.
- Browser-only typed Pixi binding (`pixi-scene.ts`) maps the descriptor onto
  real Pixi containers; a pinned `pixi-types.d.ts` subset keeps the strict
  toolchain (`skipLibCheck: false`) clean without touching runtime resolution.
- Tested in the vitest kernel project (`tests/sim/phase25-scene-graph.test.ts`,
  14 tests, 106 phase25 total).

## 3. Real-Chromium context-loss harness (`tests/e2e/battle/context-loss-harness.spec.ts`)

- Dedicated Vite dev entry (`harness.html` → `src/screens/dev/harness-main.ts`,
  data-rw-dev-only; excluded from the app build and the release bundle).
- Drives the Phase 25 context-recovery contract against genuine Chromium
  WebGL2: capability probe, `WEBGL_lose_context` injection on the four pinned
  battle scenarios (during_cast, during_projectile, during_spawn,
  during_battle_end) plus a two-failed-rebuild `failed_safe` case.
- Fresh canvas + context per scenario (a real loss leaves the context lost,
  proving per-scene creation, teardown and rebuild from the authoritative
  snapshot). Asserts identical gameplay hashes across every rebuild.
- Wiring: `test:e2e:harness` script + `playwright.harness.config.ts` (loopback
  only, outbound requests blocked). Run: `pnpm test:e2e:harness`.

## Machine evidence (all re-run clean on 2026-08-20)

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | clean |
| `pnpm lint` | clean (task-marker contract passed) |
| `node tools/format/check-format.mjs` | passed |
| `pnpm check:file-length` | 0 errors |
| `npx vitest run` | 194 files / 2323 tests passed |
| `npx vitest run --project phase25` | 106 passed |
| `node --test tests/sim/*.test.mjs tests/rules/*.test.mjs` | 69/69 passed |
| `node tools/sim/audit-kernel-imports.mjs` | 0 findings |
| `node --test tests/sim/source-policy.test.mjs` | 6/6 passed |
| `pnpm test:e2e:harness` | 1 passed (5 scenarios, real Chromium WebGL2) |
| `pnpm phase26:golden:check` | registry matches (17 cases, identical hashes) |
| `pnpm build:release` | built; artifact reverted per convention |

## Remaining operator-side evidence (unchanged, not self-certifiable)

- Upstream G24 proof and real-device runs (Android/iOS) for the render ports.
- Device visual goldens, device leak/stress, TalkBack/VoiceOver protocols.
- Browser E2E against the full app (the harness here covers the context-loss
  path only) and device performance measurement.
- Operator-run release-bundle scan (scanner hook: RW-G25-SCAN).

All commits: `1a45b99` (golden harness), `7b11bdd` + `da98636` (scene-graph
adapter), `1c8a126` (context-loss harness).
