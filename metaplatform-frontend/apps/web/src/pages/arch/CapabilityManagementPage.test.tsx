import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CapabilityManagementPage from './CapabilityManagementPage';
import * as capabilities from '@/api/arch/capabilities';

vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })) as never; });
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Range.prototype.getBoundingClientRect = () => new DOMRect();
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/components/graph', () => ({ ForceGraph: () => null }));
vi.mock('@/api/arch/capabilities', () => ({ listCapabilities: vi.fn(), getCapabilityTree: vi.fn(), createCapability: vi.fn(), updateCapability: vi.fn(), deleteCapability: vi.fn() }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('resolves a supplied parent id to the source name while leaving unavailable parent names and statuses unknown', async () => {
  // Capability's actual serialized list has id/parent_id/numeric level and no status.
  vi.mocked(capabilities.listCapabilities).mockResolvedValue({
    items: [
      { id: 'cap-root', tenant_id: 'tenant-source', name: '真实父能力', code: 'cap-root', parent_id: '', level: 1, description: '根能力说明' },
      { id: 'cap-child', tenant_id: 'tenant-source', name: '真实子能力', code: 'cap-child', parent_id: 'cap-root', level: 2, description: '子能力说明' },
      { id: 'cap-unresolved', tenant_id: 'tenant-source', name: '父级未读取的能力', code: 'cap-unresolved', parent_id: 'cap-not-read', level: 2, description: '未读父级说明' },
    ], total: 3, page: 1, pageSize: 20, totalPages: 1,
  } as never);
  vi.mocked(capabilities.getCapabilityTree).mockResolvedValue([]);
  render(<MemoryRouter><CapabilityManagementPage /></MemoryRouter>);
  const childRow = (await screen.findByRole('gridcell', { name: '真实子能力' })).closest('tr');
  expect(childRow).not.toBeNull();
  expect(within(childRow!).getByRole('gridcell', { name: '真实父能力' })).toBeVisible();
  expect(within(childRow!).getByRole('gridcell', { name: '2' })).toBeVisible();
  const unresolvedRow = screen.getByRole('gridcell', { name: '父级未读取的能力' }).closest('tr');
  expect(within(unresolvedRow!).getAllByRole('gridcell', { name: '—' })).toHaveLength(2);
  expect(screen.queryByText('生效')).toBeNull();
});
