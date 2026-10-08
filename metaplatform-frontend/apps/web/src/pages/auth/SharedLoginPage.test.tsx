import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SharedLoginPage from '../../../../../packages/shared/src/components/SharedLoginPage';
import { AuthProvider, useAuth } from '../../../../../packages/shared/src/auth/AuthProvider';
import * as api from '../../../../../packages/shared/src/api';

vi.mock('../../../../../packages/shared/src/api', () => ({
  login: vi.fn(), listEnabledSsoProviders: vi.fn(), getSsoAuthorizeUrl: vi.fn(),
  ssoCallback: vi.fn(), matchPreset: () => undefined,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/login');
  vi.mocked(api.listEnabledSsoProviders).mockResolvedValue([]);
});
afterEach(cleanup);
function PersonalPage() {
  const { user } = useAuth();
  return <h1>个人页面 {user?.id}</h1>;
}
function mount() {
  return render(<AuthProvider><MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<SharedLoginPage defaultUsername="entered-person" defaultPassword="entered-password" defaultTenantId="existing-tenant" redirectTo="/personal" />} />
    <Route path="/personal" element={<PersonalPage />} />
  </Routes></MemoryRouter></AuthProvider>);
}
function expectNoPersonalSession() {
  expect(localStorage.getItem('mate_platform_user')).toBeNull();
  expect(localStorage.getItem('mate_platform_token')).toBeNull();
  expect(screen.queryByRole('heading', { name: /个人页面/ })).toBeNull();
  expect(screen.getByPlaceholderText('用户名')).toHaveValue('entered-person');
  expect(screen.getByPlaceholderText('密码')).toHaveValue('entered-password');
  expect(screen.getByTestId('shared-login-submit')).toBeEnabled();
}

it.each([
  { accessToken: 'fixture-access' },
  { accessToken: 'fixture-access', userId: '', user: { id: '', username: 'provider-person' } },
  { accessToken: 'fixture-access', userId: '   ' },
  { accessToken: '', userId: 'provider-person-42' },
  { accessToken: '   ', userId: 'provider-person-42' },
])('rejects incomplete password-login identity and preserves input for retry: %j', async (response) => {
  vi.mocked(api.login).mockResolvedValueOnce(response);
  mount();
  fireEvent.click(screen.getByTestId('shared-login-submit'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/身份|令牌/);
  expectNoPersonalSession();
  vi.mocked(api.login).mockResolvedValueOnce({ accessToken: 'fixture-access', userId: 'provider-person-42', username: 'provider-person' });
  fireEvent.click(screen.getByTestId('shared-login-submit'));
  expect(await screen.findByRole('heading', { name: '个人页面 provider-person-42' })).toBeVisible();
});

it('establishes a session with the existing nested UserInfo DTO identity', async () => {
  vi.mocked(api.login).mockResolvedValueOnce({ accessToken: 'fixture-access', refreshToken: 'fixture-refresh', user: { id: 'provider-person-42', username: 'provider-person' } });
  mount();
  fireEvent.click(screen.getByTestId('shared-login-submit'));
  await screen.findByRole('heading', { name: '个人页面 provider-person-42' });
  expect(JSON.parse(localStorage.getItem('mate_platform_user')!)).toMatchObject({ id: 'provider-person-42', username: 'provider-person', tenantId: 'existing-tenant' });
  expect(localStorage.getItem('mate_platform_token')).toBe('fixture-access');
  expect(localStorage.getItem('mate_platform_refresh_token')).toBe('fixture-refresh');
});

it.each([
  { accessToken: 'fixture-access' },
  { accessToken: 'fixture-access', userId: '   ' },
  { userId: 'provider-person-42' },
  { accessToken: '   ', userId: 'provider-person-42' },
])('rejects incomplete SSO callback without creating a personal session: %j', async (response) => {
  window.history.replaceState({}, '', '/login?code=fixture-code&state=fixture-state');
  sessionStorage.setItem('sso_provider', 'fixture-provider');
  sessionStorage.setItem('sso_state', 'fixture-state');
  vi.mocked(api.ssoCallback).mockResolvedValueOnce(response);
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(/身份|令牌/);
  await waitFor(() => expect(screen.getByTestId('shared-login-submit')).toBeEnabled());
  expectNoPersonalSession();
});

it('establishes a valid SSO session and consumes its callback state', async () => {
  window.history.replaceState({}, '', '/login?code=fixture-code&state=fixture-state');
  sessionStorage.setItem('sso_provider', 'fixture-provider');
  sessionStorage.setItem('sso_state', 'fixture-state');
  vi.mocked(api.ssoCallback).mockResolvedValueOnce({ accessToken: 'fixture-access', userId: 'provider-person-42', username: 'provider-person' });
  mount();
  expect(await screen.findByRole('heading', { name: '个人页面 provider-person-42' })).toBeVisible();
  expect(sessionStorage.getItem('sso_state')).toBeNull();
  expect(sessionStorage.getItem('sso_provider')).toBeNull();
  expect(localStorage.getItem('mate_platform_token')).toBe('fixture-access');
});
