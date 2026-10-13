import { describe, expect, it, vi } from 'vitest';
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } }));
vi.mock('axios', () => ({ default: { create: () => http } }));
vi.mock('@/utils/auth', () => ({ getToken: () => null }));
import { createBigDataSource, discoverBigDataSchema, testBigDataSourceConnection, updateBigDataSource } from '@/api/ontology-bigdata';

describe('real source contract', () => {
  it('propagates probe and schema failures without fabricated results', async () => {
    http.post.mockRejectedValueOnce(new Error('offline'));
    await expect(testBigDataSourceConnection('s')).rejects.toThrow('offline');
    http.get.mockRejectedValueOnce(new Error('denied'));
    await expect(discoverBigDataSchema('s')).rejects.toThrow('denied');
  });
  it('sends backend CRUD DTO and retains connection details without password masks', async () => {
    http.post.mockResolvedValueOnce({ data: { id: 's', tenant_id: 't', name: 'PG', type: 'postgres', connection_config: { database: 'db', schema: 'sales', username: 'reader' }, status: 'disconnected' } });
    const result = await createBigDataSource({ name: 'PG', sourceType: 'POSTGRES', database: 'db', schema: 'sales', username: 'reader', password: 'temporary' });
    expect(http.post).toHaveBeenLastCalledWith('/data/sources', expect.objectContaining({ name: 'PG', type: 'postgres', connection_config: expect.objectContaining({ database: 'db', password: 'temporary' }) }));
    expect(result).toMatchObject({ sourceId: 's', database: 'db', schema: 'sales', username: 'reader', status: 'INACTIVE' });
    http.put.mockResolvedValueOnce({ data: { id: 's', tenant_id: 't', name: 'PG', type: 'postgres' } });
    await updateBigDataSource('s', { name: 'PG', password: '' });
    expect(http.put.mock.calls.at(-1)?.[1].connection_config).not.toHaveProperty('password');
  });
});
