// Vitest setup: provide the build-time global __RW_BUILD_MANIFEST__ for tests.
// In production this is injected by Vite at build time (see vite.config.ts).
Object.defineProperty(globalThis, '__RW_BUILD_MANIFEST__', {
  value: Object.freeze({
    channel: 'dev',
    contentVersion: 'test-content-placeholder',
    devtoolsEnabled: true,
    sourceRevision: 'test-revision',
    toolchainFreezeSha256: '0000000000000000000000000000000000000000000000000000000000000000',
  }),
  writable: false,
  configurable: false,
});
