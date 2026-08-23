/**
 * Phase 35 codex domain: encyclopedia of discovered entities (enemies,
 * items, relics, node types) from expeditions. Persisted in localStorage.
 */
export type CodexCategory = 'enemy' | 'item' | 'relic' | 'nodeType' | 'hero' | 'troop';

export interface CodexEntry {
  readonly id: string;
  readonly category: CodexCategory;
  readonly discovered: boolean;
  readonly discoveredAt?: number;
  readonly timesEncountered: number;
}

export interface CodexState {
  readonly entries: Readonly<Record<string, CodexEntry>>;
}
