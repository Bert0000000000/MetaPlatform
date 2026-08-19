import { defineConfig, devices } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webBaseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:9250';
const webPort = new URL(webBaseUrl).port || '9250';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  outputDir: 'tests/e2e/.artifacts',
  projects: [
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        // 鉴权走 helpers/auth.ts 的 injectAuth()：fetch 真 JWT + addInitScript 注入 localStorage，
        // 不再依赖 storageState 旧 token（之前 30s 超时 + JWT 过期都是这条路径的过期 token 引起的）。
      },
    },
  ],
  // Reuse the running dev server on the configured port (no extra webServer block).
});