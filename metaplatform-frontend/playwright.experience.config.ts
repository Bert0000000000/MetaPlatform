import { defineConfig, devices } from '@playwright/test';

/** Browser UI regressions; API fixtures here do not replace the real ontology CI suites. */
export default defineConfig({
  testDir: './apps/web/tests/e2e', testMatch: 'ontology-experience.spec.ts',
  timeout: 60000, workers: 1, retries: 0,
  reporter: [['list'], ['junit', { outputFile: 'test-results/experience.xml' }]],
  outputDir: 'test-results/experience-artifacts',
  use: { ...devices['Desktop Chrome'], baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9369',
    trace: 'off', video: 'off', screenshot: 'off' },
});
