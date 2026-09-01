export * from './combat.js';
export * from './progression.js';
export * from './persistence.js';
export function assertNever(value: never): never { throw new Error(`P11_ASSERT_NEVER:${String(value)}`); }
