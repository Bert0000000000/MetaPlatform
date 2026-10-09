import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MarketPage from './MarketPage';
import MyTemplatesPage from './MyTemplatesPage';
import TemplateDetailPage from './TemplateDetailPage';
import MarketplacePage from './MarketplacePage';
import CategoryFilter from './components/CategoryFilter';
import TemplateSubmitPage from './TemplateSubmitPage';
import * as api from '@/api/apphub/marketplace';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never;
});
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/api/apphub/marketplace', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/apphub/marketplace')>()), listTemplates: vi.fn(), listInstalled: vi.fn(), getTemplate: vi.fn(), createTemplate: vi.fn(), listTemplateComments: vi.fn().mockResolvedValue([]), installTemplate: vi.fn() }));
vi.mock('@mate/shared', () => ({ getUser: () => ({ id: 'real-user', username: 'alice' }) }));

afterEach(() => { cleanup(); vi.resetAllMocks(); vi.mocked(api.listTemplateComments).mockResolvedValue([]); });

const template: api.TemplateItem = {
  templateId: 'tpl-request', name: '真实申请模板', category: 'form', description: '服务端模板',
  icon: '', tags: [], downloadCount: 0, rating: 0, createdAt: '',
};

it('keeps a failed catalog read visible and retries before claiming there are no templates', async () => {
  vi.mocked(api.listTemplates).mockRejectedValueOnce(new Error('模板服务不可用')).mockResolvedValueOnce([template]);
  render(<MemoryRouter><MarketPage /></MemoryRouter>);
  expect(await screen.findByText('模板服务不可用')).toBeVisible();
  expect(screen.queryByText('暂无模板')).toBeNull();
  expect(screen.queryByText(/共 0 个模板/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('真实申请模板')).toBeVisible();
  expect(screen.queryByText('模板服务不可用')).toBeNull();
});

it('does not offer a market installation for an apphub template without an artifact identity', async () => {
  vi.mocked(api.listTemplates).mockResolvedValue([template]);
  render(<MemoryRouter><MarketPage /></MemoryRouter>);
  await screen.findByText('真实申请模板');
  expect(screen.getByRole('button', { name: /安装暂不可用/ })).toBeDisabled();
});

it('does not claim a verified empty personal collection when the service omits ownership', async () => {
  vi.mocked(api.listTemplates).mockResolvedValue([template]);
  render(<MemoryRouter><MyTemplatesPage /></MemoryRouter>);
  expect(await screen.findByText('无法确认个人模板')).toBeVisible();
  expect(screen.queryByText(/还没有创建任何模板/)).toBeNull();
});

it('shows personal read failures until a successful retry yields templates with real ownership', async () => {
  vi.mocked(api.listTemplates).mockRejectedValueOnce(new Error('个人模板读取失败')).mockResolvedValueOnce([{ ...template, author: 'alice' }]);
  render(<MemoryRouter><MyTemplatesPage /></MemoryRouter>);
  expect(await screen.findByText('个人模板读取失败')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByText('真实申请模板')).toBeVisible();
  expect(screen.getByRole('button', { name: /删除暂不可用/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /投稿暂不可用/ })).toBeDisabled();
});

it('reads the template selected by the canonical apphub query deep link', async () => {
  vi.mocked(api.getTemplate).mockResolvedValue({ ...template, configSnapshot: '{"fields":[]}' });
  render(<MemoryRouter initialEntries={['/apps/market?tid=tpl-request']}><TemplateDetailPage /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: '真实申请模板', level: 1 })).toBeVisible();
  expect(api.getTemplate).toHaveBeenCalledWith('tpl-request');
});

it('does not replace a failed template read with an official demo fixture and can retry', async () => {
  vi.mocked(api.getTemplate).mockRejectedValueOnce(new Error('详情服务不可用')).mockResolvedValueOnce({ ...template, templateId: 'official-crm-customer' });
  render(<MemoryRouter initialEntries={['/market/official-crm-customer']}><Routes><Route path="/market/:templateId" element={<TemplateDetailPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('详情服务不可用')).toBeVisible();
  expect(screen.queryByText('客户管理')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { name: '真实申请模板', level: 1 })).toBeVisible();
});

it('does not label an unread installation history as empty and retries it independently', async () => {
  vi.mocked(api.listTemplates).mockResolvedValue([]);
  vi.mocked(api.listInstalled).mockRejectedValueOnce(new Error('安装记录读取失败')).mockResolvedValueOnce([]);
  render(<MemoryRouter><MarketplacePage /></MemoryRouter>);
  expect(await screen.findByText('安装记录读取失败')).toBeVisible();
  expect(screen.queryByText(/还没有安装记录/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试安装记录' }));
  expect(await screen.findByText(/还没有安装记录/)).toBeVisible();
  expect(api.listTemplates).toHaveBeenCalledTimes(1);
});

it('clears the marketplace template type when selecting all categories', () => {
  const change = vi.fn();
  render(<CategoryFilter value="form" onChange={change} />);
  fireEvent.click(screen.getByRole('radio', { name: '全部' }));
  expect(change).toHaveBeenCalledWith(undefined);
});

it('creates a shared template through the service and preserves the configured fields after rejection', async () => {
  vi.mocked(api.createTemplate).mockRejectedValueOnce(new Error('模板编码已存在')).mockResolvedValueOnce(template);
  render(<MemoryRouter initialEntries={['/apps/templates?submit=1']}><Routes>
    <Route path="/apps/templates" element={<TemplateSubmitPage />} />
    <Route path="/apps/market" element={<div>已返回共享模板目录</div>} />
  </Routes></MemoryRouter>);
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/模板名称/), { target: { value: '真实申请模板' } });
    fireEvent.change(screen.getByLabelText(/模板编码/), { target: { value: 'request' } });
    fireEvent.change(screen.getByLabelText(/模板描述/), { target: { value: '服务端模板' } });
    fireEvent.change(screen.getByPlaceholderText('字段 Key（如 customerName）'), { target: { value: 'reason' } });
    fireEvent.change(screen.getByPlaceholderText('字段标签'), { target: { value: '事由' } });
  });
  fireEvent.click(screen.getByRole('button', { name: /创建共享模板/ }));
  expect(await screen.findByText('模板编码已存在')).toBeVisible();
  expect(screen.getByLabelText(/模板编码/)).toHaveValue('request');
  expect(screen.getByPlaceholderText('字段标签')).toHaveValue('事由');
  expect(api.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ code: 'request', name: '真实申请模板', template_type: 'form', description: '服务端模板', content: expect.objectContaining({ fields: [expect.objectContaining({ fieldKey: 'reason', label: '事由', type: 'text' })] }) }));
  fireEvent.click(screen.getByRole('button', { name: /创建共享模板/ }));
  expect(await screen.findByText('已返回共享模板目录')).toBeVisible();
});
