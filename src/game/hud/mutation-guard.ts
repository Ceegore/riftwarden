/**
 * Recursively freezes an object graph. Presentation adapters receive
 * immutable authoritative values; a deliberately mutating adapter must fail
 * loudly (BATTLE_PRESENTATION_AUTHORITY_CONTRACT).
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
