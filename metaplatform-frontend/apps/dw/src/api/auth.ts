import { post } from './client';
import { setToken, setUser } from '@mate/shared';
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
  const data = await post<AuthResponse>('/v1/dw/auth/login', request);
  setToken(data.accessToken);
  setUser({
    id: data.userId,
    username: data.username,
    tenantId: request.tenantId,
  });
}
