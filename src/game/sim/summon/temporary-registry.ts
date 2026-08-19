import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import {
  createTempEntity,
  compareTempEntity,
  SUMMON_CAP_PER_SIDE,
  type TempEntity,
  type TempKind,
  type TempSide,
} from './temporary-entity.js';

/**
 * Phase 20 §8 temporary-entity registry. Holds the per-side summon counter,
 * category index (by kind), owner index (by owner id), slot index (by slot id)
 * and a stable iteration order (code-unit id compare). Restore rebuilds every
 * derived index from the snapshot and validates cap, slot uniqueness and
 * missing owner references (§8).
 */
export class TemporaryRegistry {
  private readonly items = new Map<string, TempEntity>();

  add(entity: TempEntity): void {
    const frozen = createTempEntity(entity);
    if (this.items.has(frozen.id)) throw new KernelInvariantError('DuplicateEntityId', { id: frozen.id });
    if (frozen.slotId !== undefined && this.entities().some((e) => e.slotId === frozen.slotId && e.side === frozen.side)) {
      throw new KernelInvariantError('ConstructSlotOccupied', { slotId: frozen.slotId, side: frozen.side });
    }
    this.items.set(frozen.id, frozen);
    this.assert();
  }

  remove(id: string): TempEntity | undefined {
    const entity = this.items.get(id);
    this.items.delete(id);
    this.assert();
    return entity;
  }

  get(id: string): TempEntity | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** Canonical iteration order: code-unit id compare (§8). */
  list(): readonly TempEntity[] {
    return Object.freeze([...this.items.values()].sort(compareTempEntity));
  }

  /** Category index: all temporary entities of one kind, canonically ordered. */
  listByKind(kind: TempKind): readonly TempEntity[] {
    return Object.freeze(this.entities().filter((e) => e.kind === kind).sort(compareTempEntity));
  }

  /** Owner index: all temporary entities owned by one regular unit. */
  listByOwner(ownerId: string): readonly TempEntity[] {
    return Object.freeze(this.entities().filter((e) => e.ownerId === ownerId).sort(compareTempEntity));
  }

  /** Slot index: whether a slot id is occupied on a side (§7 no stacking). */
  slotOccupied(side: TempSide, slotId: string): boolean {
    return this.entities().some((e) => e.side === side && e.slotId === slotId);
  }

  /** Per-side counted summon total (committed, not removed) (§5.1). */
  summonCount(side: TempSide): number {
    return this.entities().filter((e) => e.side === side && e.kind === 'SUMMON' && e.counted).length;
  }

  /** Oldest counted summon by (createdTick, createdSequence, id) (§5.3). */
  oldestSummon(side: TempSide): TempEntity | undefined {
    return this.entities()
      .filter((e) => e.side === side && e.kind === 'SUMMON' && e.counted)
      .sort((a, b) => a.createdTick - b.createdTick || a.createdSequence - b.createdSequence || asciiCompare(a.id, b.id))[0];
  }

  /** Deep snapshot in canonical order (§8). */
  snapshot(): readonly TempEntity[] {
    return Object.freeze(this.list().map((e) => createTempEntity(e)));
  }

  /**
   * Rebuilds every derived index and validates the snapshot. When owner ids are
   * supplied, missing owner references block restore (§8 dangling references).
   */
  static restore(entities: readonly TempEntity[], ownerIds?: ReadonlySet<string>): TemporaryRegistry {
    const registry = new TemporaryRegistry();
    for (const entity of entities) registry.add(createTempEntity(entity));
    if (ownerIds !== undefined) {
      for (const entity of registry.list()) {
        if (!ownerIds.has(entity.ownerId)) throw new KernelInvariantError('TemporaryDanglingReference', { reason: 'missing-owner', entityId: entity.id, ownerId: entity.ownerId });
      }
    }
    return registry;
  }

  /** Invariants: never more than six counted summons per side, no duplicate slot. */
  assert(): void {
    for (const side of ['player', 'enemy'] as const) {
      if (this.summonCount(side) > SUMMON_CAP_PER_SIDE) {
        throw new KernelInvariantError('RestoreSummonCapExceeded', { side, count: this.summonCount(side) });
      }
    }
    const slots = new Map<string, string>();
    for (const entity of this.entities()) {
      if (entity.slotId === undefined) continue;
      const key = `${entity.side}:${entity.slotId}`;
      const existing = slots.get(key);
      if (existing !== undefined && existing !== entity.id) {
        throw new KernelInvariantError('ConstructSlotOccupied', { slotId: entity.slotId, side: entity.side, a: existing, b: entity.id });
      }
      slots.set(key, entity.id);
    }
  }

  private entities(): TempEntity[] {
    return [...this.items.values()];
  }
}
