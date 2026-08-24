/**
 * Phase 37 formation domain: party arrangement for combat.
 * Formations determine stat bonuses and combat positioning.
 */
export type FormationPosition =
  | 'front_left' | 'front_center' | 'front_right'
  | 'middle_left' | 'middle_center' | 'middle_right'
  | 'back_left' | 'back_center' | 'back_right';

export interface FormationDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly positions: readonly FormationPosition[];
  readonly bonuses: Readonly<Partial<Record<string, number>>>;
  readonly unlocked: boolean;
}

export interface FormationState {
  readonly formations: readonly FormationDefinition[];
  readonly activeFormation: string | null;
  /** position → heroId */
  readonly placement: Readonly<Partial<Record<FormationPosition, string>>>;
}

export const FORMATION_POSITIONS: readonly FormationPosition[] = [
  'front_left', 'front_center', 'front_right',
  'middle_left', 'middle_center', 'middle_right',
  'back_left', 'back_center', 'back_right',
] as const;

export const FORMATION_DEFINITIONS: readonly FormationDefinition[] = [
  {
    id: 'formation_standard',
    label: 'Standard Line',
    description: 'Balanced front and back row.',
    positions: FORMATION_POSITIONS,
    bonuses: { def: 2, atk: 1 },
    unlocked: true,
  },
  {
    id: 'formation_vanguard',
    label: 'Vanguard',
    description: 'Three front, one back. Front row gains DEF +4.',
    positions: ['front_left', 'front_center', 'front_right', 'back_center'] as FormationPosition[],
    bonuses: { def: 4 },
    unlocked: true,
  },
  {
    id: 'formation_wedge',
    label: 'Wedge',
    description: 'Three front. Front row gains ATK +4, SPD +2.',
    positions: ['front_left', 'front_center', 'front_right'] as FormationPosition[],
    bonuses: { atk: 4, spd: 2 },
    unlocked: false,
  },
  {
    id: 'formation_phalanx',
    label: 'Phalanx',
    description: 'Four front, two back. Massive DEF +6.',
    positions: FORMATION_POSITIONS,
    bonuses: { def: 6, hp: 10 },
    unlocked: false,
  },
];
