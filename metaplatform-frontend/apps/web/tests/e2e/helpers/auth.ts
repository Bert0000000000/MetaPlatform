/**
 * E2E 鉴权 helper：用真实 IAM 链路拿 JWT（POST /api/v1/iam/auth/login），
 * 注入到 page localStorage 后跳过 UI 登录。
 *
 * <p>为什么不用 UI 登录：
 * <ul>
 *   <li>dev 模式 React 18 root delegation + Vite HMR 下 Semi Button 的 native
 *       onclick 被截成 noop（CLAUDE.md dev-mode 已知坑）。</li>
 *   <li>stage 3 之前用错 endpoint（/auth/login 而不是 /iam/auth/login），导致 30s
 *       超时 + JWT 过期。本 helper 直接走对 endpoint，避开所有 UI 路径。</li>
 * </ul>
 * </p>
 *
 * <p>用法：
 * <pre>
 *   await injectAuth(context, page);  // 每个 spec 的开头
 *   await page.goto('/ontology');
 * </pre>
 * </p>
 */
import type { BrowserContext, Page, APIRequestContext } from '@playwright/test';

const IAM_LOGIN_URL =
  process.env.E2E_IAM_LOGIN_URL ?? 'http://127.0.0.1:8100/api/v1/iam/auth/login';
const IAM_USERNAME = process.env.E2E_USERNAME ?? 'admin';
const IAM_PASSWORD = process.env.E2E_PASSWORD ?? 'admin123';

/**
 * 用 page.request 走真实 IAM 登录拿 access token；同时校验返回结构。
 * 失败抛 Error 包含 HTTP code + 响应体前 200 字符。
 */
export async function fetchAccessToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post(IAM_LOGIN_URL, {
    data: { username: IAM_USERNAME, password: IAM_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
  });
  const body = await resp.text();
  if (!resp.ok()) {
    throw new Error(`IAM login HTTP ${resp.status()}: ${body.slice(0, 200)}`);
  }
  let parsed: { accessToken?: string; expiresIn?: number };
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    throw new Error(`IAM login response not JSON: ${body.slice(0, 200)}`);
  }
  if (!parsed.accessToken) {
    throw new Error(`IAM login no accessToken field: ${body.slice(0, 200)}`);
  }
  return parsed.accessToken;
}

/**
 * 解 JWT payload（不验签，只取 sub / tenant_id / preferred_username 等）。
 * 用于构造前端 store 期望的 user JSON 字符串。
 */
export interface JwtClaims {
  sub?: string;
  preferred_username?: string;
  tenant_id?: string;
  realm_access?: { roles?: string[] };
  name?: string;
  email?: string;
}

export function decodeJwtPayload(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Malformed JWT');
  const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
  const json = Buffer.from(padded, 'base64url').toString('utf-8');
  return JSON.parse(json) as JwtClaims;
}

/**
 * 把 JWT + user JSON 注入 page 的 localStorage（在 page load 之前执行，
 * 任何路由组件 mount 时 token 已在）。
 *
 * <p>前端 `apps/web/src/utils/auth.ts` 真实 storage keys：
 * <ul>
 *   <li>mate_platform_token — JWT</li>
 *   <li>mate_platform_user — AuthUser JSON（id/username/tenantId/roles）</li>
 * </ul>
 * </p>
 */
export async function injectAuthIntoPage(
  page: Page,
  token: string,
  opts: { tenantId?: string } = {},
): Promise<void> {
  const claims = decodeJwtPayload(token);
  const tenantId = opts.tenantId ?? claims.tenant_id ?? 'tenant-default';
  const userJson = JSON.stringify({
    id: claims.sub ?? 'unknown',
    username: claims.preferred_username ?? IAM_USERNAME,
    realName: claims.name ?? 'Platform Admin',
    tenantId,
    roles: claims.realm_access?.roles ?? ['PLATFORM_ADMIN'],
  });

  const initScript = `
    (() => {
      try {
        localStorage.setItem('mate_platform_token', ${JSON.stringify(token)});
        localStorage.setItem('mate_platform_user', ${JSON.stringify(userJson)});
        localStorage.setItem('mate_access_token', ${JSON.stringify(token)});
        localStorage.setItem('mate_tenant_id', ${JSON.stringify(tenantId)});
      } catch (e) {
        console.warn('[injectAuth] localStorage write failed', e);
      }
    })();
  `;
  await page.addInitScript({ content: initScript });
}

/**
 * 一站式 helper：登录 + 注入。
 * 在 test.beforeEach 里 await 这个即可。
 */
export async function injectAuth(
  context: BrowserContext,
  page: Page,
): Promise<string> {
  await context.clearCookies();
  const token = await fetchAccessToken(page.request);
  await injectAuthIntoPage(page, token);
  return token;
}
