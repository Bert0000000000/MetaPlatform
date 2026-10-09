import { describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { createApiClient } from '../../../../packages/shared/src/api/client';
import { apiClient as webClient } from './client';

vi.mock('../../../../packages/shared/src/api/toast', () => ({ toast: vi.fn() }));
vi.mock('@mate/shared', () => ({ toast: vi.fn() }));
vi.mock('@/utils/auth', () => ({
  getToken: () => null, getRefreshToken: () => null,
  removeToken: vi.fn(), setToken: vi.fn(), setRefreshToken: vi.fn(),
}));

describe('真实 HTTP 权限边界', () => {
  it('403 保留状态并向页面明确显示无权访问，不伪装成服务加载故障', async () => {
    const client = createApiClient();
    client.defaults.adapter = async config => {
      const response = { status: 403, statusText: 'Forbidden', data: {
        detail: { code: 'E403_FORBIDDEN', message: 'Administrator role required' },
      }, headers: new AxiosHeaders(), config };
      throw new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, undefined, response);
    };
    await expect(client.get('/admin/configs')).rejects.toMatchObject({
      status: 403, message: '无权访问：当前账号没有所需权限。',
    });
  });
  it('管理员使用的 web 客户端同样明确403，保留 Axios 状态供页面判别', async () => {
    webClient.defaults.adapter = async config => {
      const response = { status: 403, statusText: 'Forbidden', data: {
        detail: { code: 'E403_FORBIDDEN', message: 'Administrator role required' },
      }, headers: new AxiosHeaders(), config };
      throw new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, undefined, response);
    };
    await expect(webClient.get('/admin/configs')).rejects.toMatchObject({
      response: { status: 403 }, message: '无权访问：当前账号没有所需权限。',
    });
  });
});
