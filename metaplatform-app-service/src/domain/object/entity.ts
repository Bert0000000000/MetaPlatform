/**
 * 对象（Object）领域层 —— 实体类型
 * ────────────────────────────────────────────────────────────
 * 对应数据库表：app_objects（见 src/db/migrations/001_init.sql §2）
 * Sprint 1 范围：US-103 配置对象模型（含 5 字段）
 *
 * 约束：
 *  - 字段类型在 Sprint 1 MVP 范围内：string / longtext / number / boolean / date / datetime / enum
 *  - 同 app 内 code 唯一（UNIQUE(app_id, code)）
 *  - 修改 fields 必须删除重建（task doc AC-103.5）
 */

import type { OntologyFieldSpec, OntologyFieldType } from "../../clients/ontology.client";

/** 业务暴露的字段类型集合（与 ontology-client 对齐） */
export type AppObjectFieldType = OntologyFieldType;

/** 业务校验：哪些类型允许（M1 MVP） */
export const ALLOWED_FIELD_TYPES: AppObjectFieldType[] = [
  "string",
  "longtext",
  "number",
  "boolean",
  "date",
  "datetime",
  "enum",
];

/** 数据库原始行 */
export interface ObjectRow {
  id: number;
  app_id: number;
  code: string;
  name: string;
  description: string | null;
  schema_json: string;
  data_table_name: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** API 实体 */
export interface ObjectEntity {
  id: number;
  appId: number;
  code: string;
  name: string;
  description: string | null;
  /** 解析后的字段定义数组（schema_json 反序列化） */
  fields: OntologyFieldSpec[];
  dataTableName: string;
  /** ontology-engine 返回的 ObjectType ID（如果有调用过） */
  ontologyObjectId?: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 业务层：Object 字段定义（与 ontology-client 兼容） */
export interface ObjectFieldInput {
  code: string;
  name: string;
  type: AppObjectFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
}

/** 创建对象入参 */
export interface CreateObjectInput {
  code: string;
  name: string;
  description?: string | null;
  fields: ObjectFieldInput[];
  createdBy: string;
}

/** 更新对象入参（仅允许 name / description，不允许改 fields；含 fields 视为违规） */
export interface UpdateObjectInput {
  name?: string;
  description?: string | null;
  /** 内部标记：用于路由层把请求 body 透传过来，service 检测到即 400 */
  fields?: unknown;
}

/** Service 列表过滤 */
export interface ListObjectFilter {
  appId: number;
}

/**
 * 数据库行 → API 实体
 * 解析 schema_json；如果解析失败保留原字符串作为诊断信息。
 */
export function rowToEntity(row: ObjectRow): ObjectEntity {
  let fields: OntologyFieldSpec[] = [];
  try {
    const parsed = JSON.parse(row.schema_json);
    if (Array.isArray(parsed)) {
      fields = parsed as OntologyFieldSpec[];
    }
  } catch {
    fields = [];
  }
  return {
    id: row.id,
    appId: row.app_id,
    code: row.code,
    name: row.name,
    description: row.description,
    fields,
    dataTableName: row.data_table_name,
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