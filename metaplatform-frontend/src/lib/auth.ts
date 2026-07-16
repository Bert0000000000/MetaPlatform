/**
 * MetaPlatform Auth State Management
 * Handles token and user storage in localStorage.
 */

const TOKEN_KEY = "metaplatform_token";
const USER_KEY = "metaplatform_user";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

export function getToken(): string | null {
  // Fall back to legacy key so existing sessions are preserved
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("mp_token");
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
