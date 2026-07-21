const TOKEN_KEY = 'mate_platform_token';
const USER_KEY = 'mate_platform_user';

export interface AuthUser {
  id: string;
  username: string;
  tenantId: string;
  roles?: string[];
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
