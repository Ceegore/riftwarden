# Phase 33 — Mission Domain

**Status:** IMPLEMENTED (machine-verified). Gate G33: BLOCKED on operator evidence.

## Scope

Phase 33 implements the mission domain: a catalog of expeditions with unlock
chains, difficulty tiers, gold multipliers, instability rates, and map profile
references. Missions are selected from the New Game screen or Mission Board
and define the generated expedition.

## Delivered

| Artifact | Path |
|---|---|
| Mission definitions | `src/game/mission/mission-definitions.ts` |
| Mission store | `src/game/mission/mission-store.ts` |
| Mission types | `src/game/mission/types.ts` |
| Mission board screen | `src/screens/hq/MissionBoardScreen.tsx` |
| Mission details screen | `src/screens/hq/MissionDetailsScreen.tsx` |
| Test suite | `tests/sim/phase33-mission.test.ts` |
| Contracts | `contracts/phase33/` |

## Gate Status

- G33 machine items: 3/3 SATISFIED
- G33 operator items: 3 BLOCKED (G32 gate chain, device render, balance review)

## Next

Wire mission completion rewards through the settlement bridge (Phase 36).