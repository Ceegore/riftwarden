# Phase 26 Report — Battle HUD, Pause/Speed, Inspector, Accessibility and Tactical Text Contract Layer

**Gate: G26 — BLOCKED on operator evidence (machine evidence complete)**

Phase 26 prepares the battle HUD (S51), unit inspector (S52), pause/speed
lifecycle, accessibility tree and tactical text view as an **authoritative
implementation design**: a pure, read-only presentation contract layer in
`src/game/hud/` built on the Phase 25 render ports. No React screen, new
dependency, permission or simulation mutation was introduced — the handbook's
stop-gate (real G25 evidence) keeps the actual UI behind operator evidence,
while every machine-verifiable contract is pinned and green.

## What landed

### Types and mutation guard
- `types.ts`: `Side`, canonical `Lane`, closed `SpeedPercent` (50/100/200/300),
  the 5-state `PauseState`, `PresentedEntity`, `WarningItem` and the closed
  9-kind `AnnouncementKind` with `AnnouncementEvent`.
- `hud-error.ts`: closed `HudErrorCode` union (INVALID_SPEED,
  INVALID_TICK_INPUT, INVALID_ANNOUNCEMENT) with diagnostic details.
- `mutation-guard.ts`: recursive `deepFreeze` — a deliberately mutating
  presentation adapter must fail loudly.

### Pause/speed/lifecycle (`pause-controller.ts`)
- `parseSpeed` accepts exactly 50/100/200/300 and rejects everything else.
- `RUNNING → PAUSE_REQUESTED → PAUSED` (pause confirmed at the next safe
  tick), resume only through `BLOCKED_UNTIL_READY → RESUME_REQUESTED →
  RUNNING`; **never automatic**. Repeated inputs are idempotent (rapid taps
  yield at most one pending request).
- Speed/pause hash invariance: a deterministic 400-tick driver proves every
  pinned speed×pauseAtTick case (16 in the fixture) consumes the identical
  tick sequence and ends on the same checkpoint/end hash — pause never
  skips, duplicates or reorders sim ticks.

### Semantic ordering (`stable-order.ts`)
- Entities: player side before enemy, lane canonical (TOP/MIDDLE/BOTTOM),
  front X, stable id — matches the `semantic-order-golden.json` and is stable
  under input permutation.
- Warnings: due tick, descending severity, lane, front X, stable event id.
- `filterActiveWarnings`: expired warnings disappear deterministically.
- Code-unit comparison only — never `localeCompare`.

### Live region (`live-region.ts`)
- Exactly the four pinned announce kinds (BATTLE_PHASE, PLAYER_UNIT_LOST,
  CRITICAL_BOSS_WARNING, BATTLE_ENDED); damage/heal/shield/target/status
  ticks are never announced.
- Pure `filterAnnouncements` (kind + pre-seen ids) and a stateful
  `createLiveRegionFilter` that deduplicates by stable event id and a
  presentation-only cooldown window (in authoritative ticks) — authoritative
  events are never lost.
- Malformed announcements fail with a closed code.

### Time formatting (`time-format.ts`)
- `remainingSeconds` derives "in N seconds" exclusively from tick difference
  and the authoritative tick rate; past-due clamps to "now" (zero).
- `formatTenths` keeps the displayed duration within the pinned
  `maxDurationDisplayErrorMs = 100` bound across tick rates 15/30/60.

### Inspector selection (`selection.ts`)
- Deterministic fallback when the selected entity disappears: next entity of
  the sorted list, else the first other entity, else the empty state — the
  single-element pinned case resolves to empty. (Divergence from the
  starter-kit's "previous entity" for the removed-last case is documented;
  the handbook is the primary authority and all pinned fixture cases agree.)

## Tests (50 vitest tests, `--project phase26`)
- `phase26-contracts.test.ts` (13): pinned constants, layout/live-region/
  speed-pause matrices, semantic-order golden, selection matrix, warning
  timeline boundaries.
- `phase26-pause-speed.test.ts` (7): closed speeds, full lifecycle with
  not-ready resume, no auto-unpause, rapid-tap idempotency, background pause,
  hash invariance across all 16 pinned cases, exact frozen-tick resume.
- `phase26-stable-order.test.ts` (10): entity/warning ordering, tie breaks,
  permutation invariance, expiry, locale-independent code-unit comparison.
- `phase26-live-region.test.ts` (8): announce/suppress matrix, id dedupe,
  cooldown window, authoritative events never lost, validation.
- `phase26-time-selection.test.ts` (12): pinned boundaries, negative clamp,
  invalid inputs, 0.1 s display-error bound sweep, fallback matrix + edge
  cases + vectors.

typecheck/lint/format/file-length clean.

## Gate G26
- **Satisfied (machine):** constants, pause/speed lifecycle + 16-case matrix,
  stable order golden, live-region matrix, warning timeline boundaries, 0.1 s
  display bound, selection fallback, mutation guard/types, layout matrix,
  5 test suites.
- **BLOCKED (operator):** real G25 proof upstream, real S51/S52 UI device
  render, TalkBack/VoiceOver screenreader protocols, device visual goldens,
  browser E2E and device performance measurements. None are
  tool-self-certifiable.

## Handoff to Phase 27
Phase 27 may build formation/pre-battle disclosure only on proven read-only
battle-UI and navigation contracts. The pinned contracts to extend: closed
speeds, pause/lifecycle matrix, semantic ordering goldens, live-region
announce kinds and the G26 evidence checklist
(`Phasen/Phase_26/.../evidence/GATE_G26_CHECKLIST.md`).
