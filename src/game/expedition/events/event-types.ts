/**
 * Event content types (EVENT_SYSTEM_CONTRACT): exactly 30 events with 2–3
 * options, visible costs/consequences/risks, deterministic roll slots and
 * typed outcome commands. References are stable lowercase ids plus
 * localization keys — never UI text.
 */
export type EventPreview = 'VISIBLE_SAFE_OUTCOME' | 'VISIBLE_RISK' | 'VISIBLE_TRADEOFF';

export interface EventCost {
  readonly gold?: number;
  readonly instability?: number;
}

export interface EventOptionDefinition {
  readonly optionId: string;
  readonly labelKey: string;
  readonly cost: EventCost;
  readonly preview: readonly EventPreview[];
  readonly rollSlots: readonly string[];
}

export interface EventDefinition {
  readonly eventId: string;
  readonly prerequisites: readonly string[];
  readonly options: readonly EventOptionDefinition[];
}
