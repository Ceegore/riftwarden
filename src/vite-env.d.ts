/// <reference types="vite/client" />

export {};

declare global {
  // eslint-disable-next-line no-var
  const __RW_BUILD_MANIFEST__: Readonly<{
    channel: 'dev' | 'qa' | 'release';
    contentVersion: string;
    devtoolsEnabled: boolean;
    sourceRevision: string;
    toolchainFreezeSha256: string;
  }>;
}
