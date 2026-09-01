# Phase 37 — Equipment, Kits, Banners, Formations & Pixi Renderer

**Status:** IMPLEMENTED (machine-verified). Gate G37: BLOCKED on operator evidence.

## Scope

Phase 37 delivers the gear layer: equipment definitions and store, kit assembly,
banner setup, formation selection, and a PixiJS battle canvas renderer. Also
unifies screen navigation behind a shared registry-backed renderer and adds
deterministic transaction IDs for replay-safe expedition UI.

## Delivered

| Artifact | Path |
|---|---|
| Equipment domain | `src/game/equipment/` |
| Kits domain | `src/game/kits/` |
| Banners domain | `src/game/banners/` |
| Formations domain | `src/game/formations/` |
| Pixi battle canvas | `src/features/battle/BattleCanvas.tsx` |
| Pixi renderer | `src/features/battle/battle-renderer.ts` |
| Pixi animation | `src/features/battle/battle-animation.ts` |
| Equipment screen | `src/screens/hq/EquipmentScreen.tsx` |
| Kit assembly | `src/screens/hq/KitAssemblyScreen.tsx` |
| Banner setup | `src/screens/hq/BannerSetupScreen.tsx` |
| Formation screen | `src/screens/hq/FormationScreen.tsx` |
| Transaction IDs | `src/features/expedition/transaction-ids.ts` |
| Browser smoke | `tests/e2e/expedition/app-flow.smoke.spec.ts` |
| Tests | `tests/sim/phase37-domain.test.ts`, `tests/sim/phase37-determinism.test.ts` |

## Gate Status

- G37 machine items: 2/2 SATISFIED
- G37 operator items: 4 BLOCKED (G36 chain, Pixi device render, balance review, browser smoke on device)
