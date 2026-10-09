import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Toast } from '@douyinfe/semi-ui';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../../../packages/shared/src/api/types';
import * as kb from '@/api/kb';
import KnowledgeConfigPage from './KnowledgeConfigPage';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
// Use the real error hook without loading unrelated exports from the shared barrel.
vi.mock('@mate/shared', async () => ({
  useApiErrorBoundary: (await import('../../../../../packages/shared/src/hooks/useApiErrorBoundary')).useApiErrorBoundary,
}));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/api/kb', () => ({ getRetrievalConfig: vi.fn(), getRetrievalConfigHistory: vi.fn(), putRetrievalConfig: vi.fn() }));

const loadedConfig: kb.RetrievalConfig = {
  tenantId: 'source-tenant', version: 7, updatedAt: '2026-10-09T00:00:00Z',
  mode: 'ENTITY', rerankStrategy: 'heuristic_cross', topK: 37, similarityThreshold: 0.25,
  chunkStrategy: 'markdown', chunkSize: 768, chunkOverlap: 96, vectorWeight: 0.6,
  keywordWeight: 0.4, rerankerEnabled: true, showCitations: false,
};
const { tenantId: _tenant, version: _version, updatedAt: _updated, ...editableConfig } = loadedConfig;
const loadedHistory: kb.RetrievalConfigSnapshot = {
  ...editableConfig, tenantId: 'source-tenant', id: 'source-snapshot', version: 6,
  snapshotAt: '2026-10-08T00:00:00Z',
};
const pending = <T,>() => new Promise<T>(() => {});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  vi.spyOn(Toast, 'error').mockReturnValue('');
  vi.spyOn(Toast, 'success').mockReturnValue('');
  // An unexpected automatic reread waits rather than obscuring the original result or causing a test loop.
  vi.mocked(kb.getRetrievalConfig).mockResolvedValueOnce(loadedConfig).mockReturnValue(pending());
  vi.mocked(kb.getRetrievalConfigHistory).mockResolvedValueOnce([]).mockReturnValue(pending());
  vi.mocked(kb.putRetrievalConfig).mockResolvedValue({ ...loadedConfig, topK: 38, version: 8 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function renderPage() {
  await act(async () => { render(<MemoryRouter><KnowledgeConfigPage /></MemoryRouter>); });
}

describe('retrieval configuration read boundaries', () => {
  it('keeps writes and frontend reset disabled while the first configuration read is pending', async () => {
    let resolve!: (config: kb.RetrievalConfig) => void;
    vi.mocked(kb.getRetrievalConfig).mockReset()
      .mockReturnValueOnce(new Promise(done => { resolve = done; })).mockReturnValue(pending());
    await renderPage();

    expect(screen.queryByText('正在读取检索配置')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存配置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '恢复前端默认值' })).toBeDisabled();
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(kb.putRetrievalConfig).not.toHaveBeenCalled();

    await act(async () => { resolve(loadedConfig); });
    expect(screen.getByText('v7')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled();
  });

  it.each([
    [503, '检索服务暂不可用'],
    [403, '无权访问：当前账号没有所需权限。'],
  ])('shows HTTP %i persistently without substituting editable frontend defaults', async (status, message) => {
    vi.mocked(kb.getRetrievalConfig).mockReset()
      .mockRejectedValueOnce(new HttpError(status, message)).mockReturnValue(pending());
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('检索配置读取失败');
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: '保存配置' });
    expect(save).toBeDisabled();
    expect(screen.getByRole('button', { name: '恢复前端默认值' })).toBeDisabled();
    fireEvent.click(save);
    expect(kb.putRetrievalConfig).not.toHaveBeenCalled();
  });

  it('retries configuration independently and enables writes only for the successful backend result', async () => {
    vi.mocked(kb.getRetrievalConfig).mockReset().mockRejectedValueOnce(new Error('配置请求失败'))
      .mockResolvedValueOnce(loadedConfig).mockReturnValue(pending());
    await renderPage();
    expect(screen.queryByRole('alert')).toHaveTextContent('检索配置读取失败');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试检索配置' })); });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('v7')).toBeVisible();
    expect(screen.getByDisplayValue('37')).toBeVisible();
    expect(screen.getByText('ENTITY · 实体图谱')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled();
    expect(kb.getRetrievalConfig).toHaveBeenCalledTimes(2);
    expect(kb.getRetrievalConfigHistory).toHaveBeenCalledTimes(1);
    expect(kb.putRetrievalConfig).not.toHaveBeenCalled();
  });

  it('keeps loaded configuration usable when history fails, and retries only history', async () => {
    vi.mocked(kb.getRetrievalConfigHistory).mockReset().mockRejectedValueOnce(new Error('历史服务暂不可用'))
      .mockResolvedValueOnce([loadedHistory]).mockReturnValue(pending());
    await renderPage();

    expect(screen.queryByRole('alert')).toHaveTextContent('配置历史读取失败');
    expect(screen.getByRole('alert')).toHaveTextContent('历史服务暂不可用');
    expect(screen.getByText('v7')).toBeVisible();
    expect(screen.getByDisplayValue('37')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled();
    expect(screen.queryByText('尚无历史快照')).not.toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试配置历史' })); });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('v6')).toBeVisible();
    expect(kb.getRetrievalConfig).toHaveBeenCalledTimes(1);
    expect(kb.getRetrievalConfigHistory).toHaveBeenCalledTimes(2);
  });

  it('preserves user edits and saves the backend configuration without rereading on each render', async () => {
    await renderPage();
    expect(kb.getRetrievalConfig).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.change(screen.getByDisplayValue('37'), { target: { value: '38' } }); });
    expect(screen.getByDisplayValue('38')).toBeVisible();
    expect(kb.getRetrievalConfig).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存配置' })); });

    expect(kb.putRetrievalConfig).toHaveBeenCalledExactlyOnceWith({ ...editableConfig, topK: 38 });
    expect(screen.getByText('v8')).toBeVisible();
    expect(kb.getRetrievalConfig).toHaveBeenCalledTimes(1);
  });

  it('surfaces history refresh failure after save without discarding the successful new version', async () => {
    vi.mocked(kb.getRetrievalConfigHistory).mockReset().mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('新历史请求失败')).mockReturnValue(pending());
    await renderPage();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存配置' })); });

    expect(screen.queryByRole('alert')).toHaveTextContent('配置历史读取失败');
    expect(screen.getByRole('alert')).toHaveTextContent('新历史请求失败');
    expect(screen.getByText('v8')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled();
    expect(kb.putRetrievalConfig).toHaveBeenCalledExactlyOnceWith(editableConfig);
  });
});
