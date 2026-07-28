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
  if (p.roleId) out.roleId = p.roleId;
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
  const { data } = await apiClient.post(ADMIN_BASE + "/users", payload);
  return unwrap<CreateUserResponse>(data as ApiEnvelope<CreateUserResponse>);
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUser> {
  const { data } = await apiClient.put(ADMIN_BASE + "/users/" + id, payload);
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
