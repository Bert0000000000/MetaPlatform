import { defineConfig, devices } from '@playwright/test';

// Precisely collect the app-local builder files that root core testDir excludes.
// Identity/result artifacts contain no inherited environment, raw DTOs or tokens.
export default defineConfig({
  testDir: './apps/web/tests/e2e',
  testMatch: ['ontology-ia-v2-navigation.spec.ts', 'ontology-builder-v2.spec.ts', 'platform-builder-v2.spec.ts'],
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['./builder-safe-reporter.ts']],
  outputDir: 'test-results/builder-artifacts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9200',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'off', video: 'off', screenshot: 'only-on-failure',
  },
  projects: [{ name: 'builder-v2', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
});
