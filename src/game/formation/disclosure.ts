import { FormationError } from './formation-error.js';
import { DISCLOSURE_ITEMS, type DisclosureItem } from './types.js';

/**
 * Pre-battle disclosure (PREBATTLE_DISCLOSURE_CONTRACT): before start, S50
 * shows enemy formation, roles, relevant modifiers, objective, boss phases /
 * up to four strategic bullets, hazards, reinforcements and loot preview as
 * permitted. Every strategically effective mechanic must be visible; missing
 * mandatory disclosure blocks start. This module only checks completeness —
 * the content itself comes from content authority, never invented here.
 */
export type DisclosureMap = Readonly<Partial<Record<DisclosureItem, unknown>>>;

const ITEM_SET: ReadonlySet<string> = new Set(DISCLOSURE_ITEMS);

export function isDisclosureItem(value: unknown): value is DisclosureItem {
  return typeof value === 'string' && ITEM_SET.has(value);
}

/** Deterministically sorted list of the required disclosure items that are absent. */
export function missingDisclosure(disclosure: DisclosureMap): readonly DisclosureItem[] {
  return DISCLOSURE_ITEMS.filter((item) => !(item in disclosure) || disclosure[item] === undefined || disclosure[item] === null);
}

export function isDisclosureComplete(disclosure: DisclosureMap): boolean {
  return missingDisclosure(disclosure).length === 0;
}

export function assertDisclosureItems(items: readonly unknown[]): readonly DisclosureItem[] {
  const out: DisclosureItem[] = [];
  for (const item of items) {
    if (!isDisclosureItem(item)) {
      throw new FormationError('UNKNOWN_DISCLOSURE_ITEM', { item });
    }
    out.push(item);
  }
  return out;
}
