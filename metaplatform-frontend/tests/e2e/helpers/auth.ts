import { type APIRequestContext, type Page } from '@playwright/test';

/**
 * Real-auth helper: logs in against the live backend gateway (via Vite proxy),
 * then injects the real token + user into the page so every page load is
 * authenticated against the actual backend (not mocks).
 */
export const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8100/api/v1';

export async function loginViaApi(
  page: Page,
  request: APIRequestContext,
  username = 'admin',
  password = 'admin123',
) {
  const resp = await request.post(`${GATEWAY}/iam/auth/login`, {
    data: { username, password },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  const token: string = body.accessToken ?? body.token ?? body.data?.accessToken;
  if (!token) {
    throw new Error(`No accessToken in login response: ${JSON.stringify(body).slice(0, 300)}`);
  }
  const user = {
    id: body.userId ?? body.user?.id ?? '1',
    username: body.username ?? body.user?.username ?? username,
    realName: body.realName ?? body.user?.realName ?? username,
    tenantId: 'tenant-default',
    roles: ['PLATFORM_SUPER_ADMIN'],
  };
  await page.addInitScript(
    ({ t, u }) => {
      localStorage.setItem('mate_platform_token', t);
      localStorage.setItem('mate_platform_user', JSON.stringify(u));
    },
    { t: token, u: user },
  );
  return { token, user };
}

/** Capture all API responses on the page so tests can assert no 4xx/5xx slipped through. */
export function trackApiFailures(page: Page, label = 'page') {
  const failures: Array<{ method: string; url: string; status: number }> = [];
  page.on('response', (resp) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    const status = resp.status();
    if (status >= 400 && status !== 401) {
      failures.push({ method: resp.request().method(), url, status });
    }
  });
  return {
    failures,
    report() {
      return failures
        .map((f) => `${f.method} ${f.url.replace(/http:\/\/[^/]+/, '')} -> ${f.status}`)
        .join('\n');
    },
  };
}
