import { post } from './client';
import { setToken, setUser } from '@/utils/auth';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    tenantId: string;
    roles?: string[];
  };
}

export async function login(request: LoginRequest): Promise<void> {
  const response = await post<LoginResponse>('/v1/iam/auth/login', request);
  setToken(response.token);
  setUser(response.user);
}
