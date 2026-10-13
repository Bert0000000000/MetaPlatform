import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { toast } from '@mate/shared';
import { apiClient } from '@/api/client';
import { SettingsProvider } from '@/contexts/SettingsContext';
import ModelValidationPage from './ModelValidationPage';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, measureText: () => ({ width: 0 }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('@mate/shared', async importOriginal => ({ ...await importOriginal<typeof import('@mate/shared')>(), toast: vi.fn() }));

const a = 'ont.acme.obj.shacl-a.v1', b = 'ont.acme.obj.shacl-b.v1';
const originalAdapter = apiClient.defaults.adapter;
const originalURL = URL;
type Pending = { target: string; resolve: (response: AxiosResponse) => void; reject: (error: Error) => void; response: (data: unknown, status?: number) => AxiosResponse };
let pending: Pending[], blobs: Blob[], filenames: string[];
const passed = { conforms: true, violations: [], severity_counts: { Violation: 0, Warning: 0, Info: 0 }, stats: { individuals: 2 } };

beforeEach(() => {
  pending = []; blobs = []; filenames = [];
  vi.mocked(toast).mockClear();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() });
  localStorage.setItem('mate_platform_user', JSON.stringify({ tenantId: 'acme' }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('URL', class extends originalURL {
    static createObjectURL(blob: Blob) { blobs.push(blob); return 'blob:shacl-report'; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filenames.push(this.download); });
  // Replace only external transport. The mounted page, Semi controls and API client stay real.
  apiClient.defaults.adapter = config => {
    const path = config.url ?? '';
    const response = (data: unknown, status = 200): AxiosResponse => ({ data, status, statusText: 'OK', headers: {}, config });
    if (path.endsWith('/settings')) return Promise.resolve(response({}));
    if (path.endsWith('/lint/anti-patterns')) return Promise.resolve(response([]));
    if (path.endsWith('/object-types')) return Promise.resolve(response([a, b].map((rid, i) => ({ rid, display_name: `类型 ${i === 0 ? 'A' : 'B'}`, primary_key: [], properties: [], interfaces: [] }))));
    if (path.endsWith('/shacl/validate')) return new Promise((resolve, reject) => pending.push({ target: JSON.parse(config.data).target_class, resolve, reject, response }));
    return Promise.reject(new Error('Unexpected request: ' + path));
  };
});
afterEach(() => { cleanup(); apiClient.defaults.adapter = originalAdapter; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = () => render(<MemoryRouter><SettingsProvider><ModelValidationPage /></SettingsProvider></MemoryRouter>);
async function start() {
  const previous = pending.length;
  await waitFor(() => expect(screen.getByRole('button', { name: '校验' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '校验' }));
  await waitFor(() => expect(pending).toHaveLength(previous + 1));
}
async function select(label: string) {
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(label));
}
async function complete(index: number, data: unknown = passed) { await act(async () => pending[index].resolve(pending[index].response(data))); }
async function fail(index: number) { await act(async () => pending[index].reject(new Error('旧请求失败'))); }
const download = () => screen.getByRole('button', { name: '下载报告 JSON' });

describe('SHACL report target and request lifetime (transport controlled)', () => {
  it('clears a completed report immediately on switching target', async () => {
    mount(); await start(); await complete(0); expect(screen.getByText('✓ conforms')).toBeVisible();
    await select('类型 B'); expect(screen.queryByText('✓ conforms')).not.toBeInTheDocument();
    expect(screen.getByText(/尚未校验/)).toBeVisible();
  });
  it('keeps B loading when a late success from A arrives', async () => {
    mount(); await start(); await select('类型 B'); await start();
    expect(pending.map(request => request.target)).toEqual([a, b]);
    await complete(0); expect(screen.queryByText('✓ conforms')).not.toBeInTheDocument();
    expect(screen.getByText('正在校验当前类型…')).toBeVisible();
    await complete(1, { ...passed, violations: [{ severity: 'Info', message: '来自 B' }] });
    expect(screen.getByText('来自 B')).toBeVisible();
  });
  it('ignores a late A failure after B succeeds', async () => {
    mount(); await start(); await select('类型 B'); await start(); await complete(1); await fail(0);
    expect(screen.getByText('✓ conforms')).toBeVisible(); expect(screen.queryByText('旧请求失败')).not.toBeInTheDocument();
  });
  it('clears an accepted failure when changing targets', async () => {
    mount(); await start(); await fail(0); expect(screen.getByText('旧请求失败')).toBeVisible();
    await select('类型 B'); expect(screen.queryByText('旧请求失败')).not.toBeInTheDocument(); expect(download()).toBeDisabled();
  });
  it('invalidates an older A request even when the selection returns to A', async () => {
    mount(); await start(); await select('类型 B'); await select('类型 A'); await start();
    await complete(1, { ...passed, violations: [{ severity: 'Info', message: '新 A' }] });
    await complete(0, { ...passed, violations: [{ severity: 'Info', message: '旧 A' }] });
    expect(screen.getByText('新 A')).toBeVisible(); expect(screen.queryByText('旧 A')).not.toBeInTheDocument();
  });
  it('does not expose an unmounted request in a newly opened page', async () => {
    const view = mount(); await start(); view.unmount(); mount(); await start();
    await complete(0); expect(screen.queryByText('✓ conforms')).not.toBeInTheDocument(); expect(download()).toBeDisabled();
    await complete(1); expect(screen.getByText('✓ conforms')).toBeVisible();
  });
  it.each([500, 403])('suppresses the global toast of a stale HTTP %i failure', async status => {
    mount(); await start(); await select('类型 B'); await start(); await complete(1);
    const response = pending[0].response({ detail: '过期请求错误' }, status);
    await act(async () => pending[0].reject(new AxiosError('过期请求错误', 'ERR_BAD_RESPONSE', response.config, undefined, response)));
    expect(toast).not.toHaveBeenCalled(); expect(screen.getByText('✓ conforms')).toBeVisible();
  });
  it('suppresses a global error after unmount while preserving active request errors', async () => {
    const view = mount(); await start(); view.unmount(); await fail(0);
    expect(toast).not.toHaveBeenCalled(); mount(); await start(); await fail(1);
    expect(toast).toHaveBeenCalledWith('旧请求失败', 'error'); expect(screen.getByText('旧请求失败')).toBeVisible();
  });
});

describe('SHACL report handoff and severity', () => {
  it('downloads the complete original response bound to its actual target and receivedAt', async () => {
    mount(); expect(download()).toBeDisabled(); await start();
    const report = { ...passed, violations: [{ severity: 'Warning', message: '缺少说明', constraint: 'MinCount' }], severity_counts: { Violation: 0, Warning: 1, Info: 0 }, extra_evidence: { opaque: ['preserve'] } };
    await complete(0, report); expect(download()).toBeEnabled(); fireEvent.click(download());
    expect(blobs).toHaveLength(1); expect(filenames[0]).toMatch(/shacl.*\.json$/);
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blobs[0]); });
    const data = JSON.parse(text); expect(data.target_class).toBe(a); expect(data.report).toEqual(report);
    expect(data.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); expect(data.checkedAt).toBeUndefined(); expect(data.scope).toMatch(/当前.*类型/);
    await select('类型 B'); expect(download()).toBeDisabled();
  });
  it('disables downloads during a retry and after its failure', async () => {
    mount(); await start(); await complete(0); fireEvent.click(screen.getByRole('button', { name: '校验' }));
    await waitFor(() => expect(pending).toHaveLength(2)); expect(download()).toBeDisabled();
    await fail(1); expect(download()).toBeDisabled(); expect(screen.queryByText('✓ conforms')).not.toBeInTheDocument();
  });
  it('renders three levels and unknown values with separate labels and counts', async () => {
    mount(); await start(); await complete(0, { conforms: false, violations: ['Violation', 'Warning', 'Info', 'FutureLevel'].map(severity => ({ severity, message: severity + ' message' })), severity_counts: { Violation: 1, Warning: 1, Info: 1 }, stats: {} });
    expect(screen.getByText('违规 1').closest('.semi-tag')).toHaveClass('semi-tag-red-light'); expect(screen.getByText('警告 1').closest('.semi-tag')).toHaveClass('semi-tag-orange-light'); expect(screen.getByText('信息 1').closest('.semi-tag')).toHaveClass('semi-tag-blue-light');
    expect(screen.getByText('FutureLevel')).toBeVisible(); expect(screen.getByText('其他等级 1')).toBeVisible();
    expect(screen.queryByText('✗ 4 条违规')).not.toBeInTheDocument();
  });
  it('preserves server conforms for warning-only reports without a red blocking conclusion', async () => {
    mount(); await start(); await complete(0, { ...passed, violations: [{ severity: 'Warning', message: '仅警告' }], severity_counts: { Violation: 0, Warning: 1, Info: 0 } });
    expect(screen.getByText('✓ conforms')).toBeVisible(); expect(screen.getByText('警告 1')).toBeVisible();
    expect(screen.queryByText(/✗.*违规/)).not.toBeInTheDocument();
  });
  it('uses actual item counts and explains inconsistent server counts', async () => {
    mount(); await start(); await complete(0, { ...passed, violations: [{ severity: 'Info', message: '信息' }], severity_counts: { Violation: 99, Warning: 0, Info: 0 } });
    expect(screen.getByText('信息 1')).toBeVisible(); expect(screen.queryByText('违规 99')).not.toBeInTheDocument();
    expect(screen.getByText(/服务端计数与报告条目不一致/)).toBeVisible();
  });
  it('does not silently classify a missing severity as a violation', async () => {
    mount(); await start(); await complete(0, { conforms: true, violations: [{ message: '未提供等级' }], stats: {} });
    expect(screen.getByText('等级未提供')).toBeVisible(); expect(screen.getByText('其他等级 1')).toBeVisible();
    expect(screen.getByText('✓ conforms')).toBeVisible();
  });
});
