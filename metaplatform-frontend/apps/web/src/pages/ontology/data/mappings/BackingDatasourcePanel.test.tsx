import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { setEditorSessionIdentity } from '../../hooks/editorSession';
vi.mock('@douyinfe/semi-ui', () => ({ Button: (p: any) => <button onClick={p.onClick} disabled={p.disabled}>{p.children}</button>, Input: () => null, InputNumber: () => null, Select: () => null, Tag: () => null, Toast: { warning: vi.fn() } }));
vi.mock('@mate/shared', () => ({ useAuth: () => ({ user: { id: 'mapping-user', tenantId: 't' } }) }));
const api = vi.hoisted(() => ({ listObjectTypes: vi.fn(), listBackingDatasources: vi.fn(), getMaterialization: vi.fn(), upsertBackingDatasource: vi.fn(), syncBackingDatasources: vi.fn() }));
const data = vi.hoisted(() => ({ listBigDataSources: vi.fn(), discoverBigDataSchema: vi.fn(), testBigDataSourceConnection: vi.fn() }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn() } }));
vi.mock('@/api/ont/kernel', () => api);
vi.mock('@/components/skeleton', () => ({ DataTablePro: () => null, EmptyState: () => null, SheetDetail: () => null }));
vi.mock('@/api/ontology-bigdata', () => data);
import BackingDatasourcePanel from './BackingDatasourcePanel';

const typeRid = 'ont.t.obj.order';
let declarations: any[];
beforeEach(() => {
  vi.resetAllMocks(); setEditorSessionIdentity('');
  declarations = [];
  api.listObjectTypes.mockResolvedValue([{ rid: typeRid, display_name: 'Order', primary_key: ['ont.t.prop.id'], properties: [{ rid: 'ont.t.prop.id', title: 'id', primary_key: true, nullable: false, type_id: 'integer' }] }]);
  api.listBackingDatasources.mockImplementation(async () => declarations);
  api.getMaterialization.mockResolvedValue({ class_rid: typeRid, count: 0, rows: [], schema: {} });
  data.listBigDataSources.mockResolvedValue([{ sourceId: 's', name: 'Orders PG', sourceType: 'POSTGRES' }]);
  data.testBigDataSourceConnection.mockResolvedValue({ success: true, trace_id: 'probe' });
  data.discoverBigDataSchema.mockResolvedValue({ source_id: 's', discovered_at: '2026-10-11', trace_id: 'discovery', tables: [{ name: 'orders', schema: 'sales', columns: [{ name: 'id', type: 'integer', nullable: false, primary_key: true }, { name: 'modified_at', type: 'timestamp with time zone', nullable: false }] }] });
  api.upsertBackingDatasource.mockImplementation(async (_rid: string, payload: any) => {
    declarations = [{ ...payload, rid: 'binding-real', table_name: payload.table, dsn_env: '', run_history: [] }];
    return declarations[0];
  });
});
afterEach(() => { cleanup(); setEditorSessionIdentity(''); });
function mount() {
  render(<MemoryRouter initialEntries={['/ontology/data/mappings?source=s']}><BackingDatasourcePanel /></MemoryRouter>);
}
async function configure() {
  fireEvent.click(await screen.findByRole('button', { name: '验证连接并发现字段' }));
  await screen.findByText(/discovery/);
  fireEvent.change(screen.getByLabelText('源表'), { target: { value: 'sales.orders' } });
  fireEvent.change(screen.getByLabelText('时间列'), { target: { value: 'modified_at' } });
  fireEvent.click(screen.getByLabelText('确认字段映射'));
}
it('confirms discovered mapping and persists selected registered source and time column', async () => {
  mount(); await configure();
  fireEvent.click(screen.getByRole('button', { name: '预检并保存映射' }));
  await waitFor(() => expect(api.upsertBackingDatasource).toHaveBeenCalledWith(typeRid, expect.objectContaining({ source_id: 's', kind: 'pg_table', ts_column: 'modified_at', table: 'sales.orders', pk_column: 'id', field_mapping: { 'ont.t.prop.id': 'id' } })));
  expect(await screen.findByText('服务器预检通过，映射已保存')).toBeVisible();
});
it('keeps synchronization blocked after collapsing an unsaved registered-source mapping', async () => {
  declarations = [{ rid: 'legacy-binding', class_rid: typeRid, name: 'existing', kind: 'pg_table', dsn_env: 'ORDERS_DSN', table_name: 'sales.orders', pk_column: 'id', ts_column: 'updated_at', priority: 100, field_mapping: { 'ont.t.prop.id': 'id' } }];
  mount(); await configure();
  expect(screen.getByRole('button', { name: '全量同步全部来源' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '收起注册源向导' }));
  expect(screen.queryByRole('button', { name: '预检并保存映射' })).toBeNull();
  expect(screen.getByRole('button', { name: '全量同步全部来源' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '全量同步全部来源' }));
  expect(api.syncBackingDatasources).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '接入注册数据源' }));
  await screen.findByRole('option', { name: 'Orders PG' });
  expect(screen.getByLabelText('注册数据源')).toHaveValue('s');
  fireEvent.click(screen.getByRole('button', { name: '验证连接并发现字段' }));
  await screen.findByText(/discovery/);
  expect(screen.getByLabelText('时间列')).toHaveValue('modified_at');
  expect(screen.getByLabelText('确认字段映射')).not.toBeChecked();
});
