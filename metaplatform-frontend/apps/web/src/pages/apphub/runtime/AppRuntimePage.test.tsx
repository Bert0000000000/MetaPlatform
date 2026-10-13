import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppRuntimePage from './AppRuntimePage';

const api = vi.hoisted(() => ({ runtime: vi.fn(), resolve: vi.fn() }));
vi.mock('@/api/apphub/runtime', () => ({ getAppRuntime: api.runtime }));
vi.mock('@/api/apphub/shortlink', () => ({ resolveShortlink: api.resolve }));
vi.mock('@/api/apphub/apps', () => ({ getApp: vi.fn().mockResolvedValue({ name: 'Actual app' }) }));
vi.mock('./AppRuntimeLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('./OrderReviewRuntime', () => ({ default: () => <div>BOUND_ORDER_RUNTIME</div> }));
vi.mock('./RuntimeForm', () => ({ default: () => <div>FORM_DEMO</div> }));
vi.mock('./RuntimePage', () => ({ default: () => <div>PAGE_DEMO</div> }));
vi.mock('./RuntimePlaceholder', () => ({ default: () => <div>PLACEHOLDER_DEMO</div> }));
vi.mock('@douyinfe/semi-ui', () => ({ Spin: () => <div>Loading</div>, Banner: ({ description }: { description: string }) => <div role="alert">{description}</div> }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); api.resolve.mockResolvedValue({ app_id: 'real' }); });
function open() { render(<MemoryRouter initialEntries={['/s/actual']}><Routes><Route path="/s/:code" element={<AppRuntimePage />} /></Routes></MemoryRouter>); }

it('shows an explicit unavailable page instead of demo data for an empty runtime tree', async () => {
  api.runtime.mockResolvedValue({ app_id: 'real', version: '1.0.0', render_tree: [] });
  open();
  expect((await screen.findByRole('alert')).textContent).toContain('暂无可用页面');
  expect(screen.queryByText(/_DEMO/)).toBeNull();
});
it('preserves shortlink authorization errors without guessing an app code', async () => {
  api.resolve.mockRejectedValue(new Error('Forbidden shortlink'));
  api.runtime.mockResolvedValue({ render_tree: [] });
  open();
  expect((await screen.findByRole('alert')).textContent).toContain('Forbidden shortlink');
  expect(api.runtime).not.toHaveBeenCalled();
});
