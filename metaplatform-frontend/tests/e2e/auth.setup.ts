import { test as setup, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';
import { mintMockToken } from './helpers/mock-jwt';

const AUTH_FILE = 'tests/e2e/.auth/state.json';

/**
 * GOVERN-11 auth.setup.ts: 用两种模式登录 ——
 *   1) real（E2E_AUTH_MODE=real）：调 loginViaApi() 拿真实 token
 *   2) mock（默认）：跳过 auth/login，mint 一个 dev JWT 注入 localStorage
 *
 * 在当前 dev 栈 mate-auth-service 的 /iam/auth/login 一直返 500 的情况下，
 * 默认走 mock 模式，让 4 个 ontology-loop spec 仍可验证 Ontology 闭环。
 * CI 跑时（如 IAM 完全就绪）改成 E2E_AUTH_MODE=real 即可。
 */
setup('authenticate', async ({ page, request }) => {
  const mode = process.env.E2E_AUTH_MODE ?? 'mock';
  if (mode === 'real') {
    await loginViaApi(page, request);
  } else {
    const { token, user } = mintMockToken();
    await page.addInitScript(
      ({ t, u }) => {
        localStorage.setItem('mate_platform_token', t);
        localStorage.setItem('mate_platform_user', JSON.stringify(u));
      },
      { t: token, u: user },
    );
  }
  await page.goto('/');
  await expect(page).toHaveURL(/\/(login|agents|dw|portal|dashboard|$)/);
  await page.context().storageState({ path: AUTH_FILE });
});