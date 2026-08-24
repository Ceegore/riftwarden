# Phase 34 — HQ Overview & Hub

**Status:** IMPLEMENTED (machine-verified). Gate G34: BLOCKED on operator evidence.

## Scope

Phase 34 delivers the headquarters hub: an HQ overview screen, hero hall,
barracks, workshop, item details, troop details, global help, and all
navigation wiring through the shared screen registry and post-boot router.

## Delivered

| Artifact | Path |
|---|---|
| HQ overview | `src/screens/hq/HqOverviewScreen.tsx` |
| Hero hall | `src/screens/hq/HeroHallScreen.tsx` |
| Hero details | `src/screens/hq/HeroDetailsScreen.tsx` |
| Barracks | `src/screens/hq/BarracksScreen.tsx` |
| Workshop | `src/screens/hq/WorkshopScreen.tsx` |
| Item details | `src/screens/hq/ItemDetailsScreen.tsx` |
| Troop details | `src/screens/hq/TroopDetailsScreen.tsx` |
| Global help | `src/screens/hq/GlobalHelpScreen.tsx` |
| Screen modules | `src/screens/hq/hq-screen-modules.ts` |
| Shared renderer | `src/screens/screen-renderer.tsx` |
| Post-boot router | `src/screens/PostBootScreen.tsx` |
| Tests | `tests/sim/phase34-flow.test.ts`, `tests/sim/phase34-hq.test.ts` |

## Gate Status

- G34 machine items: 2/2 SATISFIED
- G34 operator items: 3 BLOCKED (G33 chain, device render, new-game flow)