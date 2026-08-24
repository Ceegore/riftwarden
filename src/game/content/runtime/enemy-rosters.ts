/**
 * Phase 38 content: per-region enemy rosters (ENEMY_ROSTER_REGISTRY).
 */
import { } from './region-profiles.js';

export interface EnemyTroopEntry {
  readonly troopTypeId: string;
  readonly label: string;
  readonly baseHp: number;
  readonly baseAtk: number;
  readonly baseDef: number;
  readonly rewardCategory: 'common' | 'uncommon' | 'rare' | 'boss';
}

export interface EnemyRoster {
  readonly profileId: string;
  readonly commonEnemies: readonly EnemyTroopEntry[];
  readonly eliteEnemies: readonly EnemyTroopEntry[];
  readonly boss: EnemyTroopEntry | null;
}

function common(troopTypeId: string, label: string, baseHp: number, baseAtk: number, baseDef: number, rewardCategory: 'common' | 'uncommon' | 'rare'): EnemyTroopEntry {
  return { troopTypeId, label, baseHp, baseAtk, baseDef, rewardCategory };
}

function boss(troopTypeId: string, label: string, baseHp: number, baseAtk: number, baseDef: number): EnemyTroopEntry {
  return { troopTypeId, label, baseHp, baseAtk, baseDef, rewardCategory: 'boss' as const };
}

const ROSTERS: Record<string, EnemyRoster> = {
  'expedition.tutorial.v1': {
    profileId: 'expedition.tutorial.v1',
    commonEnemies: [
      common('troop-01', 'Rift Shambler', 40, 8, 4, 'common'),
      common('troop-02', 'Void Mote', 25, 12, 2, 'common'),
    ],
    eliteEnemies: [
      common('troop-03', 'Rift Brute', 75, 15, 8, 'uncommon'),
    ],
    boss: boss('troop-04', 'Rift Guardian', 150, 22, 10),
  },

  'expedition.act1.standard': {
    profileId: 'expedition.act1.standard',
    commonEnemies: [
      common('troop-01', 'Rift Shambler', 40, 8, 4, 'common'),
      common('troop-02', 'Void Mote', 25, 12, 2, 'common'),
      common('troop-05', 'Shard Slinger', 30, 14, 3, 'common'),
    ],
    eliteEnemies: [
      common('troop-03', 'Rift Brute', 75, 15, 8, 'uncommon'),
      common('troop-06', 'Void Tracer', 55, 20, 5, 'rare'),
    ],
    boss: boss('troop-04', 'Rift Guardian', 150, 22, 10),
  },

  'expedition.act1.hard': {
    profileId: 'expedition.act1.hard',
    commonEnemies: [
      common('troop-01', 'Rift Shambler', 45, 10, 5, 'common'),
      common('troop-05', 'Shard Slinger', 35, 16, 4, 'common'),
    ],
    eliteEnemies: [
      common('troop-03', 'Rift Brute', 85, 18, 9, 'uncommon'),
      common('troop-06', 'Void Tracer', 60, 24, 5, 'rare'),
      common('troop-07', 'Rift Captain', 100, 16, 12, 'rare'),
    ],
    boss: boss('troop-08', 'Ash King', 200, 28, 14),
  },

  'expedition.act1.ascension': {
    profileId: 'expedition.act1.ascension',
    commonEnemies: [
      common('troop-05', 'Shard Slinger', 40, 18, 5, 'common'),
    ],
    eliteEnemies: [
      common('troop-06', 'Void Tracer', 65, 26, 6, 'rare'),
      common('troop-07', 'Rift Captain', 115, 18, 13, 'rare'),
    ],
    boss: boss('troop-09', 'Ancient Warden', 260, 32, 16),
  },

  'expedition.act2.forest': {
    profileId: 'expedition.act2.forest',
    commonEnemies: [
      common('troop-10', 'Thorn Wisp', 30, 10, 3, 'common'),
      common('troop-11', 'Bark Sentinel', 55, 7, 10, 'common'),
    ],
    eliteEnemies: [
      common('troop-12', 'Grove Fey', 80, 18, 6, 'uncommon'),
    ],
    boss: boss('troop-13', 'Forest Heart', 180, 24, 12),
  },

  'expedition.act2.caverns': {
    profileId: 'expedition.act2.caverns',
    commonEnemies: [
      common('troop-14', 'Cave Skulker', 35, 14, 5, 'common'),
      common('troop-15', 'Crystal Hound', 50, 10, 8, 'common'),
    ],
    eliteEnemies: [
      common('troop-16', 'Geode Warden', 95, 12, 16, 'rare'),
    ],
    boss: boss('troop-17', 'Vault Dragon', 220, 30, 14),
  },

  'expedition.act3.mountains': {
    profileId: 'expedition.act3.mountains',
    commonEnemies: [
      common('troop-18', 'Frost Cleric', 40, 12, 6, 'common'),
      common('troop-19', 'Yeti Brute', 65, 8, 12, 'common'),
    ],
    eliteEnemies: [
      common('troop-20', 'Storm Eagle', 55, 22, 4, 'uncommon'),
      common('troop-21', 'Glacier Knight', 110, 14, 14, 'rare'),
    ],
    boss: boss('troop-22', 'Shatterpeak Wyrm', 240, 28, 15),
  },

  'expedition.act3.ruins': {
    profileId: 'expedition.act3.ruins',
    commonEnemies: [
      common('troop-23', 'Ashen Acolyte', 30, 16, 4, 'common'),
      common('troop-24', 'Spectral Archon', 50, 18, 5, 'common'),
    ],
    eliteEnemies: [
      common('troop-25', 'Rift Abomination', 120, 20, 8, 'rare'),
    ],
    boss: boss('troop-26', 'Iron Sovereign', 300, 35, 20),
  },
};

export function rosterForProfile(profileId: string): EnemyRoster | null {
  return ROSTERS[profileId] ?? null;
}

export const ENEMY_ROSTERS: Readonly<Record<string, EnemyRoster>> = ROSTERS;