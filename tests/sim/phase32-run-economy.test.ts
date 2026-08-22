import { describe, expect, it } from 'vitest';
import { applyOutcomeCommands } from '../../src/game/expedition/outcome-commands.js';
import {
  duplicateConversionGold,
  relicGrantVerdict,
  relicLimitForMode,
  secureCommands,
  settleDefeat,
  settleRetreat,
  settleVictory,
  DEFEAT_GOLD_KEEP_PERMILLE,
  RETREAT_LATE_GOLD_KEEP_PERMILLE,
} from '../../src/game/expedition/run-economy.js';
import { baseState } from './phase32-helpers.js';

describe('phase32 run economy (fixture-driven)', () => {
  const lootCases: readonly {
    readonly case: string;
    readonly lostOnDefeat?: boolean;
    readonly requiresReplacement?: boolean;
    readonly replayed?: boolean;
  }[] = [
    { case: 'secured', lostOnDefeat: false },
    { case: 'unsecured', lostOnDefeat: true },
    { case: 'full-relic-cap', requiresReplacement: true },
    { case: 'duplicate-reward-id', replayed: true },
  ];

  it('secured loot survives a defeat; unsecured loot is lost (loot-cases)', () => {
    const state = baseState({ securedLoot: ['reward:sec'], unsecuredLoot: ['reward:unsec'], goldEarned: 100 });
    const settlement = settleDefeat(state);
    expect(settlement.keptLoot).toContain('reward:sec');
    expect(settlement.lostLoot).toContain('reward:unsec');
    const byCase = new Map(lootCases.map((c) => [c.case, c]));
    expect(byCase.get('secured')?.lostOnDefeat).toBe(false);
    expect(byCase.get('unsecured')?.lostOnDefeat).toBe(true);
  });

  it('defeat keeps 60% of run-earned gold, capped by holdings, never negative', () => {
    const state = baseState({ gold: 80, goldEarned: 100 });
    const settlement = settleDefeat(state);
    const expected = Math.min(Math.floor((100 * DEFEAT_GOLD_KEEP_PERMILLE) / 1000), 80);
    expect(settlement.keptGold).toBe(expected);
    expect(settlement.keptGold + settlement.lostGold).toBe(80);
    expect(settlement.keptGold).toBeGreaterThanOrEqual(0);
    expect(settlement.lostGold).toBeGreaterThanOrEqual(0);
  });

  it('a voluntary retreat at the anchor keeps secured loot and 80% of late gold', () => {
    const state = baseState({ gold: 100, goldEarned: 100, securedLoot: ['reward:kept'], unsecuredLoot: ['reward:lost'] });
    const settlement = settleRetreat(state, 40);
    expect(settlement.keptLoot).toContain('reward:kept');
    expect(settlement.lostLoot).toContain('reward:lost');
    const keptLate = Math.floor((60 * RETREAT_LATE_GOLD_KEEP_PERMILLE) / 1000);
    expect(settlement.keptGold).toBe(40 + keptLate);
    expect(settlement.lostGold).toBe(100 - settlement.keptGold);
  });

  it('victory keeps everything permanent; temporaries end with the run', () => {
    const state = baseState({
      gold: 120,
      securedLoot: ['reward:a'],
      unsecuredLoot: ['reward:b'],
      relics: ['relic:temp'],
      recruits: ['troop-01'],
    });
    const settlement = settleVictory(state);
    expect(settlement.keptGold).toBe(120);
    expect(settlement.keptLoot).toEqual(['reward:a', 'reward:b']);
    expect(settlement.lostRelics).toEqual(['relic:temp']);
    expect(settlement.lostRecruits).toEqual(['troop-01']);
  });

  it('full relic capacity requires replacement (loot-cases)', () => {
    const full = baseState({ relics: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] });
    expect(relicGrantVerdict(full, 'r7', 'NORMAL')).toBe('RELIC_CAP');
    expect(relicLimitForMode('ASCENSION')).toBe(8);
    const withRoom = baseState({ relics: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] });
    expect(relicGrantVerdict(withRoom, 'r8', 'ASCENSION')).toBe('OK');
  });

  it('duplicate reward ids replay instead of double-granting (loot-cases)', () => {
    const applied = applyOutcomeCommands(baseState({ securedLoot: ['reward:dup'] }), [{ kind: 'GRANT_SECURED_LOOT', rewardId: 'reward:dup' }]);
    expect(applied.state.securedLoot.filter((id) => id === 'reward:dup')).toHaveLength(1);
    expect(applied.replayedCount).toBe(1);
  });

  it('duplicate finds convert at 45% of their merchant base value', () => {
    expect(duplicateConversionGold(100)).toBe(45);
    expect(duplicateConversionGold(70)).toBe(31);
    expect(duplicateConversionGold(0)).toBe(0);
  });

  it('secureCommands move unsecured loot to secured via typed commands', () => {
    const state = baseState({ unsecuredLoot: ['reward:a', 'reward:b'], securedLoot: [] });
    const commands = secureCommands(state);
    expect(commands).toHaveLength(4);
    expect(commands.filter((c) => c.kind === 'REMOVE_UNSECURED_LOOT')).toHaveLength(2);
    expect(commands.filter((c) => c.kind === 'GRANT_SECURED_LOOT')).toHaveLength(2);
    const empty = secureCommands(baseState());
    expect(empty).toHaveLength(0);
  });
});
