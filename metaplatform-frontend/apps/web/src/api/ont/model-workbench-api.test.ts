import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import {
  saveSchemaWip,
  validateObjectTypeModel,
  listBackingDatasources,
  listVersions,
  type KernelObjectTypeCreate,
} from './kernel';
vi.mock('@/api/client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
it('stages complete payload in existing WIP endpoint and excludes live confirmation', async () => {
  const payload: KernelObjectTypeCreate = {
    rid: 'ont.t.obj.crm.customer.v1',
    display_name: '客户',
    primary_key: ['ont.t.prop.id.v1'],
    properties: [],
    interfaces: [],
    marking: ['internal'],
    parent_class: 'ont.t.obj.parent.v1',
    description: '客户',
    status: 'active',
    type_group: 'CRM',
    render_hints: [['icon', 'user']],
    confirm_name: '客户',
  };
  vi.mocked(apiClient.post).mockResolvedValue({
    data: { rid: payload.rid, status: 'staged', base_checksum: 'baseline' },
  });
  expect(await saveSchemaWip(payload)).toEqual({
    rid: payload.rid,
    status: 'staged',
    base_checksum: 'baseline',
  });
  const { confirm_name: _confirmation, ...definition } = payload;
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
    '/ont/v2/object-types/wip',
    { payload: definition },
  );
  expect(payload.confirm_name).toBe('客户');
});
it('uses real validation, backing declarations and immutable snapshots with encoded RIDs', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    data: { valid: false, errors: ['invalid'] },
  });
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
  const rid = 'ont.t.obj.crm.customer.v1';
  await validateObjectTypeModel({ rid });
  await listBackingDatasources(rid);
  await listVersions(rid);
  expect(apiClient.post).toHaveBeenCalledWith('/ont/v2/object-types/validate', {
    rid,
  });
  expect(apiClient.get).toHaveBeenCalledWith(
    `/ont/v2/object-types/${encodeURIComponent(rid)}/datasources`,
  );
  expect(apiClient.get).toHaveBeenCalledWith(
    `/ont/v2/versions/${encodeURIComponent(rid)}`,
  );
});
