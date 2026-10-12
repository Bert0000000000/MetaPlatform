import { defineConfig, devices } from '@playwright/test';
const webBaseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9350';
const webPort = new URL(webBaseUrl).port || '9350';

/** Deliberately uses an already-running isolated stack; never starts or replaces the main demo. */
export default defineConfig({
  testDir: './apps/web/tests/e2e', testMatch: 'ontology-from-data.spec.ts',
  timeout: 180000, fullyParallel: false, workers: 1, retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['junit', { outputFile: 'test-results/modeling.xml' }]],
  outputDir: 'test-results/modeling-artifacts',
  use: { baseURL: webBaseUrl, actionTimeout: 20000, navigationTimeout: 60000, trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'] },
  // Each CI suite owns its UI process; local runs reuse the user's existing preview.
  webServer: process.env.CI === 'true' ? {
    command: `pnpm --filter @mate/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
    url: webBaseUrl,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { E2E_GATEWAY_URL: process.env.E2E_GATEWAY ?? 'http://127.0.0.1:8100/api/v1' },
  } : undefined,
});
