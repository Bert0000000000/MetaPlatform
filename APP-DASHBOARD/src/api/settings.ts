import { get, post, put, del } from './client';
import type { UserSettings, ApiToken, ActiveSession, ThemeMode } from '@/types';

const SETTINGS_KEY = 'mate_platform_settings';
const TOKENS_KEY = 'mate_platform_api_tokens';
const SESSIONS_KEY = 'mate_platform_active_sessions';

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  defaultPage: '/dashboard',
  theme: 'light',
  layout: ['metrics', 'approvals', 'workers', 'notifications'],
};

/**
 * Best-effort read from localStorage. Returns undefined when not present or invalid.
 * Used as a fallback when the backend IAM settings API is not yet available.
 */
function readLocal<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export async function getSettings(): Promise<UserSettings> {
  try {
    const remote = await get<UserSettings>('/v1/iam/settings');
    writeLocal(SETTINGS_KEY, remote);
    return remote;
  } catch {
    return readLocal<UserSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  }
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<void> {
  try {
    await put('/v1/iam/settings', settings);
  } catch {
    // Backend not ready: fall through to local persistence.
  }
  // Always keep localStorage in sync so reloads + SettingsContext stay consistent.
  const current = readLocal<UserSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  writeLocal(SETTINGS_KEY, { ...current, ...settings });
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  await updateSettings({ theme });
}

export async function getApiTokens(): Promise<ApiToken[]> {
  try {
    const remote = await get<ApiToken[]>('/v1/iam/tokens');
    writeLocal(TOKENS_KEY, remote);
    return remote;
  } catch {
    return readLocal<ApiToken[]>(TOKENS_KEY) ?? [];
  }
}

export async function createApiToken(name: string, expiresAt?: string): Promise<ApiToken> {
  const token: ApiToken = {
    id: `local-${Date.now()}`,
    name,
    token: `mate.${btoa(`${name}:${Date.now()}`)}.${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    expiresAt,
  };
  try {
    const remote = await post<ApiToken>('/v1/iam/tokens', { name, expiresAt });
    const list = readLocal<ApiToken[]>(TOKENS_KEY) ?? [];
    writeLocal(TOKENS_KEY, [remote, ...list]);
    return remote;
  } catch {
    const list = readLocal<ApiToken[]>(TOKENS_KEY) ?? [];
    writeLocal(TOKENS_KEY, [token, ...list]);
    return token;
  }
}

export async function revokeApiToken(id: string): Promise<void> {
  try {
    await del<void>(`/v1/iam/tokens/${id}`);
  } catch {
    // Backend not ready: local-only removal below.
  }
  const list = readLocal<ApiToken[]>(TOKENS_KEY) ?? [];
  writeLocal(TOKENS_KEY, list.filter((t) => t.id !== id));
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  try {
    const remote = await get<ActiveSession[]>('/v1/iam/sessions');
    writeLocal(SESSIONS_KEY, remote);
    return remote;
  } catch {
    // Synthesize a "current session" entry so the UI always has something to show.
    const fallback: ActiveSession[] = [
      {
        id: 'current',
        device: navigator.userAgent.includes('Chrome')
          ? 'Chrome on Desktop'
          : navigator.userAgent.includes('Firefox')
            ? 'Firefox on Desktop'
            : 'Current Browser',
        ip: '127.0.0.1',
        location: '本地',
        lastActiveAt: new Date().toISOString(),
        current: true,
      },
    ];
    return readLocal<ActiveSession[]>(SESSIONS_KEY) ?? fallback;
  }
}

export async function revokeSession(id: string): Promise<void> {
  try {
    await del<void>(`/v1/iam/sessions/${id}`);
  } catch {
    // Backend not ready: local-only removal below.
  }
  const list = readLocal<ActiveSession[]>(SESSIONS_KEY) ?? [];
  writeLocal(SESSIONS_KEY, list.filter((s) => s.id !== id));
}
