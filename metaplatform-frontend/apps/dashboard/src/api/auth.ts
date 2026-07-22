import { post } from './client';
import { setToken, setUser, type AuthUser } from '@/utils/auth';

export interface LoginRequest {
  username: string;
  password: string;
  tenantId?: string;
}

export interface LoginResponse {
  loginResult: string;
  userId: string;
  username: string;
  realName: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
  requirePasswordReset: boolean;
  mfaRequired: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    realName: string;
    status: string;
  };
}

export async function login(request: LoginRequest): Promise<void> {
  const response = await post<LoginResponse>('/v1/iam/auth/login', request);
  setToken(response.accessToken);
  const user: AuthUser = {
    id: response.user.id,
    username: response.user.username,
    tenantId: request.tenantId || 'tenant-default',
    roles: [],
  };
  setUser(user);
}
