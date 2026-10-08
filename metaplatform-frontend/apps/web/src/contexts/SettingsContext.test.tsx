import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from './SettingsContext';
import { getSettings } from '@/api/settings';

vi.mock('@/api/settings', () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
function Probe() {
  const { settings, resolvedTheme, loading } = useSettings();
  return <output>{JSON.stringify({ theme: settings.theme, resolvedTheme, language: settings.language, loading })}</output>;
}
beforeEach(() => {
  vi.stubGlobal('localStorage', window.localStorage);
  localStorage.clear();
  vi.mocked(getSettings).mockRejectedValue(new Error('settings unavailable'));
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('新用户浅色默认与已有主题保留', () => {
  it('成功加载 IAM 新用户浅色默认时应用到主题并缓存', async () => {
    vi.mocked(getSettings).mockResolvedValue({ theme: 'light', language: 'zh-CN', timezone: 'Asia/Shanghai',
      dateFormat: 'YYYY-MM-DD HH:mm:ss', defaultPage: '/dashboard',
      layout: ['metrics', 'approvals', 'workers', 'notifications'] });
    render(<SettingsProvider><Probe /></SettingsProvider>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"loading":false'));
    expect(document.body).toHaveAttribute('theme-mode', 'light');
    expect(JSON.parse(localStorage.getItem('mate_platform_settings')!)).toMatchObject({ theme: 'light' });
  });
  it('无本地主题且远端不可用时首次显示浅色', async () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"loading":false'));
    expect(document.body).toHaveAttribute('theme-mode', 'light');
  });
  it.each(['dark', 'system'] as const)('保留本地 %s 与系统解析', async theme => {
    localStorage.setItem('mate_platform_settings', JSON.stringify({ theme }));
    render(<SettingsProvider><Probe /></SettingsProvider>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"loading":false'));
    expect(screen.getByRole('status')).toHaveTextContent(`"theme":"${theme}"`);
    expect(document.body).toHaveAttribute('theme-mode', 'dark');
  });
  it.each(['dark', 'system'] as const)('远端已有 %s 优先于新默认且保留其他偏好', async theme => {
    localStorage.setItem('mate_platform_settings', JSON.stringify({ language: 'en-US' }));
    vi.mocked(getSettings).mockResolvedValue({ theme, language: 'en-US', timezone: 'Asia/Shanghai',
      dateFormat: 'YYYY-MM-DD HH:mm:ss', defaultPage: '/home', layout: [] });
    render(<SettingsProvider><Probe /></SettingsProvider>);
    await waitFor(() => expect(document.body).toHaveAttribute('theme-mode', 'dark'));
    expect(screen.getByRole('status')).toHaveTextContent(`"theme":"${theme}"`);
    expect(screen.getByRole('status')).toHaveTextContent('"language":"en-US"');
  });
});
