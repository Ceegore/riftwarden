# Phase 30 Report — App Shell Contract Layer (machine milestone)

Status date: 2026-08-22 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.
Gate: **G30 BLOCKED on operator evidence only** — all 10 machine items
satisfied; the 9 blockers are operator-side (upstream G29 proof and
architecture GO, device renders, a11y protocols, device visual goldens,
full-app browser E2E, performance, legal texts, release URL allowlist). Per
the handbook stop rule, no PASS is claimed on machine items alone.

## Scope (kit authority)

Phase 30 completes the app shell outside battle: S02 First-Run, S03 Title,
S04 New Game, S05 Continue/Recovery, S06 Settings Hub, S07 Legal/About, S08
Global Help, S10 HQ Overview and S60–S65 Settings sub-pages. The handbook is
explicit that G30 needs real screen-state, persistence-path, input-mode,
localization and error-path evidence before it can pass — everything UI-side
stays behind the gate. This milestone implements the pure contract layer —
authoritative implementation design, exactly as Phases 25–29 were prepared.

The Phase 30 kit arrived with a broken 0-byte `Riftwarden_Phase_30_Umsetzungspaket.zip`
but a genuine `.part` file whose SHA-256 matches the pinned hash
(`49bcf820…dddc6d`, cross-checked against the QA sheet). Extracted and
installed into `entpackt/`; all 52 manifest-tracked files verify clean — the
second fully clean kit in a row (48/48 Phase 29, 52/52 Phase 30).

## Production layer (`src/game/app-shell/`, 9 modules)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | 59 | Locale DE/EN/Pseudo, text scales 100–200, ten route ids, `RouteState` (version, returnTo, focusId), `Settings` (revision monotonic) |
| `app-shell-error.ts` | 33 | Closed `AppShellErrorCode` union (12 codes) |
| `route-resolver.ts` | 60 | Boot resolution per canonical state model (fresh→first-run, corrupt→recovery, else title); `safeRoute` falls back to title, never blank; strict `parseRoute`; serializable `serializeRoute` |
| `settings-domain.ts` | 116 | `persisted`/`draft`/`effective`/`previewBaseline` separation; `SettingsSession` with validated preview, exact-cancel, atomic monotonic commit, stale-baseline guard, diagnosis for unknown enums with safe fallbacks |
| `external-link-policy.ts` | 35 | HTTPS-only scheme gate, host allowlist, release placeholder refusal (`example.`/`.invalid`/`placeholder`) — no WebView |
| `hq-capabilities.ts` | 51 | Exactly-six-area registry validation (duplicate/route/reason checks), read-only lookup, routeability from capability state |
| `action-ledger.ts` | 25 | Idempotent action tokens: exactly-once per id, repeat returns undefined, `clear` for confirmed retries |
| `first-run.ts` | 87 | Kill-point recording per the pinned matrix (before/after settings, before/after completion), idempotent completion marker (failing write leaves flow incomplete and retryable), no half-completed first run |
| `continue-resolver.ts` | 60 | Save-class decision by priority battle > run > profile > recovery > none; pinned primary labels (resume-battle / continue-run / continue-hq / recovery / new-game) |

No new runtime dependency; no wallclock/Math.random as authority; browser-safe
(no node:crypto). All files far below the ≤300-line per-screen budget.

## Contracts + fixtures (`contracts/phase30/`)

Ported byte-identical from the kit: `phase30-constants.json` and seven
fixtures (route-matrix 4, continue-save-matrix 5, settings-cases 6,
external-link-cases 4, hq-capabilities 6, kill-point-matrix 9, visual-matrix
18).

## Tests (`tests/sim/phase30-*.test.ts`, 3 suites / 38 tests)

- `phase30-contracts.test.ts` (18) — constants + ten route ids, four route
  cases incl. boot states and blank-screen fallback, five continue classes
  with pinned primaries + priority resolution, four link security cases
  (host/scheme/placeholder refusals), six HQ areas + registry fault codes.
- `phase30-settings.test.ts` (11) — the six pinned settings cases
  (defaults, draft-cancel, apply-ok, write-failure, unknown-enum,
  reset-confirm), stale-baseline guard, 10000 sequential applies with strict
  monotonic revision, idempotent validation projection, lossless cancel.
- `phase30-flow-ledger.test.ts` (9) — nine pinned kill points in canonical
  order, kill-point recording, exactly-once completion marker, failing-write
  retry, atomic settings apply, action-ledger exactly-once/clear/independence.

## Readiness gate

`tools/sim/validate-phase30-readiness.mjs` + `contracts/phase30/phase30-readiness.expected.json`:
10 machine items satisfied, 9 operator blockers reported. Scripts wired:
`test:phase30`, `phase30:validate-readiness`, `phase30:gate`.

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

## G30 status

**BLOCKED by design** on the 9 operator codes (G29/architecture-GO proof,
device renders, screenreader protocols, device visual goldens, full-app
browser E2E, device performance, legal texts, release URL allowlist). All 10
machine-verifiable items are satisfied; no PASS is claimed on machine items
alone per the stop rule.

## Files

- Production: `src/game/app-shell/` (9 modules, 526 lines)
- Contracts: `contracts/phase30/` (constants + 7 fixtures + readiness)
- Tests: `tests/sim/phase30-{helpers,contracts,settings,flow-ledger}.ts`
- Validator: `tools/sim/validate-phase30-readiness.mjs`
- Wiring: `vitest.config.ts` project `phase30`, package.json scripts
