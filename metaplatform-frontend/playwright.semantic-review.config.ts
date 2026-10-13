import { defineConfig } from '@playwright/test';

/** UI-only regression against an independently started server; all APIs are mocked in the spec. */
export default defineConfig({
  testDir: './apps/web/tests/e2e',
  testMatch: 'ontology-semantic-review.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['junit', { outputFile: '../.ci/semantic-browser.xml' }]],
  outputDir: '../.ci/semantic-browser-artifacts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:19358',
    headless: true,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
});
