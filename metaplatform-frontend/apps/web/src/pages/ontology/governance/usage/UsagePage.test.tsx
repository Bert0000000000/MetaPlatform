import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/api/ont/kernel';
import UsagePage from './UsagePage';
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/api/ont/kernel', () => ({ getUsageSummary: vi.fn(), applyLifecycle: vi.fn() }));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('distinguishes missing metrics from actual zero and positive writes', async () => {
  vi.mocked(api.getUsageSummary).mockResolvedValue([
    { class_rid: 'ont.t.obj.unavailable', reads: 5, writes: null, active_days: null },
    { class_rid: 'ont.t.obj.zero', reads: 0, writes: 0, active_days: 0 },
    { class_rid: 'ont.t.obj.written', reads: 2, writes: 3, active_days: 1 },
  ]);
  render(<UsagePage />);
  await screen.findByText('ont.t.obj.unavailable');
  const cells = (rid: string) => within(screen.getByRole('row', { name: new RegExp(rid) })).getAllByRole('gridcell');
  expect(cells('ont.t.obj.unavailable')[2]).toHaveTextContent('不可用');
  expect(cells('ont.t.obj.unavailable')[3]).toHaveTextContent('不可用');
  expect(cells('ont.t.obj.zero')[2]).toHaveTextContent('0');
  expect(cells('ont.t.obj.written')[2]).toHaveTextContent('3');
});



