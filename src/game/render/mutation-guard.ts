/**
 * Recursively freezes an object graph. The simulation authority hands the
 * renderer immutable snapshots; this guard makes accidental mutation fail
 * loudly in strict mode instead of corrupting presentation state.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}
