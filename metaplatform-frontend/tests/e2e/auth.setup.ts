import { test as setup, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';
import { mintMockToken } from './helpers/mock-jwt';

const AUTH_FILE = 'tests/e2e/.auth/state.json';

/**
 * GOVERN-11 auth.setup.ts: 用两种模式登录 ——
 *   1) real（默认，E2E_AUTH_MODE=real）：调 loginViaApi() 拿真实 token
 *   2) mock（显式 E2E_AUTH_MODE=mock）：跳过 auth/login，mint 一个 dev JWT 注入 localStorage
 *
 * 系统级验收默认必须经过真实 IAM，确保生成的 storage state 能被真实 API 使用。
 * mock 仅用于没有后端依赖的本地页面壳测试，并且不会成为默认路径。
 */
setup('authenticate', async ({ page, request }) => {
  const mode = process.env.E2E_AUTH_MODE ?? 'real';
  if (mode === 'real') {
    await loginViaApi(page, request);
    await page.goto('/dashboard');
  } else {
    const { token, user } = mintMockToken();
    // 先进入同源页面，再写入 storage。这样即使登录页自身发起请求，
    // 也不会把 mock state 静默清掉；随后 reload 让 AuthProvider 读取新状态。
    await page.goto('/login');
    await page.evaluate(
      ({ t, u }) => {
        localStorage.setItem('mate_platform_token', t);
        localStorage.setItem('mate_platform_user', JSON.stringify(u));
      },
      { t: token, u: user },
    );
    await page.goto('/dashboard');
  }
  await expect(page).toHaveURL(/\/dashboard(?:\/.*)?$/);
  await page.context().storageState({ path: AUTH_FILE });
});
