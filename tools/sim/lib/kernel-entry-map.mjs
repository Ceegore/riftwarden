/**
 * Kernel SSR entry map for the cross-runtime harness. Each named entry is
 * bundled by Vite SSR (Rolldown) and imported as an ESM chunk by
 * kernel-loader.mjs. The kernel uses only relative imports, so no aliases or
 * plugins are needed.
 */
export const ENTRY_MODULES = {
  primitives: 'src/game/sim/core/primitives.ts',
  battleKernel: 'src/game/sim/core/battle-kernel.ts',
  noopSystems: 'src/game/sim/core/noop-systems.ts',
  snapshot: 'src/game/sim/snapshot/snapshot.ts',
  random: 'src/game/sim/random/index.ts',
  events: 'src/game/sim/events/index.ts',
  migrate: 'src/game/sim/core/migrate.ts',
  phase15Systems: 'src/game/sim/core/phase15-systems.ts',
  phase16Systems: 'src/game/sim/core/phase16-systems.ts',
  phase17Systems: 'src/game/sim/core/phase17-systems.ts',
  phase18Systems: 'src/game/sim/core/phase18-systems.ts',
  phase19Systems: 'src/game/sim/core/phase19-systems.ts',
  phase20Systems: 'src/game/sim/core/phase20-systems.ts',
  phase21Systems: 'src/game/sim/core/phase21-systems.ts',
  encounterAdapter: 'src/game/sim/boss/encounter-adapter.ts',
  bossObjectManager: 'src/game/sim/boss/boss-object-manager.ts',
  abilitySystem: 'src/game/sim/ability/ability-system.ts',
  x100: 'src/game/sim/geometry/x100.ts',
  monitor: 'src/game/sim/monitor/invariant-monitor.ts',
};
