import { apiClient } from './client';
import { setToken, setUser } from '@/utils/auth';

export interface LoginRequest {
  username: string;
  password: string;
  tenantId: string;
}

export interface AuthResponse {
  loginResult: string;
  userId: string;
  username: string;
  realName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

export async function login(request: LoginRequest): Promise<void> {
  const response = await apiClient.post('/v1/iam/auth/login', request);
  const data = response.data.data as AuthResponse;
  setToken(data.accessToken);
  setUser({
    id: data.userId,
    username: data.username,
    tenantId: request.tenantId,
  });
}
