import { test, expect } from '@playwright/test';

/** Auth setup: login once against the live backend, save storageState for reuse. */
test('authenticate against live backend', async ({ page, request }) => {
  const resp = await request.post('http://localhost:9250/api/v1/iam/auth/login', {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  const token: string = body.accessToken;
  expect(token).toBeTruthy();

  await page.addInitScript(
    ({ t, u }) => {
      localStorage.setItem('mate_platform_token', t);
      localStorage.setItem('mate_platform_user', JSON.stringify(u));
    },
    {
      t: token,
      u: {
        id: body.userId ?? '1',
        username: body.username ?? 'admin',
        realName: body.realName ?? 'admin',
        tenantId: 'tenant-default',
        roles: ['PLATFORM_SUPER_ADMIN'],
      },
    },
  );
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.context().storageState({ path: 'tests/e2e/.auth/state.json' });
});
