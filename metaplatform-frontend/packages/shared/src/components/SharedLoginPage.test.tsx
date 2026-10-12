import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import SharedLoginPage from './SharedLoginPage';
import { createApiClient } from '../api/client';
const mocks = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('../api/toast', () => ({ toast: vi.fn() }));
vi.mock('../api', () => ({ login: mocks.login, listEnabledSsoProviders: async () => [], getSsoAuthorizeUrl: vi.fn(), ssoCallback: vi.fn(), matchPreset: vi.fn() }));
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); mocks.login.mockReset(); });
let root: Root;
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ""; });
async function mount() {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={['/login']}><AuthProvider><Routes>
    <Route path="/login" element={<SharedLoginPage redirectTo="/home" defaultTenantId="untrusted-hint" defaultUsername="writer" defaultPassword="fixture-only" />} />
    <Route path="/home" element={<p>Authenticated home</p>} />
  </Routes></AuthProvider></MemoryRouter>));
}
describe('verified login tenant', () => {
  it('persists the server verified tenant and restores authenticated home', async () => {
    mocks.login.mockResolvedValue({ userId: 'subject', username: 'writer', tenantId: 'verified-tenant', accessToken: 'fixture-token' });
    await mount(); await act(async () => { (document.querySelector('[data-testid=shared-login-submit]') as HTMLButtonElement).click(); });
    expect(document.body.textContent).toContain('Authenticated home');
    const tenant = JSON.parse(localStorage.getItem('mate_platform_user')!).tenantId;
    expect(tenant).toBe('verified-tenant');
  });
  it('fails closed when a provided verified tenant is empty', async () => {
    mocks.login.mockResolvedValue({ userId: 'subject', username: 'writer', tenantId: '', accessToken: 'fixture-token' });
    await mount(); await act(async () => { (document.querySelector('[data-testid=shared-login-submit]') as HTMLButtonElement).click(); });
    expect(document.body.textContent).not.toContain('Authenticated home');
    expect(document.body.textContent).toContain('登录响应缺少已验证的租户信息，请联系管理员');
    expect(localStorage.getItem('mate_platform_token')).toBeNull();
  });
  it('keeps legacy omitted tenant unknown so no caller hint is sent as a header', async () => {
    mocks.login.mockResolvedValue({ userId: 'subject', username: 'writer', accessToken: 'fixture-token' });
    await mount(); await act(async () => { (document.querySelector('[data-testid=shared-login-submit]') as HTMLButtonElement).click(); });
    expect(document.body.textContent).toContain('Authenticated home');
    const tenant = JSON.parse(localStorage.getItem('mate_platform_user')!).tenantId;
    expect(tenant).toBe('');
    let tenantHeader: unknown;
    const client=createApiClient();
    client.defaults.adapter=async config => { tenantHeader=config.headers.get('X-Tenant-Id'); return { config, status:200, statusText:'OK', headers:{}, data:{} }; };
    await client.get('/legacy-tenant-probe');
    expect(tenantHeader).toBeUndefined();
  });
});
