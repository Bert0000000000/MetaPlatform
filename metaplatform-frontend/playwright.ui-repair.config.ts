import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'ui-rendering.spec.ts', workers: 1,
  reporter: [['list'], ['json', { outputFile: 'tests/e2e/.artifacts/ui-repair/result.json' }]],
  outputDir: 'tests/e2e/.artifacts/ui-repair',
  use: { baseURL: 'http://127.0.0.1:9371', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm --filter @mate/web exec vite --host 127.0.0.1 --port 9371 --strictPort', url: 'http://127.0.0.1:9371', reuseExistingServer: false, timeout: 60000, env: { VITE_BACKEND_PORT: '9372' } },
});
