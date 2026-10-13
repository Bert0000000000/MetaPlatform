import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9374';
const port = new URL(baseURL).port || '9374';

export default defineConfig({
  testDir: './apps/web/tests/e2e', testMatch: 'ontology-shacl-report.spec.ts',
  timeout: 90000, fullyParallel: false, workers: 1, retries: 0,
  expect: { timeout: 15000 }, forbidOnly: !!process.env.CI,
  reporter: [['list'], ['junit', { outputFile: 'test-results/shacl.xml' }]],
  outputDir: 'test-results/shacl-artifacts',
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'off', video: 'off', screenshot: 'off' },
  webServer: process.env.CI === 'true' ? {
    command: `pnpm --filter @mate/web exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL, reuseExistingServer: true, timeout: 60000,
    env: { E2E_GATEWAY_URL: process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:8100/api/v1' },
  } : undefined,
});
