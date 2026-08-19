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
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'rules', include: ['tests/rules/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'math', include: ['tests/math/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'random', include: ['tests/random/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'replay', include: ['tests/replay/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'kernel', include: ['tests/sim/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase15', include: ['tests/phase15/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase16', include: ['tests/sim/phase16-*.test.ts', 'tests/sim/reference-traces-phase16.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase17', include: ['tests/sim/phase17-*.test.ts', 'tests/sim/reference-traces-phase17*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase18', include: ['tests/sim/phase18-*.test.ts', 'tests/sim/reference-traces-phase18.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase19', include: ['tests/sim/phase19-*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase20', include: ['tests/sim/phase20-*.test.ts', 'tests/sim/reference-traces-phase20.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase21', include: ['tests/sim/phase21-*.test.ts', 'tests/sim/reference-traces-phase21.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase22', include: ['tests/sim/phase22-*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase23', include: ['tests/sim/phase23-*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'phase24', include: ['tests/sim/phase24-*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'simulation', include: ['tests/simulation/**/*.test.ts'], sequence: { concurrent: false }, setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], setupFiles: ['tests/setup/inject-build-manifest.mjs'] } },
    ],
    reporters: ['default', ['junit', { outputFile: 'docs/reports/test-results/vitest-junit.xml' }]],
  },
});
