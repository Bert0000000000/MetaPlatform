import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import OverviewPage from './OverviewPage';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/api/ont/kernel', () => ({
  listObjectTypes: async () => [{ rid: 'ont.t.obj.actual.v1' }], listLinkTypes: async () => [], listActionTypes: async () => [], listFunctions: async () => [], listInterfaces: async () => [], listAxioms: async () => [],
  listActionAudit: async () => { throw new Error('审计源不可用'); }, getDatasourceSyncStatus: async () => { throw new Error('同步源不可用'); }, listSchemaWip: async () => [], lintAntiPatterns: async () => [],
}));
afterEach(cleanup);
it('offers continued construction with explicit read blockers rather than empty audit or sync health', async () => {
  render(<MemoryRouter><OverviewPage /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: '继续本体建设' })).toBeVisible();
  expect(screen.getByText(/审计读取未完成/)).toBeVisible();
  expect(screen.getByText(/同步读取未完成/)).toBeVisible();
  expect(screen.queryByText('本租户还没有经 Action 落库的变更。')).toBeNull();
  expect(screen.queryByText(/正常$/)).toBeNull();
});
