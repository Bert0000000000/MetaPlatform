/**
 * 统一认证 Token 管理
 *
 * 所有 APP 通过 @mate/shared 引用，保证多应用间登录态一致。
 */

const TOKEN_KEY = 'mate_platform_token';
const USER_KEY = 'mate_platform_user';
const REFRESH_TOKEN_KEY = 'mate_platform_refresh_token';

export interface AuthUser {
  id: string;
  username: string;
  tenantId: string;
  roles?: string[];
  realName?: string;
  email?: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getTenantId(): string | null {
  return getUser()?.tenantId ?? null;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
