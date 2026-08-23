/**
 * Phase 35 mastery domain: hero mastery progress per hero. Tracks
 * kills and expeditions completed with each hero; milestones unlock
 * mastery bonuses in a later phase.
 */
export interface HeroMastery {
  readonly heroId: string;
  readonly kills: number;
  readonly expeditions: number;
}

export interface MasteryState {
  readonly heroes: Readonly<Record<string, HeroMastery>>;
}

export const MASTERY_MILESTONES = [5, 15, 50, 100] as const;
export type MasteryTier = 0 | 1 | 2 | 3 | 4;

export function masteryTier(hero: HeroMastery): MasteryTier {
  let tier: MasteryTier = 0;
  for (let i = 0; i < MASTERY_MILESTONES.length; i++) {
    if (hero.kills >= MASTERY_MILESTONES[i]!) tier = (i + 1) as MasteryTier;
  }
  return tier;
}
