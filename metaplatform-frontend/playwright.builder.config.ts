import { defineConfig, devices } from '@playwright/test';
const webBaseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9200';
const webPort = new URL(webBaseUrl).port || '9200';

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
    baseURL: webBaseUrl,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'off', video: 'off', screenshot: 'only-on-failure',
  },
  projects: [{ name: 'builder-v2', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  // Core/migration own their webServer lifecycle and can close it on completion.
  // Only the ephemeral CI job starts/reuses its own loopback UI. Local runs keep
  // using the externally owned goal preview without starting/stopping a server.
  webServer: process.env.CI === 'true' ? {
    command: `pnpm --filter @mate/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
    url: webBaseUrl,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { E2E_GATEWAY_URL: process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:8100/api/v1' },
  } : undefined,
});
