import { get } from './client';
import type { UserProfile, UserPermissions } from '@/types';

/**
 * 当前登录用户信息：GET /v1/iam/auth/me
 * 返回包含邮箱、姓名、租户、角色、部门、权限摘要。
 */
export async function getCurrentUser(): Promise<UserProfile> {
  return get<UserProfile>('/v1/iam/auth/me');
}

/**
 * 当前登录用户权限聚合：GET /v1/iam/auth/me/permissions
 * 对齐 SPEC-TECH-IAM 3.5.8，供个人中心「权限查看」按模块分组展示。
 */
export async function getCurrentUserPermissions(): Promise<UserPermissions> {
  return get<UserPermissions>('/v1/iam/auth/me/permissions');
}
