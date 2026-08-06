import { defineConfig, devices } from '@playwright/test';

const webBaseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:9200';
const webPort = new URL(webBaseUrl).port || '9200';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/, },
    { name: 'web', use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/state.json' }, dependencies: ['auth-setup'] },
  ],
  webServer: {
    command: `pnpm --filter @mate/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
    url: webBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
});
