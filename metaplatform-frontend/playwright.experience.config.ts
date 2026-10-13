import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9369';
const webPort = new URL(baseURL).port || '9369';

/** Browser UI regressions; API fixtures here do not replace the real ontology CI suites. */
export default defineConfig({
  testDir: './apps/web/tests/e2e', testMatch: 'ontology-experience.spec.ts',
  timeout: 60000, workers: 1, retries: 0,
  reporter: [['list'], ['junit', { outputFile: 'test-results/experience.xml' }]],
  outputDir: 'test-results/experience-artifacts',
  use: { ...devices['Desktop Chrome'], baseURL,
    trace: 'off', video: 'off', screenshot: 'off' },
  webServer: {
    command: `pnpm --filter @mate/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
    url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60000,
  },
});
