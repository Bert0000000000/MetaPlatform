import '@douyinfe/semi-ui/react19-adapter';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import AuditStatisticsPage from './AuditStatisticsPage';

const boundary = vi.hoisted(() => ({ get: vi.fn() }));
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@mate/shared/api', () => ({ apiPath: () => '/api/v1/mcp', createApiClient: () => ({ get: boundary.get }) }));

beforeEach(() => {
  boundary.get.mockReset().mockImplementation(async (url: string) => {
    if (url === '/audit/statistics') return { data: { totalCalls: 17, successCount: 16, failureCount: 1, successRate: 16 / 17, avgDuration: 28, totalInputTokens: 130, totalOutputTokens: 70, totalTokens: 200, byStatus: { success: 16, error: 1 }, byTool: {} } };
    if (url === '/audit/trends') return { data: [] };
    if (url === '/tools') return { data: { tools: [] } };
    if (['/servers', '/clients', '/audit/logs'].includes(url)) return { data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } };
    throw new Error(`Unexpected GET ${url}`);
  });
});
afterEach(() => cleanup());

it('renders the real statistics page with a populated Semi date range and preserves ISO request dates', async () => {
  const start = dayjs().subtract(6, 'day').startOf('day');
  const end = dayjs().endOf('day');
  expect(() => render(<MemoryRouter><AuditStatisticsPage /></MemoryRouter>)).not.toThrow();
  expect(await screen.findByRole('heading', { name: /调用审计统计/, level: 1 })).toBeVisible();
  const displayed = screen.getAllByRole('textbox').map((node) => (node as HTMLInputElement).value).join(' | ');
  expect(displayed).toContain(start.format('YYYY-MM-DD HH:mm'));
  expect(displayed).toContain(end.format('YYYY-MM-DD HH:mm'));
  await waitFor(() => expect(boundary.get).toHaveBeenCalledWith('/audit/statistics', { params: { startTime: start.toISOString(), endTime: end.toISOString() } }));
  expect(screen.getByText('17')).toBeVisible();
});
