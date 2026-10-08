import { expect, test, type Page, type APIResponse } from '@playwright/test';
/** Real provider ID from existing login UserInfo DTO; signed tenant from token.
 * Missing role claims confer no fallback privileges. Never export session state. */
export async function builderAuth(page: Page, incomplete = false) {
  let response!: APIResponse;
  for (let attempt = 1; attempt <= 3; attempt++) {
    response = await page.request.post(process.env.E2E_IAM_LOGIN_URL ?? 'http://127.0.0.1:8100/api/v1/iam/auth/login', {
      data: { username: process.env.E2E_USERNAME ?? 'admin', password: process.env.E2E_PASSWORD ?? 'admin123' }, timeout: 120_000,
    });
    test.info().annotations.push({ type: 'provider-login-http', description: `attempt ${attempt}: ${response.status()}` });
    if (![502, 503, 504].includes(response.status())) break;
  }
  expect(response.ok(), `Provider login HTTP ${response.status()}`).toBeTruthy();
  const reply = await response.json();
  const token: string = reply.accessToken;
  const id: string = reply.userId ?? reply.user?.id;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  expect(typeof id === 'string' && !!id.trim(), 'Provider UserInfo identity required').toBeTruthy();
  expect(typeof claims.tenant_id === 'string' && !!claims.tenant_id.trim(), 'Signed tenant required').toBeTruthy();
  const roles = reply.user?.roles ?? claims.realm_access?.roles ?? [];
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('mate_platform_token', token);
    localStorage.setItem('mate_platform_user', JSON.stringify(user));
    localStorage.setItem('mate_access_token', token);
    localStorage.setItem('mate_tenant_id', user.tenantId);
  }, { token, user: { id: incomplete ? '' : id, username: reply.username ?? reply.user?.username ?? '当前用户', tenantId: claims.tenant_id, roles } });
  return { token, tenantId: claims.tenant_id as string };
}
