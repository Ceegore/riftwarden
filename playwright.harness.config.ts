import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4174';

/**
 * Dedicated Playwright config for the dev-only context-loss harness
 * (harness.html + src/screens/dev/harness-main.ts). Serves the page through
 * the Vite dev server (QA env) so the harness imports the pure render/HUD
 * contract layers plus the real pixi.js bundle; context loss is injected with
 * the genuine WEBGL_lose_context extension in Chromium.
 */
export default defineConfig({
  testDir: './tests/e2e/battle',
  outputDir: 'docs/reports/test-results/playwright-harness-artifacts',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'docs/reports/test-results/playwright-harness-junit.xml' }],
  ],
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-harness',
      use: {
        browserName: 'chromium',
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: 'vite --mode qa --port 4174 --strictPort',
    url: `${baseURL}/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_BUILD_CHANNEL: 'qa',
      VITE_CONTENT_VERSION: 'qa-content-placeholder',
      VITE_ENABLE_DEVTOOLS: 'true',
      VITE_FIXED_TEST_SEED: 'phase02-smoke',
    },
  },
});
