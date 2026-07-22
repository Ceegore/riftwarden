// Vitest setup: provide the build-time global __RW_BUILD_MANIFEST__ for tests.
// In production this is injected by Vite at build time (see vite.config.ts cspPlugin).
declare global {
  // eslint-disable-next-line no-var
  var __RW_BUILD_MANIFEST__: Readonly<{
    channel: 'dev' | 'qa' | 'release';
    contentVersion: string;
    devtoolsEnabled: boolean;
    sourceRevision: string;
    toolchainFreezeSha256: string;
  }>;
}

globalThis.__RW_BUILD_MANIFEST__ = Object.freeze({
  channel: 'dev',
  contentVersion: 'test-content-placeholder',
  devtoolsEnabled: true,
  sourceRevision: 'test-revision',
  toolchainFreezeSha256: '0000000000000000000000000000000000000000000000000000000000000000',
});
