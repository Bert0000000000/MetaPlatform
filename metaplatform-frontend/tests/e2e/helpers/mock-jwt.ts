/**
 * GOVERN-11: mint a deterministic dev JWT (HS256) — 不依赖 auth/login 端点。
 * 配合 auth.setup.ts 在 E2E_AUTH_MODE=mock 下使用，绕过当前 dev 栈
 * mate-auth-service /api/v1/iam/auth/login 500 的阻塞。
 *
 * secret 沿用 LEGACY_LOGIN_COMPAT 的 dev 默认（auth/verifier.py: KeycloakDevSecret）。
 * 真实 CI 环境必须切到 E2E_AUTH_MODE=real + 配套 secrets。
 */
import { createHmac } from 'node:crypto';

export interface MockUser {
  id: string;
  username: string;
  realName: string;
  tenantId: string;
  roles: string[];
}

export interface MockToken {
  token: string;
  user: MockUser;
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function mintMockToken(opts: {
  tenantId?: string;
  username?: string;
} = {}): MockToken {
  const tenantId = opts.tenantId ?? 'tenant-default';
  const username = opts.username ?? 'admin';
  const user: MockUser = {
    id: '1',
    username,
    realName: username,
    tenantId,
    roles: ['PLATFORM_SUPER_ADMIN'],
  };
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  // 沿用 mate-tech-dw 等 dev 栈 verifier 的 audit 字段。auth/config.py 在
  // INSECURE_SKIP_SIGNATURE=true 时跳过签名，但仍强制验 aud / iss。
  // verifier/auth/verifier.py:185-196 期望 Keycloak protocol mapper 风格
  // （attributes.tenant_id），缺 fallback 到 top-level `tenant`。
  const payload = {
    sub: user.id,
    preferred_username: user.username,
    attributes: { tenant_id: [tenantId] },
    tenant: tenantId,
    realm_access: { roles: user.roles },
    resource_access: {
      metaplatform_backend: { roles: user.roles },
    },
    aud: 'metaplatform-backend',
    iss:
      process.env.E2E_JWT_ISS ??
      'http://keycloak:8080/realms/metaplatform',
    azp: 'metaplatform-frontend',
    iat: now,
    exp: now + 3600,
  };
  const secret =
    process.env.E2E_JWT_SECRET ?? 'mate-platform-dev-secret-do-not-use-in-prod';
  const enc = (o: object) => base64url(JSON.stringify(o));
  const h = enc(header);
  const p = enc(payload);
  const sig = createHmac('sha256', secret)
    .update(`${h}.${p}`)
    .digest();
  const token = `${h}.${p}.${base64url(sig)}`;
  return { token, user };
}