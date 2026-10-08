import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AppListPage from './AppListPage';
import * as api from '@/api/apphub/apps';
import type { BusinessDomain } from '@/api/apphub/types';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('./DesignFlowPage', () => ({ default: () => null }));
vi.mock('@/api/apphub/apps', () => ({ listApps: vi.fn(), listGroups: vi.fn(), listDomains: vi.fn(), deleteApp: vi.fn(), createDomain: vi.fn(), updateDomain: vi.fn(), deleteDomain: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('retains apps and retries classifications independently instead of verifying an empty classification', async () => {
  vi.mocked(api.listApps).mockResolvedValue({ items: [{ appId: 'app-1', name: '实际应用', code: 'actual', description: '实际描述', updatedAt: '1.0' }] } as never);
  vi.mocked(api.listGroups).mockRejectedValueOnce(new Error('分类不可用')).mockResolvedValueOnce(['business']);
  vi.mocked(api.listDomains).mockRejectedValueOnce(new Error('业务域不可用')).mockResolvedValueOnce([]);
  render(<MemoryRouter><AppListPage /></MemoryRouter>);
  expect(await screen.findByText('分类不可用')).toBeVisible();
  expect(screen.getByText('实际应用')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '重试分类' }));
  fireEvent.click(screen.getByRole('button', { name: '重试业务域' }));
  await screen.findByText('全部分类');
  expect(api.listApps).toHaveBeenCalledTimes(1);
  expect(api.listGroups).toHaveBeenCalledTimes(2);
  expect(api.listDomains).toHaveBeenCalledTimes(2);
});

async function openDomainManager() {
  fireEvent.click(screen.getByRole('button', { name: '管理业务域' }));
  return within((await screen.findByRole('textbox', { name: '业务域名称' })).closest('.mp-sheet-body') as HTMLElement);
}
function directoryReads() {
  vi.mocked(api.listApps).mockResolvedValue({ items: [] } as never);
  vi.mocked(api.listGroups).mockResolvedValue([]);
}
function domain(name: string): BusinessDomain {
  return { id: 'domain-orders', code: 'orders', name, icon: '', sort_order: 10 };
}
it('opens actual domain management after a failed initial read and retries without a false empty claim or losing input', async () => {
  directoryReads();
  vi.mocked(api.listDomains).mockRejectedValueOnce(new Error('业务域不可用')).mockResolvedValueOnce([domain('已读取订单域')]);
  render(<MemoryRouter><AppListPage /></MemoryRouter>);
  await screen.findByText('业务域不可用');
  const manager = await openDomainManager();
  expect(manager.getByText('业务域读取失败')).toBeVisible();
  expect(manager.queryByText('还没有业务域，先新增一个。')).toBeNull();
  fireEvent.change(manager.getByRole('textbox', { name: '业务域名称' }), { target: { value: '保留新增输入' } });
  fireEvent.click(manager.getByRole('button', { name: '重试业务域' }));
  expect(await manager.findByText('已读取订单域')).toBeVisible();
  expect(manager.getByRole('textbox', { name: '业务域名称' })).toHaveValue('保留新增输入');
  expect(manager.queryByText('业务域读取失败')).toBeNull();
  expect(api.listDomains).toHaveBeenCalledTimes(2);
  expect(api.listApps).toHaveBeenCalledTimes(1);
});
it('shows verified empty domain state only after a successful retry', async () => {
  directoryReads();
  vi.mocked(api.listDomains).mockRejectedValueOnce(new Error('业务域不可用')).mockResolvedValueOnce([]);
  render(<MemoryRouter><AppListPage /></MemoryRouter>);
  await screen.findByText('业务域不可用');
  const manager = await openDomainManager();
  expect(manager.queryByText('还没有业务域，先新增一个。')).toBeNull();
  fireEvent.click(manager.getByRole('button', { name: '重试业务域' }));
  expect(await manager.findByText('还没有业务域，先新增一个。')).toBeVisible();
});
it('preserves rename DTO and labels retained domains stale if mutation readback fails, then retries fresh values', async () => {
  directoryReads();
  let finishRetry!: (domains: BusinessDomain[]) => void;
  const retryRead = new Promise<BusinessDomain[]>((resolve) => { finishRetry = resolve; });
  vi.mocked(api.listDomains).mockResolvedValueOnce([domain('原订单域')]).mockRejectedValueOnce(new Error('回读暂不可用')).mockReturnValueOnce(retryRead);
  vi.mocked(api.updateDomain).mockResolvedValue(domain('更新订单域'));
  render(<MemoryRouter><AppListPage /></MemoryRouter>);
  await screen.findByText('原订单域');
  const manager = await openDomainManager();
  fireEvent.click(manager.getByRole('button', { name: '重命名 原订单域' }));
  fireEvent.change(manager.getByRole('textbox', { name: '重命名 原订单域' }), { target: { value: '更新订单域' } });
  fireEvent.click(manager.getByRole('button', { name: '保存' }));
  expect(await manager.findByText('业务域读取失败')).toBeVisible();
  expect(manager.getByText('保留上次成功读取的业务域，请重试后核对。')).toBeVisible();
  expect(manager.getByText('原订单域')).toBeVisible();
  expect(api.updateDomain).toHaveBeenCalledExactlyOnceWith('orders', { name: '更新订单域' });
  fireEvent.click(manager.getByRole('button', { name: '重试业务域' }));
  expect(manager.getByRole('status')).toHaveTextContent('正在刷新业务域；下方保留上次成功读取的内容。');
  expect(manager.getByText('原订单域')).toBeVisible();
  expect(manager.queryByText('还没有业务域，先新增一个。')).toBeNull();
  await act(async () => { finishRetry([domain('更新订单域')]); });
  expect(await manager.findByText('更新订单域')).toBeVisible();
  expect(manager.queryByText('保留上次成功读取的业务域，请重试后核对。')).toBeNull();
  expect(api.listDomains).toHaveBeenCalledTimes(3);
});
