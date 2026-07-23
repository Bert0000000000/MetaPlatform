import { get, post, put, del } from './client';
import type { UserSettings, ApiToken, ActiveSession, ThemeMode } from '@/types';
import { getUser } from '@/utils/auth';

const SETTINGS_KEY = 'mate_platform_settings';

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  defaultPage: '/dashboard',
  theme: 'light',
  layout: ['metrics', 'approvals', 'workers', 'notifications'],
};

function getTenantId(): string | undefined {
  return getUser()?.tenantId;
}

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

interface SettingsResponse {
  userId: string;
  language: string;
  timezone: string;
  dateFormat: string;
  defaultPage: string;
  theme: ThemeMode;
  layout: string[];
}

interface ApiKeyResponse {
  apiKeyId: string;
  name: string;
  keyPrefix: string;
  userId: string;
  scopes: string[];
  status: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiKeyCreatedResponse {
  apiKeyId: string;
  name: string;
  keyPrefix: string;
  apiKey: string;
  userId: string;
  scopes: string[];
  status: string;
  expiresAt?: string;
  createdAt: string;
}

interface SessionResponse {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActiveAt: string;
  current: boolean;
}

function mapSettings(res: SettingsResponse): UserSettings {
  return {
    language: res.language,
    timezone: res.timezone,
    dateFormat: res.dateFormat,
    defaultPage: res.defaultPage,
    theme: res.theme,
    layout: Array.isArray(res.layout) ? res.layout : DEFAULT_SETTINGS.layout,
  };
}

function mapApiToken(res: ApiKeyResponse): ApiToken {
  return {
    id: res.apiKeyId,
    name: res.name,
    token: `${res.keyPrefix}…`,
    createdAt: res.createdAt,
    lastUsedAt: res.lastUsedAt,
    expiresAt: res.expiresAt,
  };
}

function mapSession(res: SessionResponse): ActiveSession {
  return {
    id: res.id,
    device: res.device,
    ip: res.ip,
    location: res.location,
    lastActiveAt: res.lastActiveAt,
    current: res.current,
  };
}

/**
 * 获取当前用户偏好设置。
 * 调用方应处于已登录态（ProtectedRoute 已保证）；未登录时直接抛错由全局拦截器处理。
 */
export async function getSettings(): Promise<UserSettings> {
  const userId = getUser()?.id;
  const remote = await get<SettingsResponse>('/v1/dashboard/settings', { userId });
  const settings = mapSettings(remote);
  writeLocal(SETTINGS_KEY, settings);
  return settings;
}

/**
 * 更新偏好设置：远端写入 + 本地缓存同步，保证即时生效。
 */
export async function updateSettings(settings: Partial<UserSettings>): Promise<void> {
  const userId = getUser()?.id;
  await put<SettingsResponse>('/v1/dashboard/settings', { userId, ...settings });
  const current = readLocal<UserSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  writeLocal(SETTINGS_KEY, { ...current, ...settings });
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  await updateSettings({ theme });
}

export async function getApiTokens(): Promise<ApiToken[]> {
  const tenantId = getTenantId();
  const page = await get<{ items: ApiKeyResponse[] }>('/v1/dashboard/api-keys', {
    tenantId: tenantId || 'tenant-default',
    page: 0,
    size: 100,
  });
  return Array.isArray(page?.items) ? page.items.map(mapApiToken) : [];
}

export async function createApiToken(name: string, expiresAt?: string): Promise<ApiToken> {
  const tenantId = getTenantId() || 'tenant-default';
  const userId = getUser()?.id;
  const remote = await post<ApiKeyCreatedResponse>('/v1/dashboard/api-keys', {
    tenantId,
    name,
    userId,
    scopes: [],
    expiresAt,
  });
  return {
    id: remote.apiKeyId,
    name: remote.name,
    token: remote.apiKey,
    createdAt: remote.createdAt,
    expiresAt: remote.expiresAt,
  };
}

export async function revokeApiToken(id: string): Promise<void> {
  await del<void>(`/v1/dashboard/api-keys/${id}`);
}

/**
 * 获取当前用户的活动会话列表。后端可能返回空数组；空数组即代表无活动会话。
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const userId = getUser()?.id;
  const remote = await get<SessionResponse[]>('/v1/dashboard/sessions', { userId });
  return Array.isArray(remote) ? remote.map(mapSession) : [];
}

export async function revokeSession(id: string): Promise<void> {
  await del<void>(`/v1/dashboard/sessions/${id}`);
}
