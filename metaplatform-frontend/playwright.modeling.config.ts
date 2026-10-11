import { defineConfig, devices } from '@playwright/test';

/** Deliberately uses an already-running isolated stack; never starts or replaces the main demo. */
export default defineConfig({
  testDir: './apps/web/tests/e2e', testMatch: 'ontology-from-data.spec.ts',
  timeout: 180000, fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['junit', { outputFile: 'test-results/modeling.xml' }]],
  outputDir: 'test-results/modeling-artifacts',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9350', actionTimeout: 20000, navigationTimeout: 60000, trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'] },
});
