# Phase 31 Report — Profile Management & Economy Contract Layer (machine milestone)

Status date: 2026-08-22 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.
Gate: **G31 BLOCKED on operator evidence only** — all 10 machine items
satisfied; the 8 blockers are operator-side (upstream G30 proof, device
renders, a11y protocols, device visual goldens, full-app browser E2E,
performance, shipped release-count content, real save migrations). Per the
handbook stop rule, no PASS is claimed on machine items alone.

## Scope (kit authority)

Per `docs/reports/phase31-input-contract.md` and the Phase 31 handbook, the
S15–S24 screens, the real 10/18/42/6 content data, device/accessibility/
performance evidence and real save migrations stay operator-side behind the
G30 gate. This milestone implements the pure profile contract layer —
authoritative implementation design, exactly as Phases 25–30 were prepared.

## Production layer (`src/game/profile/`, 9 modules)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | 63 | Profile revision 31, wallet, heroes (level 1–3, fame, equipmentId), troops (contract I–III, copies with stable instanceId + kitId), items (owned/polished/ownerId/isBanner), activeBannerId, transactionLedger, 7 closed transaction kinds |
| `integer.ts` | 27 | Non-negative safe integer guards, `mulPermilleFloor` (single documented rounding) |
| `profile-error.ts` | 33 | Closed `ProfileErrorCode` union (11 codes) |
| `profile-validator.ts` | 82 | Revision pin, non-negative values, hero/contract level ranges, ≤3 copies per troop type, unique instance ids, valid item/banner references — invalid references rejected, never repaired |
| `derived-stats.ts` | 31 | Pure deterministic derivation: level → equipment → other modifiers, integer-only, single rounding per stage |
| `transaction-service.ts` | 66 | Exactly-once `commitTransaction`: replayed ids return the stored result with zero mutation; insufficient funds record REJECTED; throwing mutations leave the old complete state |
| `transaction-flow.ts` | 55 | Five kill points in canonical order with mutation semantics (none / old_or_new_never_partial / committed_once) |
| `collection-state.ts` | 40 | Canonical id sort (never localized), serializable filter + scroll anchor restore |
| `compatibility.ts` | 29 | Hero-equipment / troop-kit compatibility with visible `ui.compatibility.*` reason keys — no dead picker targets |

No new runtime dependency; no wallclock/Math.random as authority; browser-safe.
All files far below the ≤300-line budget.

## Contracts + fixtures (`contracts/phase31/`)

Ported byte-identical from the kit: `phase31-constants.json` and eight
fixtures (transaction-cases 4, kill-point-matrix 5, derived-stat-cases 2,
compatibility-cases 3, collection-state-cases 2, profile-minimal,
profile-full-shape, screen-matrix 10).

## Golden harness (`contracts/phase31/golden-registry.json`)

`tools/sim/phase31-golden-harness.mjs` bundles derived-stats + integer through
Vite SSR, pins both kit cases byte-for-byte, and runs a 10,000-input
deterministic permutation sweep proving every result is a non-negative safe
integer with the documented stage order — **0 failures**. Kernel source hash
pinned; `phase31:golden:write/check` scripts + `tests/sim/phase31-golden.test.mjs`
CI wrapper.

## Tests (`tests/sim/phase31-*.test.ts`, 4 suites / 35 tests + 2 golden)

- `phase31-contracts.test.ts` (9) — constants vs validator alignment, S15–S24
  screen matrix, five kill points, pinned derivations.
- `phase31-profile-validator.test.ts` (11) — minimal/full shapes, revision/
  non-object faults, negative values, level ranges, invalid references, copy
  limit, duplicate instance ids, active-banner rules.
- `phase31-transaction.test.ts` (9) — the four pinned cases (buy-ok,
  insufficient, duplicate-callback, commit-failure), 100-commit single-id
  exactly-once, immutable ledger records, insufficient-never-mutates,
  committed-profile validation.
- `phase31-collection.test.ts` (6) — pinned collection states, canonical
  sort determinism, anchor restore, all compatibility pairings with visible
  reasons.

## E2E (real Chromium)

The browser harness (`harness.html`) now drives the profile domain: the four
pinned transaction cases replay with identical wallet deltas in the browser
bundle (30/0/25/0), the duplicate callback commits once and replays, the
commit failure leaves the old state untouched, all five kill points record in
canonical order, and the final profile validates with a 1-entry ledger.
`pnpm test:e2e:harness`: **17/17 pass** (2 context-loss + 13 visual + slice
E2E + profile transactions).

## Readiness gate

`tools/sim/validate-phase31-readiness.mjs` + `contracts/phase31/phase31-readiness.expected.json`:
10 machine items satisfied, 8 operator blockers reported. Scripts wired:
`test:phase31`, `phase31:golden:write/check`, `phase31:validate-readiness`,
`phase31:gate`.

## Machine evidence (all run on this machine)

- `pnpm typecheck` — clean
- `pnpm lint` — clean
- `node tools/format/check-format.mjs` — clean
- `pnpm check:file-length` — clean
- `npx vitest run` — full suite green (see phase totals below)
- `node --test tests/sim/*.test.mjs tests/rules/*.test.mjs` — green
- `node tools/sim/audit-kernel-imports.mjs` — 0 findings
- `node --test tests/sim/source-policy.test.mjs` — green
- `pnpm build:release` — OK (artifact reverted)
- `pnpm test:e2e:harness` — 17/17

## G31 status

**BLOCKED by design** on the 8 operator codes (G30/architecture proof, device
renders, screenreader protocols, device visual goldens, full-app browser E2E,
device performance, shipped release-count content, real save migrations). All
10 machine-verifiable items are satisfied; no PASS is claimed on machine
items alone per the stop rule.

## Files

- Production: `src/game/profile/` (9 modules, ~426 lines)
- Contracts: `contracts/phase31/` (constants + 8 fixtures + golden registry + readiness)
- Tests: `tests/sim/phase31-{helpers,contracts,profile-validator,transaction,collection,golden}.ts`
- Harness: `harness.html` + `src/screens/dev/harness-main.ts` + spec additions
- Validator: `tools/sim/validate-phase31-readiness.mjs`
- Wiring: `vitest.config.ts` project `phase31`, package.json scripts
