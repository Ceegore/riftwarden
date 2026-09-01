# Phase 36 — Ascension, Constellation, Cycle, Beyond

**Status:** IMPLEMENTED (machine-verified). Gate G36: BLOCKED on operator evidence.

## Scope

Phase 36 delivers the prestige and meta-progression systems: ascension ranks,
constellation skill tree, cycle preparation, beyond setup, endless mode
configuration, and the rift chamber. Also wires the achievement-codex
settlement bridge so expedition outcomes record properly.

## Delivered

| Artifact | Path |
|---|---|
| Settlement bridge | `src/game/expedition/settlement-bridge.ts` |
| Ascension ranks | `src/screens/hq/AscensionRanksScreen.tsx` |
| Constellation | `src/screens/hq/ConstellationScreen.tsx` |
| Cycle preparation | `src/screens/hq/CyclePreparationScreen.tsx` |
| Beyond setup | `src/screens/hq/BeyondSetupScreen.tsx` |
| Endless setup | `src/screens/hq/EndlessSetupScreen.tsx` |
| Rift chamber | `src/screens/hq/RiftChamberScreen.tsx` |
| Endless checkpoint | `src/screens/run/EndlessCheckpointScreen.tsx` |
| Test suite | `tests/sim/phase36-screens.test.ts` |

## Gate Status

- G36 machine items: 2/2 SATISFIED
- G36 operator items: 4 BLOCKED (G35 chain, ascension balance, constellation, endless playtest)
