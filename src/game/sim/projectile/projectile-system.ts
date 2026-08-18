import type { KernelSystem, TickContext } from '../core/tick-context.js';
import type { KernelEntity } from '../core/entity.js';
import type { X100 } from '../geometry/x100.js';
import { forecastTravelTicks, sampleImpactTargets, stepProjectile, type ProjectileState } from './projectile-state.js';
import { PROJECTILE_COVER_REDUCTION_BPS, type PendingCombatApplication } from '../combat/combat-application.js';

/**
 * Stage-H projectile system (§P17-T02 §6/§7). Movement advances exactly once
 * per tick; impact is sampled exactly once and the projectile is marked
 * resolved before follow-up commands are queued. Hits queue damage
 * applications for stage I (stage H never mutates LP/shields itself).
 * Projectile cover reduction is the Phase-16 12% contract unless the attack
 * is piercing or coverIgnoring.
 */
export function createProjectileSystem(): KernelSystem {
  return {
    id: 'phase17.h1.projectile',
    stage: 'H',
    run(context: TickContext): void {
      const projectiles = context.state.projectiles ?? Object.freeze([]);
      if (projectiles.length === 0) return;
      const spawnEvents: { id: string; impactTick: number }[] = [];
      const next: ProjectileState[] = [];
      let changed = false;
      for (const projectile of projectiles) {
        if (projectile.resolved) {
          next.push(projectile);
          continue;
        }
        if (projectile.spawnTick === context.state.tick) {
          spawnEvents.push({ id: projectile.id, impactTick: projectile.spawnTick + forecastTravelTicks(projectile) });
        }
        const target = context.state.entities.find((e) => e.id === projectile.targetId);
        const step = stepProjectile(projectile, target, context.state.tick);
        if (step.state.resolved && step.impactAt !== null) {
          queueImpact(context, step.state, step.impactAt, target);
        }
        if (step.state !== projectile) changed = true;
        next.push(step.state);
      }
      if (spawnEvents.length > 0 || changed) {
        context.commands.push({ kind: 'set_projectiles', projectiles: Object.freeze(next) });
      }
      for (const spawn of spawnEvents) {
        context.commands.push({
          kind: 'append_event',
          event: Object.freeze({
            type: 'ProjectileSpawned',
            sourceId: null,
            targetIds: Object.freeze([]),
            contentIds: Object.freeze([]),
            payload: Object.freeze({ impactTick: spawn.impactTick }),
            logTags: Object.freeze(['sim.phase17']),
          }),
        });
      }
    },
  };
}

function queueImpact(context: TickContext, projectile: ProjectileState, impactX100: X100, committedTarget: KernelEntity | undefined): void {
  const source = context.state.entities.find((e) => e.id === projectile.sourceId);
  if (source === undefined) return;
  const targets = sampleImpactTargets(impactX100, projectile.lane, context.state.entities, source.side);
  const coverReductionBps = projectile.coverIgnoring || projectile.piercing ? 0 : PROJECTILE_COVER_REDUCTION_BPS;
  for (const target of targets) {
    if (target.phase.phase !== 'ACTIVE') continue;
    const application: PendingCombatApplication = Object.freeze({
      kind: 'damage',
      sourceId: projectile.sourceId,
      targetId: target.id,
      effectId: `projectile_${projectile.id}`,
      attackInstanceId: projectile.attackInstanceId,
      effectIndex: projectile.effectIndex,
      rawAmount: projectile.rawAmount,
      damageTypeOrdinal: projectile.damageTypeOrdinal,
      defense: projectile.defense,
      coverReductionBps,
      bossCapBps: projectile.bossCapBps,
    });
    context.commands.push({ kind: 'queue_combat_application', application });
  }
  void committedTarget;
}
