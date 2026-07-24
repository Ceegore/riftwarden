/// <reference types="vite/client" />

export {};

declare global {
  const __RW_BUILD_MANIFEST__: Readonly<{
    channel: 'dev' | 'qa' | 'release';
    contentVersion: string;
    devtoolsEnabled: boolean;
    sourceRevision: string;
    toolchainFreezeSha256: string;
  }>;
}
