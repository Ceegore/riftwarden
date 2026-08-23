/**
 * Phase 35 — pinned achievement catalog. Each definition has a target
 * (e.g., kill 50 enemies, own 10 items); progress increments during or
 * after expeditions.
 */
import type { AchievementDef } from './types.js';

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Combat
  { id: 'kill_10',            titleKey: 'ach.kill_10.title',            descriptionKey: 'ach.kill_10.desc',            category: 'combat',      tier: 1, target: 10 },
  { id: 'kill_50',            titleKey: 'ach.kill_50.title',            descriptionKey: 'ach.kill_50.desc',            category: 'combat',      tier: 2, target: 50 },
  { id: 'kill_200',           titleKey: 'ach.kill_200.title',           descriptionKey: 'ach.kill_200.desc',           category: 'combat',      tier: 3, target: 200 },
  { id: 'boss_5',             titleKey: 'ach.boss_5.title',             descriptionKey: 'ach.boss_5.desc',             category: 'combat',      tier: 2, target: 5 },
  { id: 'perfect_battle',     titleKey: 'ach.perfect_battle.title',     descriptionKey: 'ach.perfect_battle.desc',     category: 'combat',      tier: 1, target: 1 },

  // Collection
  { id: 'items_10',           titleKey: 'ach.items_10.title',           descriptionKey: 'ach.items_10.desc',           category: 'collection',  tier: 1, target: 10 },
  { id: 'items_30',           titleKey: 'ach.items_30.title',           descriptionKey: 'ach.items_30.desc',           category: 'collection',  tier: 2, target: 30 },
  { id: 'heroes_3',           titleKey: 'ach.heroes_3.title',           descriptionKey: 'ach.heroes_3.desc',           category: 'collection',  tier: 1, target: 3 },
  { id: 'heroes_all',         titleKey: 'ach.heroes_all.title',         descriptionKey: 'ach.heroes_all.desc',         category: 'collection',  tier: 3, target: 8 },
  { id: 'relics_5',           titleKey: 'ach.relics_5.title',           descriptionKey: 'ach.relics_5.desc',           category: 'collection',  tier: 2, target: 5 },

  // Mastery
  { id: 'level_hero_3',       titleKey: 'ach.level_hero_3.title',       descriptionKey: 'ach.level_hero_3.desc',       category: 'mastery',     tier: 1, target: 1 },
  { id: 'level_all_heroes_2', titleKey: 'ach.level_all_heroes_2.title', descriptionKey: 'ach.level_all_heroes_2.desc', category: 'mastery',     tier: 2, target: 1 },

  // Exploration
  { id: 'expeditions_5',      titleKey: 'ach.expeditions_5.title',      descriptionKey: 'ach.expeditions_5.desc',      category: 'exploration', tier: 1, target: 5 },
  { id: 'expeditions_20',     titleKey: 'ach.expeditions_20.title',     descriptionKey: 'ach.expeditions_20.desc',     category: 'exploration', tier: 2, target: 20 },
  { id: 'nodes_visited_100',  titleKey: 'ach.nodes_visited_100.title',  descriptionKey: 'ach.nodes_visited_100.desc',  category: 'exploration', tier: 2, target: 100 },
  { id: 'all_node_types',     titleKey: 'ach.all_node_types.title',     descriptionKey: 'ach.all_node_types.desc',     category: 'exploration', tier: 2, target: 1 },

  // Milestone
  { id: 'gold_1000',          titleKey: 'ach.gold_1000.title',          descriptionKey: 'ach.gold_1000.desc',          category: 'milestone',   tier: 1, target: 1000 },
  { id: 'gold_10000',         titleKey: 'ach.gold_10000.title',         descriptionKey: 'ach.gold_10000.desc',         category: 'milestone',   tier: 2, target: 10000 },
  { id: 'first_victory',      titleKey: 'ach.first_victory.title',      descriptionKey: 'ach.first_victory.desc',      category: 'milestone',   tier: 1, target: 1 },
  { id: 'first_defeat',       titleKey: 'ach.first_defeat.title',       descriptionKey: 'ach.first_defeat.desc',       category: 'milestone',   tier: 1, target: 1 },
];

export const ACHIEVEMENT_MAP: Readonly<Record<string, AchievementDef>> = Object.freeze(
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])),
);
