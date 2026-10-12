import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'ontology-relationship-flow.spec.ts', workers: 1, retries: 0, timeout: 120_000,
  reporter: 'list', outputDir: '.artifacts/codex-mp11-relationship',
  use: { baseURL: 'http://127.0.0.1:55499', viewport: { width: 1440, height: 1100 },
    actionTimeout: 20_000, navigationTimeout: 30_000, trace: 'off', video: 'off', screenshot: 'off' },
});
