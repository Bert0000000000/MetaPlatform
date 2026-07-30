import { createApiClient, apiPath } from '@mate/shared/api';

export const apiClient = createApiClient({ baseURL: apiPath('superai', '/v1') });

import type { LoginRequest, AuthResponse } from './types';
import { setToken, setUser } from '@mate/shared';
export async function login(request: LoginRequest): Promise<void> {
  const response = await apiClient.post('/v1/copilot/auth/login', request);
  const data = (response.data as { data: AuthResponse }).data;
  setToken(data.accessToken);
  setUser({
    id: data.userId,
    username: data.username,
    tenantId: request.tenantId,
  });
}
