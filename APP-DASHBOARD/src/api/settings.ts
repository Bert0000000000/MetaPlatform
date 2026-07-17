import { get, post, put, del } from './client';
import type { UserSettings, ApiToken, ActiveSession, ThemeMode } from '@/types';

const SETTINGS_KEY = 'mate_dash_settings';

const DEFAULT_SETTINGS: UserSettings = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  defaultPage: '/dashboard',
  theme: 'light',
  layout: ['metrics', 'approvals', 'workers', 'notifications'],
};

const MOCK_TOKENS: ApiToken[] = [
  {
    id: 'tok1',
    name: 'CI/CD Token',
    token: 'mp_xxx****xxxx',
    createdAt: '2026-06-01T10:00:00Z',
    lastUsedAt: '2026-07-17T08:00:00Z',
    expiresAt: '2026-12-31T23:59:59Z',
  },
];

const MOCK_SESSIONS: ActiveSession[] = [
  {
    id: 's1',
    device: 'Chrome / Windows',
    ip: '192.168.1.100',
    location: '上海',
    lastActiveAt: '2026-07-17T11:00:00Z',
    current: true,
  },
  {
    id: 's2',
    device: 'Safari / iPhone',
    ip: '10.0.0.5',
    location: '北京',
    lastActiveAt: '2026-07-16T20:00:00Z',
    current: false,
  },
];

export async function getSettings(): Promise<UserSettings> {
  try {
    return await get<UserSettings>('/v1/iam/settings');
  } catch {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<void> {
  try {
    await put('/v1/iam/settings', settings);
  } catch {
    const current = await getSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  }
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  await updateSettings({ theme });
}

export async function getApiTokens(): Promise<ApiToken[]> {
  try {
    return await get<ApiToken[]>('/v1/iam/tokens');
  } catch {
    return MOCK_TOKENS;
  }
}

export async function createApiToken(name: string, expiresAt?: string): Promise<ApiToken> {
  try {
    return await post<ApiToken>('/v1/iam/tokens', { name, expiresAt });
  } catch {
    return {
      id: `tok_${Date.now()}`,
      name,
      token: `mp_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
  }
}

export async function revokeApiToken(id: string): Promise<void> {
  try {
    await del(`/v1/iam/tokens/${id}`);
  } catch {
    // mock
  }
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  try {
    return await get<ActiveSession[]>('/v1/iam/sessions');
  } catch {
    return MOCK_SESSIONS;
  }
}

export async function revokeSession(id: string): Promise<void> {
  try {
    await del(`/v1/iam/sessions/${id}`);
  } catch {
    // mock
  }
}
