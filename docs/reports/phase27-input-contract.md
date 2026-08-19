# Phase 27 Input Contract Assessment — S13 Group Selection, S14 Formation, S50 Pre-Battle Disclosure

**Status: BLOCKED on operator evidence (G26 not proven). Machine-design inputs are ready.**

Source: `Phasen/Phase_27/` kit (handbook, source map, input audit, blocker
register, contracts, fixtures, evidence templates) and the Phase 26→27
handoff (`handoff/PHASE27_INPUT_CONTRACT.json`). This assessment audits the
Phase 27 entry conditions in the real repository; it claims no gate result.

## 1. Phase 27 scope (kit authority)

- S13 group selection, S14 formation editing and S50 pre-battle disclosure
  form one **atomic decision flow**.
- Domain: nine stable slots `lane_0..2 × front/middle/back`; a
  `FormationDraft` references concrete `UnitInstanceId`s, `ContentId`s and
  kit/equipment/banner/doctrine ids — no display string is identity.
  Canonical order: lane, depth, instance id. Limits: max 7 regular, max 3
  heroes, max 3 copies of one troop kind, unique hero, one unit per slot.
  Empty lane allowed; fully empty group blocks.
- Validation is pure and returns sorted finding objects: hard errors block
  apply/start, warnings only inform; every finding has a localized code and
  optional suggested action; no auto-repair, no substitution.
- Draft is persisted locally immediately; committed loadout changes only via
  a single SaveService transaction (apply or atomic start). Back/kill/
  locale/resize/route restore the draft.
- Exactly four presets: standard, defensive, offensive, named custom; full
  roundtrip; missing content is skipped and reported in stable order.
- Atomic start: lock input → revalidate sources → validate disclosure →
  idempotent start transaction id → commit the initial run/battle snapshot →
  acknowledge → navigate exactly once. Double-tap shares one pending promise;
  a save failure unlocks and stays on S50 — no battle, no partial commit.
- Input/a11y: every drag has a tap-select → tap-valid-slot alternative;
  explicit focus graph; 200 % text and pseudo locales never cover the primary
  action; rapid taps serialized.

## 2. Hard input gate: G26

`PHASE27_INPUT_CONTRACT.json` (Phase 26 kit) requires `G26` with
`gateStatus: "NOT_PROVEN"`. Real-repository G26 audit (from
`docs/reports/phase26-report.md` + `pnpm phase26:gate`):

| Evidence item | Status |
|---|---|
| Constants, pause/speed matrix, semantic goldens, live region, selection, layout matrix, test suites (9 machine items) | **Complete (machine)** |
| Real G25 proof upstream | OPEN (operator) |
| S51/S52 UI device render | OPEN (operator) |
| TalkBack/VoiceOver screenreader protocols | OPEN (operator) |
| Device visual goldens | OPEN (operator) |
| Browser E2E | OPEN (operator) |
| Device performance measurements | OPEN (operator) |

Consequence (kit `03_PHASE26_INPUT_AUDIT.md`): Phase 27 may currently only be
prepared as authoritative design. Before any real formation screen code, a
stop-gate must re-verify read-only render ports, the design system,
navigation, and status/event selectors in the checkout, and G26 must have
real green evidence.

## 3. Machine-proven inputs available in the repository

- **Phase 25 render contract layer** (`src/game/render/`): capability/
  lifecycle, layers 0–7, snapshot presenter, presentation clock, context
  recovery — G25 machine items all green.
- **Phase 26 HUD contract layer** (`src/game/hud/`): pause/speed lifecycle,
  semantic ordering, live region, tick time, selection — G26 machine items
  all green.
- **Phase 23/24 save layer** (`src/game/save/`): atomic NativeSaveStore,
  SaveService commit matrix, battle snapshot/resume — the atomic-start
  transaction and initial-snapshot commit build on these ports.
- **Content index and AI-preview selectors**: presence in the checkout must
  be re-verified at implementation time (P27-B02/B03: equipment/kit
  compatibility and slot unlocks come only from content-index and profile
  authority — nothing may be invented).

## 4. Kit blocker and decision register (P27)

| ID | Status | Rule |
|---|---|---|
| P27-B01 | OPEN_EXTERNAL | G26 not proven — check real evidence before implementation |
| P27-B02 | STOP_IF_AMBIGUOUS | Equipment/kit compatibility only via content-index contracts |
| P27-B03 | STOP_IF_AMBIGUOUS | Slot unlocks only via profile authority |
| P27-B04 | CLOSED_BY_SOURCE | Exactly four presets (standard/defensive/offensive/custom) |
| P27-B05 | CLOSED_BY_SOURCE | Missing content: skip and report; never substitute |
| P27-B06 | CLOSED_BY_SOURCE | Start atomicity: revalidate → commit → navigate, exactly once |

## 5. Hard design rules for the eventual implementation

- No economy purchases, hidden enemy mechanics, drag-only control or
  automatic formation replacement.
- Start-enabled is exactly `no hard findings && disclosure complete && no
  pending transaction`.
- Kill/back/locale/resize/route restore the draft; content/profile changes
  revalidate while preserving valid user decisions where possible.
- Save changes flow only through the SaveService; no partial commits; a
  migration hook is mandatory for preset persistence.
- File budgets: `formation-model.ts` ≤ 280, `formation-validator.ts` ≤ 300,
  `formation-draft-store.ts` ≤ 300, `formation-presets.ts` ≤ 280, screens
  ≤ 300 each; no file above 500 lines.

## 6. Recommendation

1. Keep the Phase 26/27 gates honest: G26 stays BLOCKED on the six operator
   codes above; G27 cannot claim anything until G26 is operator-proven.
2. Machine-closeable work that can proceed now without violating the
   stop-gate: (a) the speed/pause golden harness and (b) real-browser
   evidence for the pure render/HUD contract layers (context-loss harness) —
   both are in progress in this session and will feed G25/G26 evidence.
3. Formation domain code (pure `formation-model.ts` / `formation-validator.ts`
   with fixture-driven tests) is the natural next machine milestone once the
   assessment is accepted — it does not require the React screens and can be
   prepared as authoritative design exactly like Phases 25/26 were.
