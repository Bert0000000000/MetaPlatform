import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('iam', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }

import { setToken, setUser } from '@mate/shared';
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    tenantId: string;
    roles?: string[];
  };
}

export async function login(request: LoginRequest): Promise<void> {
  const response = await post<LoginResponse>('/v1/iam/auth/login', request);
  setToken(response.accessToken);
  setUser(response.user);
}
