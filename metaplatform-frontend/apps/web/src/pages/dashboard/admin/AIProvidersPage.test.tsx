import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { HttpError } from '../../../../../../packages/shared/src/api/types';
import type { AdminSystemConfig, PageResult } from '@/types';
import * as configs from '@/api/admin/configs';
import * as models from '@/api/admin/models';
import AIProvidersPage from './AIProvidersPage';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
// HTTP and user settings are external boundaries; the page and Semi controls stay real.
vi.mock('@/api/admin/configs', () => ({ listConfigs: vi.fn(), updateConfig: vi.fn(), batchCreateConfigs: vi.fn() }));
vi.mock('@/api/admin/models', () => ({ listAiModels: vi.fn(), updateAiModel: vi.fn(), deleteAiModel: vi.fn(), saveAiModelsBulk: vi.fn() }));
vi.mock('@mate/shared/api', () => ({ testProvider: vi.fn(), fetchProviderModels: vi.fn() }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ settings: { timezone: 'Asia/Shanghai' } }) }));

function httpFailure(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, {
    status,
    statusText: status === 403 ? 'Forbidden' : 'Service Unavailable',
    headers: {}, config,
    data: { detail: { code: status === 403 ? 'E403_FORBIDDEN' : 'E503_UNAVAILABLE',
      message: status === 403 ? '后台管理接口仅限平台管理员（ROLE_PLATFORM_ADMIN）' : '配置服务暂不可用' } },
  });
}

function configItem(key: string, value: unknown, id: number): AdminSystemConfig {
  return { id, key, value, rawValue: null, valueType: typeof value === 'boolean' ? 'bool' : 'string',
    category: 'AI_PROVIDER', label: key, description: null, enumOptions: [], isSensitive: false,
    updatedBy: 'source-user', createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z' };
}
const loadedConfigs: PageResult<AdminSystemConfig> = {
  items: [configItem('ai.provider.default_active', 'ark', 1),
    configItem('ai.embedding.default_provider', 'ark', 2),
    configItem('ai.provider.ark.enabled', true, 3),
    configItem('ai.provider.ark.base_url', 'https://example.invalid/ark', 4),
    configItem('ai.provider.ark.default_model', 'source-model', 5)],
  total: 5, page: 1, pageSize: 200, totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  vi.mocked(configs.listConfigs).mockResolvedValue(loadedConfigs);
  vi.mocked(models.listAiModels).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function renderPage() {
  await act(async () => { render(<AIProvidersPage />); });
}

describe('AI Provider read boundaries', () => {
  it('recognizes a shared-client HttpError403 without mistaking it for service unavailability', async () => {
    vi.mocked(configs.listConfigs).mockRejectedValue(new HttpError(403, '无权访问：当前账号没有所需权限。',
      'source-trace', { detail: { code: 'E403_FORBIDDEN' } }));
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('无权限读取 Provider 配置');
    expect(screen.getByRole('alert')).not.toHaveTextContent('暂不可用');
    expect(screen.getByRole('button', { name: '添加自定义 Provider' })).toBeDisabled();
  });

  it('shows a persistent permission denial instead of built-in configuration rows after HTTP403', async () => {
    vi.mocked(configs.listConfigs).mockRejectedValue(httpFailure(403));
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('无权限');
    expect(screen.getByRole('alert')).toHaveTextContent('ROLE_PLATFORM_ADMIN');
    expect(screen.queryByRole('button', { name: '配置' })).not.toBeInTheDocument();
    const add = screen.getByRole('button', { name: '添加自定义 Provider' });
    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(configs.batchCreateConfigs).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: '默认 Provider' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps configuration-dependent actions disabled until the first read succeeds', async () => {
    let resolve!: (value: PageResult<AdminSystemConfig>) => void;
    vi.mocked(configs.listConfigs).mockReturnValue(new Promise(done => { resolve = done; }));
    await renderPage();

    expect(screen.getByRole('button', { name: '添加自定义 Provider' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '配置' })).not.toBeInTheDocument();
    await act(async () => { resolve(loadedConfigs); });
    expect(screen.getByRole('button', { name: '添加自定义 Provider' })).toBeEnabled();
    expect(screen.getByText('https://example.invalid/ark')).toBeVisible();
  });

  it('retries denied configuration independently and re-enables actions only after a successful read', async () => {
    vi.mocked(configs.listConfigs).mockRejectedValueOnce(httpFailure(403)).mockResolvedValueOnce(loadedConfigs);
    await renderPage();
    expect(screen.queryByRole('alert')).toHaveTextContent('无权限');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试配置' })); });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('https://example.invalid/ark')).toBeVisible();
    expect(screen.getByRole('button', { name: '添加自定义 Provider' })).toBeEnabled();
    expect(models.listAiModels).toHaveBeenCalledTimes(1);
  });

  it('marks a failed model read as partial and disables model writes while preserving loaded configuration', async () => {
    vi.mocked(models.listAiModels).mockRejectedValueOnce(httpFailure(403)).mockResolvedValueOnce([
      { id: 9, provider: 'ark', modelId: 'source-model', displayName: '来源模型', modality: 'text', enabled: true },
    ]);
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('模型清单');
    expect(screen.getByRole('alert')).toHaveTextContent('无权限');
    const row = screen.getByText('https://example.invalid/ark').closest('tr')!;
    expect(within(row).getByRole('button', { name: '配置' })).toBeEnabled();
    expect(within(row).getByRole('button', { name: '测试连接' })).toBeEnabled();
    expect(within(row).getByRole('button', { name: '获取模型' })).toBeDisabled();
    expect(within(row).getByText('未读取')).toBeVisible();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试模型清单' })); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: '获取模型' })).toBeEnabled();
    expect(within(row).getByText('1')).toBeVisible();
    expect(configs.listConfigs).toHaveBeenCalledTimes(1);
  });

  it('distinguishes service unavailability from permission denial and blocks dependent actions', async () => {
    vi.mocked(configs.listConfigs).mockRejectedValue(httpFailure(503));
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('暂不可用');
    expect(screen.getByRole('alert')).not.toHaveTextContent('无权限');
    expect(screen.getByRole('button', { name: '添加自定义 Provider' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '配置' })).not.toBeInTheDocument();
  });

  it('does not claim an OpenAI default when a successful response has no default configuration', async () => {
    vi.mocked(configs.listConfigs).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200, totalPages: 0 });
    await renderPage();

    const openaiRow = screen.getByText('OpenAI 官方或自建 OpenAI 兼容代理').closest('tr')!;
    expect(within(openaiRow).queryByText('默认')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
