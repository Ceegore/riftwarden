# Riftwarden — Continuation Prompt (paste into a new chat)

Continue the Riftwarden development project in this repository (Freebuff
desktop, working tree at `C:/Projects/_sortiert/Riftwarden`). I implement the
phases of the Riftwarden development plan sequentially. Read all context below
before acting.

## Where we are (verified 2026-08-22)

- Working tree is **CLEAN** (`git status --porcelain` is empty).
- Branch: `feat/09-content-schemas-sourceformat-und-compilerg` (long-lived
  feature branch for all phase work — **do not switch branches**).
- HEAD: `e3f863f` (Phase 31 milestone report). Phases 1–31 are implemented in
  clean committed milestones. Phase 31 (profile management & economy pure
  layer) just landed; Phase 32 is the next milestone.
- Every phase ships: production code under `src/game/` (or `tools/`), a vitest
  project + gate scripts in `package.json`/`vitest.config.ts`,
  contracts/fixtures under `contracts/phaseNN/`, a readiness validator at
  `tools/sim/validate-phaseNN-readiness.mjs` with
  `contracts/phaseNN/phaseNN-readiness.expected.json`, and a report at
  `docs/reports/phaseNN-report.md`.

## The phase kit (authority)

- Phase handbooks live in `Phasen/Phase_NN/RIFTWARDEN_PHASE_NN_UMSETZUNGSHANDBUCH.md`
  (German).
- Implementation packages are in
  `Phasen/Phase_NN/entpackt/Riftwarden_Phase_NN_Umsetzungspaket/...`:
  contracts/*.md + `contracts/phaseNN-constants.json` (binding),
  `fixtures/*.json` (pinned golden vectors), `starter-kit/src/*.ts` (compact
  reference implementations to PORT, not verbatim copies — adapt to repo
  conventions), `native-skeletons/`, `handoff/` (Phase NN→NN+1 contract),
  `PACKAGE_MANIFEST.json` (hash-pinned).
- Read `00_README_FIRST.md`, `01_STATUS_AND_NON_ASSUMPTIONS.md`,
  `02_PHASE31_SOURCE_MAP.md` (or the matching NN) and the handbook before
  writing code.
- Kits may arrive with broken archives: Phase 30's `.zip` was a 0-byte stub
  (the `.part` file was genuine). If the entpackt tree is empty, extract the
  zip (or `.part`) yourself and verify every file against
  `PACKAGE_MANIFEST.json` hashes. One starter `run-tests.ts` file has mismatched
  in every kit since 27 — that specific benign single-line formatting
  difference is expected; anything else mismatching is a real integrity issue.

## Repository conventions (must match — these gates fail otherwise)

- TypeScript strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
  (never write `activeBannerId: undefined` — omit the key instead),
  `noPropertyAccessFromIndexSignature` (use `record['key']`), no non-null
  assertions (eslint error), no template literals with numbers (use
  `String(x)`), no void-expression arrow shorthands (`() => { fn(); }` not
  `() => fn()` — eslint `no-confusing-void-expression`), no unnecessary
  `as` casts (cast through `as unknown as T` only when the value genuinely
  doesn't overlap), dot-notation where possible, `Array<T>` is forbidden
  (use `T[]`).
- Import paths use `.js` suffixes. New code must not import `node:crypto` in
  `src/` (browser-safe: use `src/game/sim/snapshot/sha256.ts` sync
  `sha256Hex`). No wallclock/`Date.now`/`Math.random` as authority, no
  `localeCompare` for canonical ordering, no new runtime deps/permissions.
- File-length gate: maintained files must stay below 501 lines
  (`pnpm check:file-length` fails otherwise). Split test files proactively.
  The formatter (`node tools/format/write-format.mjs`) normalizes JSON/md/ts.
- `pnpm typecheck` and `pnpm lint` must be clean before committing.
- Validators that check a pinned revision/constant must accept
  `unknown`-shaped input (declare `asserts input is T`) so the range check is
  not flagged as `no-unnecessary-condition`; see
  `src/game/profile/profile-validator.ts` for the pattern.
- Bridge to real browser infra: Playwright webServer is
  `vite --mode qa --port 4174 --strictPort` (config `playwright.harness.config.ts`).
  On Windows the first cold transform of the full Pixi import graph can exceed
  the 30 s `page.goto` default — rerun once or warm the server before
  concluding a harness test is broken.

## Gate commands (full suite)

`pnpm typecheck`, `pnpm lint`, `node tools/format/check-format.mjs`,
`pnpm check:file-length`, `npx vitest run` (228 files / ~2681 tests),
`node --test tests/sim/*.test.mjs tests/rules/*.test.mjs` (72 tests),
`node tools/sim/audit-kernel-imports.mjs` (0 findings),
`node --test tests/sim/source-policy.test.mjs` (6/6),
`pnpm test:e2e:harness` (17 tests), `pnpm build:release`
(revert `docs/reports/build-release-hashes.json` after — build artifact).
Per-phase: `pnpm test:phaseNN`, `pnpm phaseNN:gate`, and golden checks via
`phaseNN:golden:check` where present (phase26/28/31).

## The established phase workflow (follow exactly)

1. QA the previous phase (paranoid; compare against the handbook/contracts;
   run its `phaseNN:gate`). If any medium+ issue found, stop and report; minor
   issues fix and proceed.
2. Read the kit for the current phase; port contracts + fixtures into
   `contracts/phaseNN/` (byte-identical via copy).
3. Implement in clean modules ≤300 lines each, using starter-kit reference
   semantics adapted to repo conventions.
4. Write fixture-driven tests (read the pinned fixtures, assert against them)
   plus property/fault tests. Wire the vitest project in `vitest.config.ts`
   and scripts in `package.json` (`test:phaseNN`, `phaseNN:gate`,
   `phaseNN:validate-readiness`, golden `write`/`check` where applicable).
5. Write `validate-phaseNN-readiness.mjs` + `phaseNN-readiness.expected.json`
   (evidence paths root-relative) + `phaseNN-report.md`; the validator prints
   machine-satisfied items and appends the operator hard blockers from the
   expected contract, exiting 0 when only operator codes block.
6. Run ALL gates until green; commit in clean milestones (production code /
   tests+contracts / e2e / docs) with the exact footer:
   "Generated with Codebuff 🤖" + "Co-Authored-By: Codebuff <noreply@codebuff.com>".
7. Readiness gates report **BLOCKED only on operator-side evidence** (upstream
   proof, real device runs, browser re-runs) — never claim PASS on
   machine-verifiable items alone.

## Gate state (as of Phase 31)

- G25–G31 are each **BLOCKED on operator codes only**; every machine-verifiable
  item is satisfied (G31: 11 machine items, 8 operator blockers). The chain
  G29 → G30 → G31 → Phase 32 cannot progress without real-device operator
  evidence (adb shows no device, no AVDs in this environment). Machine work
  continues per the stop-gate: pure contract layers ship as authoritative
  design; screens/device evidence stay behind the gate.
- Recent layers: Phase 30 `src/game/app-shell/` (routes, settings domain,
  link policy, HQ capabilities, action ledger, first-run, continue),
  Phase 31 `src/game/profile/` (types, integer, validator, derived-stats,
  transaction-service, transaction-flow, collection-state, compatibility).
- Golden harnesses: phase26 (speed/pause HUD), phase28 (map seeds + 10k gate),
  phase31 (derived-stats 10k sweep) — the pattern (Vite SSR bundle + pinned
  registry + CI wrapper) is directly reusable for future phases.

## Immediate next steps

1. Scope Phase 32 from `Phasen/Phase_32/` (handbook + `00_README_FIRST.md` +
   `02_PHASE32_SOURCE_MAP.md` + handoff contract) → write
   `docs/reports/phase32-input-contract.md`.
2. Execute the workflow; commit in clean milestones; end with a report +
   follow-up prompts.

## Ground rules

- Never run destructive git ops (push/reset/checkout of others' work). Only
  commit what you created. Check `git status`/branch before consequential ops;
  other agents/user may edit the same tree.
- `run-gradle.mjs` has a Windows fix: spawn `gradlew.bat` through `cmd //c
  ".\gradlew.bat ..."` (bare-name EINVAL bug) — preserve POSIX behavior.
- Keep prose replies short; the user watches a live transcript.
