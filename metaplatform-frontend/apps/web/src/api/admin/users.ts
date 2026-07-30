import { apiClient } from "../client";
import { ADMIN_BASE, unwrap } from "./base";
import type {
  AdminUser,
  AdminLoginLog,
  ApiEnvelope,
  PageResult,
  UserStatus,
} from "@/types";

export interface ListUsersParams {
  keyword?: string;
  status?: UserStatus | "";
  department?: string;
  roleId?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateUserPayload {
  username: string;
  realName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  password?: string;
  status?: UserStatus;
  isSuperAdmin?: boolean;
  roleIds?: number[];
}

export interface UpdateUserPayload {
  realName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  avatar?: string;
  status?: UserStatus;
  isSuperAdmin?: boolean;
  roleIds?: number[];
}

export interface CreateUserResponse extends AdminUser {
  initialPassword: string;
}

export interface ResetPasswordResponse {
  userId: number;
  username: string;
  temporaryPassword: string;
}

function params(p?: ListUsersParams): Record<string, unknown> | undefined {
  if (!p) return undefined;
  const out: Record<string, unknown> = {};
  if (p.keyword) out.keyword = p.keyword;
  if (p.status) out.status = p.status;
  if (p.department) out.department = p.department;
  // 后端 list users 查询参数 roleId 实际期望 snake_case role_id
  if (p.roleId) out.role_id = p.roleId;
  if (p.page) out.page = p.page;
  if (p.pageSize) out.pageSize = p.pageSize;
  return Object.keys(out).length ? out : undefined;
}

export async function listUsers(p?: ListUsersParams): Promise<PageResult<AdminUser>> {
  const { data } = await apiClient.get(ADMIN_BASE + "/users", { params: params(p) });
  return unwrap<PageResult<AdminUser>>(data as ApiEnvelope<PageResult<AdminUser>>);
}

export async function getUser(id: number): Promise<AdminUser> {
  const { data } = await apiClient.get(ADMIN_BASE + "/users/" + id);
  return unwrap<AdminUser>(data as ApiEnvelope<AdminUser>);
}

export async function createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
  // Pydantic silently drops unknown fields, so snake_case explicitly
  const { data } = await apiClient.post(ADMIN_BASE + "/users", {
    username: payload.username,
    real_name: payload.realName,
    email: payload.email,
    phone: payload.phone,
    department: payload.department,
    position: payload.position,
    password: payload.password,
    status: payload.status,
    is_super_admin: payload.isSuperAdmin,
    role_ids: payload.roleIds,
  });
  return unwrap<CreateUserResponse>(data as ApiEnvelope<CreateUserResponse>);
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUser> {
  const body: Record<string, unknown> = {};
  if (payload.realName !== undefined) body.real_name = payload.realName;
  if (payload.email !== undefined) body.email = payload.email;
  if (payload.phone !== undefined) body.phone = payload.phone;
  if (payload.department !== undefined) body.department = payload.department;
  if (payload.position !== undefined) body.position = payload.position;
  if (payload.avatar !== undefined) body.avatar = payload.avatar;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.isSuperAdmin !== undefined) body.is_super_admin = payload.isSuperAdmin;
  if (payload.roleIds !== undefined) body.role_ids = payload.roleIds;
  const { data } = await apiClient.put(ADMIN_BASE + "/users/" + id, body);
  return unwrap<AdminUser>(data as ApiEnvelope<AdminUser>);
}

export async function deleteUser(id: number): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete(ADMIN_BASE + "/users/" + id);
  return unwrap<{ deleted: number }>(data as ApiEnvelope<{ deleted: number }>);
}

export async function resetUserPassword(id: number): Promise<ResetPasswordResponse> {
  const { data } = await apiClient.post(ADMIN_BASE + "/users/" + id + "/reset-password");
  return unwrap<ResetPasswordResponse>(data as ApiEnvelope<ResetPasswordResponse>);
}

export async function setUserStatus(id: number, status: UserStatus): Promise<{ userId: number; status: UserStatus }> {
  const { data } = await apiClient.post(ADMIN_BASE + "/users/" + id + "/status", { status });
  return unwrap<{ userId: number; status: UserStatus }>(data as ApiEnvelope<{ userId: number; status: UserStatus }>);
}

export async function importUsers(file: File): Promise<{ created: number; skipped: number; errors: unknown[] }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post(ADMIN_BASE + "/users/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrap<{ created: number; skipped: number; errors: unknown[] }>(
    data as ApiEnvelope<{ created: number; skipped: number; errors: unknown[] }>,
  );
}

export function usersExportUrl(): string {
  return ADMIN_BASE + "/users/export";
}

export async function listUserLoginLogs(
  id: number,
  page = 1,
  pageSize = 20,
): Promise<PageResult<AdminLoginLog>> {
  const { data } = await apiClient.get(ADMIN_BASE + "/users/" + id + "/login-logs", {
    params: { page, pageSize },
  });
  return unwrap<PageResult<AdminLoginLog>>(data as ApiEnvelope<PageResult<AdminLoginLog>>);
}
