import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase19Systems } from '../../src/game/sim/core/phase19-systems.js';
import { createPhase20Systems } from '../../src/game/sim/core/phase20-systems.js';
import { createPhase21Systems, type Phase21RuntimeConfig } from '../../src/game/sim/core/phase21-systems.js';
import { createAbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { createSnapshot, verifySnapshot, type BattleSnapshotData } from '../../src/game/sim/snapshot/snapshot.js';
import { restoreStreamsForResume } from '../../src/game/sim/snapshot/random-resume.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import type { AbilityRuntimeDefinition } from '../../src/game/sim/ability/ability-runtime.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { Wave } from '../../src/game/sim/world/reinforcement-system.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import type { Hazard } from '../../src/game/sim/world/hazard-system.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const TOTAL_TICKS = 90;

/** Deterministic 32-bit PRNG (mulberry32) for picking resume ticks. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const phase = (id: string, min: number, max: number, priority: number, extra: Partial<PhaseDefinition> = {}): PhaseDefinition =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });

const defs: readonly PhaseDefinition[] = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2, { invulnerableTicks: 10 }),
  phase('p3', 0, 251, 3),
]);

const modifiers: readonly ModifierDefinition[] = Object.freeze([
  Object.freeze({ id: 'mod_ash_1', previewKey: 'preview_mod_ash_1', hooks: Object.freeze(['on_battle_start'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
]);

const waves: readonly Wave[] = Object.freeze([
  Object.freeze({ id: 'wave_ash_1', scheduledTick: 10, side: 'enemy', entityIds: Object.freeze(['unit_reinforce_a']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
]);

const objectives: readonly Objective[] = Object.freeze([
  Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 60, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
]);

const hazards: readonly Hazard[] = Object.freeze([
  Object.freeze({ id: 'hazard_ash_1', scheduledTick: 5, telegraphTicks: 10, resolveTick: 15, expired: false, form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull' }),
]);

const p21config: Phase21RuntimeConfig = Object.freeze({
  bossPhaseDefinitions: defs,
  modifiers,
  waves,
  objectives,
  bossCoreMechanicTags: Object.freeze(['core_phase']),
  bossAnnouncedCounterTags: Object.freeze(['dispel']),
});

/** Minimal RNG-free fireball: cast 2, recover 1, cooldown 3, 100 damage. */
function fireballDefinition(): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_fireball',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 2,
      recoveryTicks: 1,
      interruptPolicy: 'interruptible',
      usesPerBattle: 20,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 8 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx): readonly EffectCommand[] => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`,
        abilityInstanceId: ctx.abilityInstanceId,
        abilityId: ctx.abilityId,
        effectIndex: 0,
        sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity' as const, entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick,
        stage: 'I' as const,
        sourceSnapshot: ctx.source,
        sequence: 0,
        kind: 'damage' as const,
        amount: 100,
      }),
    ],
  };
}

function unit(id: string, side: 'player' | 'enemy', overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, { side, ...overrides }), radiusX100: 100 });
}

function buildBattle(): BattleModel {
  // Migration defaults origin to 'regular' (a P15 field — set only via migrate).
  const boss = unit('boss_ash_unit', 'enemy', { lane: 'middle', x100: 5000, maxLp: 1000, lp: 1000 });
  const player = unit('unit_p', 'player', { lane: 'top', x100: 1800, maxLp: 1000, lp: 1000 });
  return battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_p')]),
    bossPhase: Object.freeze({ entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null }),
    hazards,
  });
}

function fullSystems(): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase19Systems({ speedsX100PerSecond: { unit_p: 300 }, abilities: { definitions: { ability_fireball: fireballDefinition() } } }),
    ...createPhase20Systems({}),
    ...createPhase21Systems(p21config),
  ]);
}

interface TraceSlice {
  readonly checksums: readonly string[];
  readonly events: readonly string[];
  readonly state: BattleModel;
}

/** Runs `ticks` from `state` with a dedicated session and records per-tick checksums + events. */
function runFrom(state: BattleModel, random: RandomSession, ticks: number): TraceSlice {
  const systems = fullSystems();
  let current = state;
  const checksums: string[] = [];
  const events: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    checksums.push(createSnapshot(current).checksum);
    // Sequences continue from the snapshot's nextSequence on resume, so the raw
    // event strings are directly comparable to the uninterrupted run.
    for (const e of r.events) events.push(`${String(current.tick)}:${e.type}:${String(e.sequence)}:${e.sourceId ?? ''}`);
  }
  return { checksums, events, state: current };
}

describe('Phase 21 full-kernel differential resume', () => {
  it('resuming from snapshots at random ticks reproduces the uninterrupted trace byte-for-byte', { timeout: 90_000 }, () => {
    const rand = mulberry32(20260825);
    const resumeTicks = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const t = 1 + Math.floor(rand() * (TOTAL_TICKS - 10));
      resumeTicks.add(t);
    }

    // Uninterrupted reference.
    const full = runFrom(buildBattle(), randomSession(), TOTAL_TICKS);

    for (const resumeAt of [...resumeTicks].sort((a, b) => a - b)) {
      // Run the uninterrupted prefix up to `resumeAt`, snapshot, verify, resume.
      const prefix = runFrom(buildBattle(), randomSession(), resumeAt);
      const snap: BattleSnapshotData = createSnapshot(prefix.state);
      expect(verifySnapshot(snap)).toBe(true);
      const restoredStreams = restoreStreamsForResume(snap.authoritativeStreams, [1, 2, 3, 4] as never);
      const resumed = runFrom(snap, new RandomSession(restoredStreams, new RollSlotRegistry([]), false), TOTAL_TICKS - resumeAt);

      // Every subsequent tick must be byte-identical to the uninterrupted run.
      for (let i = 0; i < resumed.checksums.length; i++) {
        expect(resumed.checksums[i], `checksum at tick ${String(resumeAt + i + 1)} (resume at ${String(resumeAt)})`).toBe(full.checksums[resumeAt + i]);
      }
      expect(resumed.events).toEqual(full.events.slice(prefix.events.length));
      expect(createSnapshot(resumed.state).checksum).toBe(createSnapshot(full.state).checksum);
    }
  });

  it('resume ticks genuinely intersect battle progress (sanity: the battle is not trivial)', { timeout: 90_000 }, () => {
    const full = runFrom(buildBattle(), randomSession(), TOTAL_TICKS);
    // The interval-triggered fireballs must damage the boss and drive the
    // battle to a terminal outcome, so the differential run covers real combat.
    const boss = full.state.entities.find((e) => e.id === 'boss_ash_unit');
    expect(boss?.lp).toBeLessThan(1000);
    expect(['VICTORY', 'RESOLVING_END', 'DEFEAT', 'DRAW_ABORT']).toContain(full.state.phase.phase);
    expect(full.events.some((e) => e.includes(':Defeated:'))).toBe(true);
  });
});

describe('P21 forced-outcome snapshot fidelity', () => {
  it('serializes forcedOutcome into the snapshot payload and survives verify', () => {
    // A protect_object failure sets forcedOutcome while the battle sits in
    // RESOLVING_END. The canonical snapshot must carry it — a save/checkpoint
    // taken inside that window has to restore the same forced DEFEAT, not
    // fall back to elimination/Chapter-76 on the finalize tick.
    const base = battle({
      simulationVersion: 'phase21-fixture-v1',
      phase: Object.freeze({ phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 3 }),
    });
    const withForced = battle({
      ...base,
      forcedOutcome: Object.freeze({ outcome: 'DEFEAT', reason: 'protect_object_failed' }),
    });
    const without = createSnapshot(base);
    const withSnap = createSnapshot(withForced);
    // The forced outcome is part of the canonical payload: two states that
    // differ only in the forced outcome must produce different checksums.
    expect(withSnap.checksum).not.toBe(without.checksum);
    // The payload carries it, so the resume path restores the forced outcome.
    expect(withSnap.forcedOutcome).toEqual({ outcome: 'DEFEAT', reason: 'protect_object_failed' });
    expect(verifySnapshot(withSnap)).toBe(true);
  });
});
