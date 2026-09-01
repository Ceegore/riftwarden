import { describe, expect, it } from 'vitest';
import { emptyProfile, readJson } from './phase31-helpers.js';
import { commitTransaction } from '../../src/game/profile/transaction-service.js';
import type { Profile, TransactionKind, TransactionRequest } from '../../src/game/profile/types.js';

function buyCopy(troopTypeId: string, copyId: string): (profile: Profile) => Profile {
  return (profile: Profile) => {
    const existing = profile.troops[troopTypeId];
    const copies = existing === undefined ? [] : [...existing.copies];
    copies.push({ instanceId: copyId, typeId: troopTypeId });
    return {
      ...profile,
      troops: {
        ...profile.troops,
        [troopTypeId]: { typeId: troopTypeId, contractLevel: 1, copies },
      },
    };
  };
}

function polishItem(itemId: string): (profile: Profile) => Profile {
  return (profile: Profile) => {
    const item = profile.items[itemId];
    if (item === undefined) throw new Error('missing item');
    return {
      ...profile,
      items: {
        ...profile.items,
        [itemId]: { ...item, polished: true },
      },
    };
  };
}

function equipItem(heroId: string, itemId: string): (profile: Profile) => Profile {
  return (profile: Profile) => {
    const hero = profile.heroes[heroId];
    if (hero === undefined) throw new Error('missing hero');
    return {
      ...profile,
      heroes: {
        ...profile.heroes,
        [heroId]: { ...hero, equipmentId: itemId },
      },
    };
  };
}

describe('phase31 transaction cases', () => {
  const cases = readJson('fixtures/transaction-cases.json') as readonly {
    readonly id: string;
    readonly kind: string;
    readonly balance: number;
    readonly cost: number;
    readonly expectedBalance: number;
    readonly expected: string;
    readonly repeat?: number;
    readonly injectFailure?: boolean;
  }[];

  function request(kind: string, transactionId: string, costGold: number, mutate: (profile: Profile) => Profile): TransactionRequest {
    return { transactionId, kind: kind as TransactionKind, costGold, mutate };
  }

  it('pins the four transaction cases', () => {
    expect(cases.map((row) => row.id)).toEqual(['buy-copy-ok', 'insufficient', 'duplicate-callback', 'commit-failure']);
    expect(cases[0]).toEqual({ id: 'buy-copy-ok', kind: 'BUY_COPY', balance: 100, cost: 30, expectedBalance: 70, expected: 'COMMITTED' });
    expect(cases[1]).toEqual({ id: 'insufficient', kind: 'BUY_COPY', balance: 20, cost: 30, expectedBalance: 20, expected: 'REJECTED' });
  });

  it('buy-copy-ok: debits exactly once and commits', () => {
    const row = cases[0];
    if (row === undefined) throw new Error('missing case');
    const base = emptyProfile({ gold: row.balance, riftEssence: 0 });
    const outcome = commitTransaction(base, request(row.kind, 'tx-buy', row.cost, buyCopy('troop_guard', 'copy_1')));
    expect(outcome.result.status).toBe('COMMITTED');
    expect(outcome.replayed).toBe(false);
    expect(outcome.profile.wallet.gold).toBe(row.expectedBalance);
    expect(outcome.profile.troops['troop_guard']?.copies).toHaveLength(1);
  });

  it('insufficient: rejected with no mutation and a ledger entry', () => {
    const row = cases[1];
    if (row === undefined) throw new Error('missing case');
    const base = emptyProfile({ gold: row.balance, riftEssence: 0 });
    const outcome = commitTransaction(base, request(row.kind, 'tx-insufficient', row.cost, buyCopy('troop_guard', 'copy_x')));
    expect(outcome.result.status).toBe('REJECTED');
    expect(outcome.result.reason).toBe('INSUFFICIENT_FUNDS');
    expect(outcome.profile.wallet.gold).toBe(row.expectedBalance);
    expect(outcome.profile.troops['troop_guard']).toBeUndefined();
    expect(outcome.profile.transactionLedger['tx-insufficient']?.status).toBe('REJECTED');
  });

  it('duplicate-callback: repeated ids commit once and replay the result', () => {
    const row = cases[2];
    if (row === undefined) throw new Error('missing case');
    const base = emptyProfile({ gold: row.balance, riftEssence: 0 });
    const baseWithItem = {
      ...base,
      items: { item_sword: { id: 'item_sword', owned: true, polished: false, isBanner: false } },
    };
    const first = commitTransaction(baseWithItem, request(row.kind, 'tx-polish', row.cost, polishItem('item_sword')));
    expect(first.result.status).toBe('COMMITTED');
    expect(first.profile.wallet.gold).toBe(row.expectedBalance);
    const second = commitTransaction(first.profile, request(row.kind, 'tx-polish', row.cost, polishItem('item_sword')));
    expect(second.replayed).toBe(true);
    expect(second.result).toEqual(first.result);
    expect(second.profile.wallet.gold).toBe(row.expectedBalance);
    expect(second.profile.items['item_sword']?.polished).toBe(true);
  });

  it('commit-failure: a throwing mutation leaves the old complete state', () => {
    const row = cases[3];
    if (row === undefined) throw new Error('missing case');
    const base: Profile = {
      ...emptyProfile({ gold: row.balance, riftEssence: 0 }),
      heroes: { hero_aurel: { id: 'hero_aurel', unlocked: true, level: 2, fame: 0 } },
      items: { item_sword: { id: 'item_sword', owned: true, polished: false, isBanner: false } },
    };
    const failing = (profile: Profile): Profile => {
      if (row.injectFailure) throw new Error('save failed');
      return equipItem('hero_aurel', 'item_sword')(profile);
    };
    expect(() => commitTransaction(base, request(row.kind, 'tx-equip', row.cost, failing))).toThrow('save failed');
    // Old state is fully intact: wallet, ledger and hero equipment unchanged.
    expect(base.wallet.gold).toBe(row.expectedBalance);
    expect(base.heroes['hero_aurel']?.equipmentId).toBeUndefined();
    expect(base.transactionLedger['tx-equip']).toBeUndefined();
  });
});

describe('phase31 transaction property tests', () => {
  it('an id never mutates twice across many commits', () => {
    const base = emptyProfile({ gold: 1000, riftEssence: 0 });
    let profile = base;
    for (let i = 0; i < 100; i += 1) {
      const outcome = commitTransaction(profile, {
        transactionId: 'tx-single',
        kind: 'BUY_COPY',
        costGold: 10,
        mutate: buyCopy('troop_guard', 'copy_only'),
      });
      profile = outcome.profile;
    }
    expect(profile.wallet.gold).toBe(990);
    expect(profile.troops['troop_guard']?.copies).toHaveLength(1);
  });

  it('ledger entries are immutable records of the first outcome', () => {
    const base: Profile = {
      ...emptyProfile({ gold: 50, riftEssence: 0 }),
      items: { item_x: { id: 'item_x', owned: true, polished: false, isBanner: false } },
    };
    const first = commitTransaction(base, {
      transactionId: 'tx-a',
      kind: 'POLISH',
      costGold: 25,
      mutate: polishItem('item_x'),
    });
    expect(first.result.status).toBe('COMMITTED');
    // A replay returns the identical result object.
    const replay = commitTransaction(first.profile, {
      transactionId: 'tx-a',
      kind: 'POLISH',
      costGold: 25,
      mutate: polishItem('item_x'),
    });
    expect(replay.replayed).toBe(true);
    expect(replay.result).toEqual(first.result);
    expect(replay.result.status).toBe('COMMITTED');
  });

  it('insufficient funds never debits and never mutates', () => {
    const base = emptyProfile({ gold: 5, riftEssence: 0 });
    const outcome = commitTransaction(base, {
      transactionId: 'tx-broke',
      kind: 'BUY_COPY',
      costGold: 10,
      mutate: buyCopy('troop_guard', 'c1'),
    });
    expect(outcome.profile.wallet.gold).toBe(5);
    expect(outcome.profile.troops).toEqual({});
    expect(outcome.profile.transactionLedger['tx-broke']?.reason).toBe('INSUFFICIENT_FUNDS');
  });

  it('a committed profile always validates', () => {
    const base = emptyProfile({ gold: 500, riftEssence: 0 });
    const outcome = commitTransaction(base, {
      transactionId: 'tx-valid',
      kind: 'BUY_CONTRACT',
      costGold: 100,
      mutate: (profile: Profile) => ({
        ...profile,
        troops: { ...profile.troops, troop_guard: troopStateSafe('troop_guard', 2) },
      }),
    });
    expect(outcome.result.status).toBe('COMMITTED');
    expect(() => commitTransaction(outcome.profile, {
      transactionId: 'tx-valid-2',
      kind: 'BUY_COPY',
      costGold: 10,
      mutate: buyCopy('troop_guard', 'c2'),
    })).not.toThrow();
  });
});

function troopStateSafe(typeId: string, contractLevel: 1 | 2 | 3): { typeId: string; contractLevel: 1 | 2 | 3; copies: readonly { instanceId: string; typeId: string }[] } {
  return { typeId, contractLevel, copies: [] };
}
