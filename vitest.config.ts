import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const aliases = {
  '@app': path.join(root, 'src/app'),
  '@audio': path.join(root, 'src/audio'),
  '@features': path.join(root, 'src/features'),
  '@game': path.join(root, 'src/game'),
  '@locales': path.join(root, 'src/locales'),
  '@platform': path.join(root, 'src/platform'),
  '@screens': path.join(root, 'src/screens'),
  '@storage': path.join(root, 'src/storage'),
  '@ui': path.join(root, 'src/ui'),
};

export default defineConfig({
  resolve: { alias: aliases },
  define: {
    __RW_BUILD_MANIFEST__: JSON.stringify({
      channel: 'dev',
      contentVersion: 'test-content-placeholder',
      devtoolsEnabled: true,
      sourceRevision: 'test-revision',
      toolchainFreezeSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    }),
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'docs/reports/test-results/coverage',
      thresholds: { branches: 85, functions: 90, lines: 90, statements: 90 },
    },
    environment: 'node',
    passWithNoTests: false,
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.ts'] } },
      { test: { name: 'simulation', include: ['tests/simulation/**/*.test.ts'], sequence: { concurrent: false }, setupFiles: ['tests/setup/inject-build-manifest.ts'] } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.ts'] } },
    ],
    reporters: ['default', ['junit', { outputFile: 'docs/reports/test-results/vitest-junit.xml' }]],
  },
});
