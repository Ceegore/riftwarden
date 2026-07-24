import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';
const ci = process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'docs/reports/test-results/playwright-artifacts',
  fullyParallel: false,
  forbidOnly: true,
  retries: ci ? 1 : 0,
  ...ci ? { workers: 1 } : {},
  reporter: [
    ['list'],
    ['junit', { outputFile: 'docs/reports/test-results/playwright-junit.xml' }],
    ['html', { outputFolder: 'docs/reports/test-results/playwright-html', open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-compact', use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 450 } } },
    { name: 'firefox-standard', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
    { name: 'webkit-tablet', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 1024 } } },
  ],
  webServer: {
    command: 'pnpm build:qa && vite preview --port 4173 --mode qa',
    url: baseURL,
    reuseExistingServer: !ci,
    timeout: 120_000,
    env: {
      VITE_BUILD_CHANNEL: 'qa',
      VITE_CONTENT_VERSION: 'qa-content-placeholder',
      VITE_ENABLE_DEVTOOLS: 'true',
      VITE_FIXED_TEST_SEED: 'phase02-smoke',
      VITE_SUPPORT_URL: 'https://example.invalid/riftwarden/support',
      VITE_PRIVACY_URL: 'https://example.invalid/riftwarden/privacy',
    },
  },
});
