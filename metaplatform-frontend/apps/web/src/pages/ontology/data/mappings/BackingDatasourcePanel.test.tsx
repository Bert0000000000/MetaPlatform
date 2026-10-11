vi.mock('@douyinfe/semi-ui', () => ({ Button: (p: any) => <button>{p.children}</button>, Input: () => null, InputNumber: () => null, Select: () => null, Tag: () => null, Toast: { warning: vi.fn() } }));
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ listObjectTypes: vi.fn(), listBackingDatasources: vi.fn(), upsertBackingDatasource: vi.fn(), syncBackingDatasources: vi.fn() }));
const data = vi.hoisted(() => ({ listBigDataSources: vi.fn(), discoverBigDataSchema: vi.fn(), testBigDataSourceConnection: vi.fn() }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn() } }));
vi.mock('@/api/ont/kernel', () => api);
vi.mock('@/components/skeleton', () => ({ DataTablePro: () => null, EmptyState: () => null, SheetDetail: () => null }));
vi.mock('@/api/ontology-bigdata', () => data);
import BackingDatasourcePanel from './BackingDatasourcePanel';

it('confirms discovered mapping and persists selected registered source and time column', async () => {
  api.listObjectTypes.mockResolvedValue([{ rid: 'ont.t.obj.order', display_name: 'Order', primary_key: ['ont.t.prop.id'], properties: [{ rid: 'ont.t.prop.id', title: 'id', primary_key: true, nullable: false, type_id: 'integer' }] }]);
  api.listBackingDatasources.mockResolvedValue([]);
  data.listBigDataSources.mockResolvedValue([{ sourceId: 's', name: 'Orders PG', sourceType: 'POSTGRES' }]);
  data.testBigDataSourceConnection.mockResolvedValue({ success: true, trace_id: 'probe' });
  data.discoverBigDataSchema.mockResolvedValue({ source_id: 's', discovered_at: '2026-10-11', trace_id: 'discovery', tables: [{ name: 'orders', schema: 'sales', columns: [{ name: 'id', type: 'integer', nullable: false, primary_key: true }, { name: 'modified_at', type: 'timestamp with time zone', nullable: false }] }] });
  api.upsertBackingDatasource.mockResolvedValue({});
  render(<MemoryRouter initialEntries={['/ontology/data/mappings?source=s']}><BackingDatasourcePanel /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: '验证连接并发现字段' }));
  await screen.findByText(/discovery/);
  fireEvent.change(screen.getByLabelText('源表'), { target: { value: 'sales.orders' } });
  fireEvent.change(screen.getByLabelText('时间列'), { target: { value: 'modified_at' } });
  fireEvent.click(screen.getByLabelText('确认字段映射'));
  fireEvent.click(screen.getByRole('button', { name: '预检并保存映射' }));
  await waitFor(() => expect(api.upsertBackingDatasource).toHaveBeenCalledWith('ont.t.obj.order', expect.objectContaining({ source_id: 's', kind: 'pg_table', ts_column: 'modified_at', table: 'sales.orders', pk_column: 'id', field_mapping: { 'ont.t.prop.id': 'id' } })));
});
