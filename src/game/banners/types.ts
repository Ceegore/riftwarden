/**
 * Phase 37 banner domain: banners provide global expedition
 * modifiers and are assigned to runs.
 */
export interface BannerPassive {
  readonly stat: string;
  readonly value: number;
  readonly condition?: string;
}

export interface BannerDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tier: 1 | 2 | 3;
  readonly passives: readonly BannerPassive[];
}

export interface BannerState {
  readonly unlocked: readonly string[];
  readonly activeBanner: string | null;
}

export const BANNER_DEFINITIONS: readonly BannerDefinition[] = [
  {
    id: 'banner_crimson',
    label: 'Crimson Standard',
    description: 'All allies gain +2 ATK in combat.',
    tier: 1,
    passives: [{ stat: 'atk', value: 2 }],
  },
  {
    id: 'banner_iron',
    label: 'Iron Bulwark',
    description: 'All allies gain +3 DEF in combat.',
    tier: 1,
    passives: [{ stat: 'def', value: 3 }],
  },
  {
    id: 'banner_swift',
    label: 'Swift Pennant',
    description: 'All allies gain +2 SPD in combat.',
    tier: 1,
    passives: [{ stat: 'spd', value: 2 }],
  },
  {
    id: 'banner_dragon',
    label: 'Dragon Pennon',
    description: 'ATK +5, DEF +3 in combat.',
    tier: 2,
    passives: [
      { stat: 'atk', value: 5 },
      { stat: 'def', value: 3 },
    ],
  },
  {
    id: 'banner_rift',
    label: 'Rift Banner',
    description: 'Instability gain reduced by 2 per node.',
    tier: 3,
    passives: [{ stat: 'instability_reduction', value: 2 }],
  },
];
