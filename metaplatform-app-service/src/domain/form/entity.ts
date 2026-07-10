/**
 * 表单（Form）领域层 —— 实体类型
 * ────────────────────────────────────────────────────────────
 * 对应数据库表：app_forms（见 src/db/migrations/001_init.sql §3）
 * Sprint 1 范围：US-201 表单骨架（create / get / publish）
 *
 * 约束：
 *  - form 必须挂在已存在的 object 下（外键约束）
 *  - 同 object 内 code 唯一（UNIQUE(object_id, code)）
 *  - 状态：draft / published
 *  - schema 自由 JSON（前端 schema JSON）
 */

export type FormStatus = "draft" | "published";

/** 数据库原始行 */
export interface FormRow {
  id: number;
  app_id: number;
  object_id: number;
  code: string;
  name: string;
  schema_json: string;
  status: FormStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** API 实体 */
export interface FormEntity {
  id: number;
  appId: number;
  objectId: number;
  code: string;
  name: string;
  /** 解析后的 schema（schema_json 反序列化） */
  schema: Record<string, unknown>;
  status: FormStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 创建表单入参 */
export interface CreateFormInput {
  objectId: number;
  code: string;
  name: string;
  /** 表单控件 schema，object 必填（路由层透传：undefined/非对象在 service 校验） */
  schema: Record<string, unknown>;
  createdBy: string;
}

/** 更新表单入参（部分更新） */
export interface UpdateFormInput {
  name?: string;
  schema?: Record<string, unknown>;
}

/**
 * 数据库行 → API 实体
 */
export function rowToEntity(row: FormRow): FormEntity {
  let schema: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.schema_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      schema = parsed as Record<string, unknown>;
    }
  } catch {
    schema = {};
  }
  return {
    id: row.id,
    appId: row.app_id,
    objectId: row.object_id,
    code: row.code,
    name: row.name,
    schema,
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toIso(value: string): string {
  if (value.includes("T")) return value;
  return value.replace(" ", "T") + "Z";
}