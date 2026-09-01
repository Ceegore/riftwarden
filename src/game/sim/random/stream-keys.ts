export const RNG_STREAM_KEYS = ['map', 'encounter', 'rewards', 'eventChoices', 'combatCosmetic'] as const;
export type RngStreamKey = (typeof RNG_STREAM_KEYS)[number];
export const AUTHORITATIVE_STREAM_KEYS = ['map', 'encounter', 'rewards', 'eventChoices'] as const;

export function isRngStreamKey(value: string): value is RngStreamKey {
  return (RNG_STREAM_KEYS as readonly string[]).includes(value);
}
