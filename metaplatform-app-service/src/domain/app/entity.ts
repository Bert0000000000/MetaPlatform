/**
 * 应用（App）领域层 —— 实体类型
 * ────────────────────────────────────────────────────────────
 * 对应数据库表：apps（见 src/db/migrations/001_init.sql §1）
 * Sprint 1 范围：US-101（列表）/ US-102（新建）/ US-104（详情）
 *
 * 约束：
 *  - code 在同 tenant 下唯一（UNIQUE(tenant_id, code)）
 *  - status 仅 active / archived（软删）
 *  - version 乐观锁用
 */

export type AppStatus = "active" | "archived";

/** 数据库原始行（snake_case） */
export interface AppRow {
  id: number;
  tenant_id: string;
  code: string;
  name: string;
  icon: string | null;
  description: string | null;
  version: number;
  status: AppStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** API 返回的实体（camelCase + ISO 字符串） */
export interface AppEntity {
  id: number;
  tenantId: string;
  code: string;
  name: string;
  icon: string | null;
  description: string | null;
  version: number;
  status: AppStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Service 层入参：创建应用 */
export interface CreateAppInput {
  code: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  /** 创建者：路由层从 req.user 注入；这里也允许传，方便测试 */
  createdBy: string;
}

/** Service 层入参：更新应用（partial） */
export interface UpdateAppInput {
  name?: string;
  icon?: string | null;
  description?: string | null;
}

/** Service 层入参：列表过滤 */
export interface ListAppFilter {
  tenantId: string;
  /** 默认只返回 active；true 时把 archived 也返回 */
  includeArchived?: boolean;
}

/**
 * 把数据库行转成 API 实体。
 * 所有时间字段统一 ISO 字符串，便于前端 Date.parse。
 */
export function rowToEntity(row: AppRow): AppEntity {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    icon: row.icon,
    description: row.description,
    version: row.version,
    status: row.status,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * SQLite 默认 CURRENT_TIMESTAMP 返回 'YYYY-MM-DD HH:MM:SS'（UTC，无时区）。
 * 转成 ISO 字符串（'YYYY-MM-DDTHH:MM:SSZ'）保证前端能 parse。
 */
function toIso(value: string): string {
  // 兼容 'YYYY-MM-DD HH:MM:SS' 与 'YYYY-MM-DDTHH:MM:SS.sssZ' 两种
  if (value.includes("T")) return value;
  return value.replace(" ", "T") + "Z";
}