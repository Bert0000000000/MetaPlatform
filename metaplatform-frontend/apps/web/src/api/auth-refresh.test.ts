import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../../../../packages/shared/src/api/client';
import { apiClient as webClient } from './client';

vi.mock('../../../../packages/shared/src/api/toast', () => ({ toast: vi.fn() }));
vi.mock('@mate/shared', () => ({ toast: vi.fn() }));

const refreshPath = '/api/v1/iam/auth/refresh';
const resourcePath = '/dw/employees/employee-source/conversations';
const originalAdapter = axios.defaults.adapter;
const originalWebAdapter = webClient.defaults.adapter;

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { status, statusText: status === 200 ? 'OK' : 'Unauthorized', data, headers: new AxiosHeaders(), config };
}

function rejected(config: InternalAxiosRequestConfig, status = 401) {
  return new AxiosError(status === 401 ? 'missing user context' : 'unbounded retry reached the transport guard',
    'ERR_BAD_REQUEST', config, undefined, response(config, { detail: 'missing user context' }, status));
}

function clientFor(kind: 'shared' | 'web', adapter: AxiosAdapter): AxiosInstance {
  axios.defaults.adapter = adapter;
  const client = kind === 'shared' ? createApiClient({ baseURL: '/api/v1' }) : webClient;
  client.defaults.adapter = adapter;
  return client;
}

beforeEach(() => {
  // Browser storage is an external boundary, unavailable in this Node runner.
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  });
  localStorage.clear();
  localStorage.setItem('mate_platform_token', 'initial-access');
  localStorage.setItem('mate_platform_refresh_token', 'initial-refresh');
  localStorage.setItem('mate_platform_user', JSON.stringify({ id: 'source-user', tenantId: 'source-tenant' }));
  // Navigation is an external browser boundary; preserve the web client's real exit decision.
  vi.stubGlobal('window', { location: { pathname: '/agents/employee-source', href: '/agents/employee-source' } });
});

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
  webClient.defaults.adapter = originalWebAdapter;
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe.each(['shared', 'web'] as const)('%s client 401 refresh boundary', (kind) => {
  it('rejects a repeated 401 after one successful refresh and one replay', async () => {
    let reads = 0;
    let refreshes = 0;
    const client = clientFor(kind, async config => {
      if (config.url === refreshPath) {
        refreshes += 1;
        return response(config, { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
      }
      reads += 1;
      // Let the old unbounded implementation fail promptly instead of hanging the runner.
      if (reads > 2) throw rejected(config, 503);
      throw rejected(config);
    });

    await expect(client.get(resourcePath)).rejects.toMatchObject(
      kind === 'shared' ? { status: 401, payload: { detail: 'missing user context' } }
        : { response: { status: 401, data: { detail: 'missing user context' } } },
    );
    expect(reads).toBe(2);
    expect(refreshes).toBe(1);
    if (kind === 'web') {
      expect(localStorage.getItem('mate_platform_token')).toBeNull();
      expect(window.location.href).toBe('/login');
    }
  });

  it('replays an expired original request with the actual refreshed token and returns the successful read', async () => {
    const requests: Array<{ path?: string; authorization: string }> = [];
    let refreshes = 0;
    const client = clientFor(kind, async config => {
      if (config.url === refreshPath) {
        refreshes += 1;
        return response(config, { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
      }
      requests.push({ path: config.url, authorization: String(config.headers.get('Authorization')) });
      if (requests.length === 1) throw rejected(config);
      return response(config, { items: [{ conversationId: 'source-conversation' }] });
    });

    const result = await client.get(resourcePath);

    expect(result.data).toEqual({ items: [{ conversationId: 'source-conversation' }] });
    expect(requests).toEqual([
      { path: resourcePath, authorization: 'Bearer initial-access' },
      { path: resourcePath, authorization: 'Bearer fresh-access' },
    ]);
    expect(refreshes).toBe(1);
    expect(localStorage.getItem('mate_platform_refresh_token')).toBe('fresh-refresh');
  });

  it('rejects the original 401 when refresh is denied without replaying or retaining the stale login', async () => {
    let reads = 0;
    let refreshes = 0;
    const client = clientFor(kind, async config => {
      if (config.url === refreshPath) {
        refreshes += 1;
        throw rejected(config);
      }
      reads += 1;
      throw rejected(config);
    });

    await expect(client.get(resourcePath)).rejects.toMatchObject(kind === 'shared'
      ? { status: 401 } : { response: { status: 401 } });
    expect(reads).toBe(1);
    expect(refreshes).toBe(1);
    expect(localStorage.getItem('mate_platform_token')).toBeNull();
    expect(localStorage.getItem('mate_platform_refresh_token')).toBeNull();
  });

  it('shares a simultaneous refresh while bounding each independent original request', async () => {
    let refreshes = 0;
    const reads = new Map<string, number>();
    let finishRefresh!: () => void;
    const refreshReady = new Promise<void>(resolve => { finishRefresh = resolve; });
    const client = clientFor(kind, async config => {
      if (config.url === refreshPath) {
        refreshes += 1;
        await refreshReady;
        return response(config, { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
      }
      const path = config.url ?? '';
      const count = (reads.get(path) ?? 0) + 1;
      reads.set(path, count);
      if (count === 1) throw rejected(config);
      return response(config, { path });
    });
    const first = client.get(resourcePath);
    const second = client.get('/dw/employees/another-source/conversations');
    await vi.waitFor(() => expect(refreshes).toBe(1));
    finishRefresh();

    const results = await Promise.all([first, second]);

    expect(results).toHaveLength(2);
    expect(refreshes).toBe(1);
    expect(Array.from(reads.values())).toEqual([2, 2]);
  });
});

it('keeps the web login-page 401 exception without issuing a refresh or navigation', async () => {
  window.location.pathname = '/login';
  window.location.href = '/login';
  let refreshes = 0;
  const client = clientFor('web', async config => {
    if (config.url === refreshPath) refreshes += 1;
    throw rejected(config);
  });

  await expect(client.get('/dashboard/settings')).rejects.toMatchObject({ response: { status: 401 } });
  expect(refreshes).toBe(0);
  expect(localStorage.getItem('mate_platform_token')).toBe('initial-access');
  expect(window.location.href).toBe('/login');
});

it('does not refresh again when the web request already refreshed its expiring token before sending', async () => {
  const expiredPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
  localStorage.setItem('mate_platform_token', `test.${expiredPayload}.test`);
  let reads = 0;
  let refreshes = 0;
  const client = clientFor('web', async config => {
    if (config.url === refreshPath) {
      refreshes += 1;
      return response(config, { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
    }
    reads += 1;
    if (reads > 2) throw rejected(config, 503);
    throw rejected(config);
  });

  await expect(client.get(resourcePath)).rejects.toMatchObject({ response: { status: 401 } });
  expect(reads).toBe(1);
  expect(refreshes).toBe(1);
  expect(localStorage.getItem('mate_platform_token')).toBeNull();
  expect(window.location.href).toBe('/login');
});
