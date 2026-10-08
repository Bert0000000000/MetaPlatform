import { afterEach, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosAdapter } from 'axios';
import { apiClient } from '@/api/client';
import { listObjectTypes, listLinkTypes, type KernelObjectType } from './kernel';
vi.mock('@mate/shared', () => ({ toast: vi.fn() }));
vi.mock('@/utils/auth', () => ({ getToken: () => null, getRefreshToken: () => null }));
const originalAdapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });
const firstPage: KernelObjectType[] = Array.from({ length: 100 }, (_, i) => ({
  rid: `ont.tenant.obj.crm.a${String(i).padStart(3, '0')}.v1`, display_name: `类型 ${i}`,
  properties: [], primary_key: [], interfaces: [], checksum: `sum-${i}`,
}));
const live: KernelObjectType = { rid: 'ont.tenant.obj.crm.customer.v2', display_name: '客户', properties: [], primary_key: [], interfaces: [], checksum: 'active-sum' };
it('reads beyond the first 100 active types through the real HTTP client and leaves unpaginated links alone', async () => {
  const requests: string[] = [];
  apiClient.defaults.adapter = (async (config) => {
    const uri = apiClient.getUri(config);
    requests.push(uri);
    const url = new URL(uri, 'https://boundary.test');
    const data = url.pathname.endsWith('/link-types') ? [] : url.searchParams.get('offset') === '100' ? [live] : firstPage;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  }) satisfies AxiosAdapter;
  const types = await listObjectTypes();
  await listLinkTypes();
  expect(types).toHaveLength(101);
  expect(types.at(-1)).toEqual(live);
  expect(requests).toEqual(['/api/v1/ont/v2/object-types?limit=100&offset=0', '/api/v1/ont/v2/object-types?limit=100&offset=100', '/api/v1/ont/v2/link-types']);
});
it('rejects a later HTTP failure instead of returning the successful first batch', async () => {
  apiClient.defaults.adapter = (async (config) => {
    const offset = new URL(apiClient.getUri(config), 'https://boundary.test').searchParams.get('offset');
    if (offset === '100') throw new AxiosError('later batch unavailable', 'ERR_BAD_RESPONSE', config, undefined, { data: { detail: 'unavailable' }, status: 503, statusText: 'Unavailable', headers: {}, config });
    return { data: firstPage, status: 200, statusText: 'OK', headers: {}, config };
  }) satisfies AxiosAdapter;
  await expect(listObjectTypes()).rejects.toMatchObject({ response: { status: 503 } });
});
it('requests the terminal empty page when the active set ends on a full batch', async () => {
  let reads = 0;
  apiClient.defaults.adapter = (async (config) => ({ data: reads++ === 0 ? firstPage : [], status: 200, statusText: 'OK', headers: {}, config })) satisfies AxiosAdapter;
  expect(await listObjectTypes()).toHaveLength(100);
  expect(reads).toBe(2);
});
