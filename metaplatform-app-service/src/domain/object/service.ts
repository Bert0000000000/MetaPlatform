/**
 * 对象（Object）领域层 —— 业务编排
 * ────────────────────────────────────────────────────────────
 * Sprint 1：create / list / get / update / delete
 *
 * create 流程：
 *   1. 校验 code / name / fields（含类型白名单）
 *   2. 校验 app 存在 + 同租户
 *   3. 校验同 app 内 code 唯一
 *   4. ontologyClient.createObjectType → 注册语义层
 *   5. createDataTable(appCode, objectCode, fields) → 拿到物理表名
 *   6. INSERT INTO app_objects (...)
 *   7. 若 ontology 失败 → 回滚：dropDataTable + 抛错
 */

import { ontologyClient } from "../../clients/ontology.client";
import { createDataTable, dropDataTable } from "../../db/connection";
import { BadRequestAppError, ConflictAppError, NotFoundAppError, toAppError } from "../../utils/errors";
import { appRepository } from "../app/repository";
import {
  ALLOWED_FIELD_TYPES,
  type CreateObjectInput,
  type ObjectEntity,
  type ObjectFieldInput,
  type UpdateObjectInput,
  rowToEntity,
} from "./entity";
import { objectRepository } from "./repository";

// object code 合法字符
const CODE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
// field code 合法字符（更宽松以兼容业务字段命名）
const FIELD_CODE_PATTERN = /^[a-z][a-z0-9_]{0,39}$/i;
// 一次最多字段数（防滥用）
const MAX_FIELDS_PER_OBJECT = 50;

export const objectService = {
  /** 列表 */
  list(appId: number, tenantId: string): { appId: number; items: ObjectEntity[]; total: number } {
    const { app } = assertAppOwnedByTenant(appId, tenantId);
    const rows = objectRepository.list(app.id);
    const items = rows.map(rowToEntity);
    return { appId: app.id, items, total: items.length };
  },

  /** 详情 */
  get(appId: number, objectId: number, tenantId: string): ObjectEntity {
    const { app } = assertAppOwnedByTenant(appId, tenantId);
    const row = objectRepository.findById(objectId, app.id);
    if (!row) throw new NotFoundAppError(`对象 ${objectId} 不存在`);
    return rowToEntity(row);
  },

  /**
   * 创建对象（含 ontology-engine + 动态表）
   */
  async create(appId: number, tenantId: string, input: CreateObjectInput): Promise<ObjectEntity> {
    const { app } = assertAppOwnedByTenant(appId, tenantId);

    // ── 1. 入参校验 ──
    const code = (input.code ?? "").trim();
    const name = (input.name ?? "").trim();
    if (!CODE_PATTERN.test(code)) {
      throw new BadRequestAppError(
        "code 必须以小写字母开头，长度 2~40，仅含 a-z、0-9、_",
      );
    }
    if (name.length < 2 || name.length > 30) {
      throw new BadRequestAppError("name 长度必须为 2~30");
    }
    const fields = validateAndNormalizeFields(input.fields);

    if (!input.createdBy || typeof input.createdBy !== "string") {
      throw new BadRequestAppError("createdBy 必填");
    }

    // ── 2. 唯一性（同 app 内 code 唯一） ──
    if (objectRepository.findByCode(code, app.id)) {
      throw new ConflictAppError(`对象 code '${code}' 在当前应用下已存在`);
    }

    // ── 3. ontology-engine 注册语义类型 ──
    //    失败时抛 5xx（service 层统一包成 InternalAppError），
    //    物理表此时还未建，回滚只清空临时变量即可。
    const created = await ontologyClient.createObjectType({
      code,
      name,
      description: input.description ?? "",
      fields,
    });
    const ontologyObjectId: string | null = created?.id ?? null;

    // ── 4. 建物理表 + 落元数据 ──
    let dataTableName: string;
    try {
      dataTableName = createDataTable(app.code, code, fields);
    } catch (err) {
      // 物理建表失败 → 抛 5xx
      throw toAppError(err);
    }

    try {
      const row = objectRepository.insert({
        appId: app.id,
        code,
        name,
        description: input.description ?? null,
        fields,
        dataTableName,
        createdBy: input.createdBy,
      });
      const entity = rowToEntity(row);
      if (ontologyObjectId) {
        (entity as ObjectEntity & { ontologyObjectId?: string | null }).ontologyObjectId =
          ontologyObjectId;
      }
      return entity;
    } catch (err) {
      // 入库失败 → 回滚物理表
      try {
        dropDataTable(dataTableName);
      } catch {
        // ignore
      }
      throw toAppError(err);
    }
  },

  /**
   * 更新对象 —— Sprint 1 仅允许 name / description。
   * 尝试改 fields → 抛 400（AC-103.5）
   */
  update(appId: number, objectId: number, tenantId: string, patch: UpdateObjectInput): ObjectEntity {
    const { app } = assertAppOwnedByTenant(appId, tenantId);

    if ((patch as UpdateObjectInput & { fields?: unknown }).fields !== undefined) {
      throw new BadRequestAppError("字段列表不可修改，请删除重建（参考 AC-103.5）");
    }
    const hasAny = patch.name !== undefined || patch.description !== undefined;
    if (!hasAny) {
      throw new BadRequestAppError("至少要更新一个字段");
    }
    if (patch.name !== undefined) {
      const n = String(patch.name).trim();
      if (n.length < 2 || n.length > 30) {
        throw new BadRequestAppError("name 长度必须为 2~30");
      }
    }

    const row = objectRepository.update(objectId, app.id, patch);
    if (!row) throw new NotFoundAppError(`对象 ${objectId} 不存在`);
    return rowToEntity(row);
  },

  /**
   * 删除对象：dropDataTable + delete row
   */
  async delete(appId: number, objectId: number, tenantId: string): Promise<void> {
    const { app } = assertAppOwnedByTenant(appId, tenantId);
    const row = objectRepository.deleteById(objectId, app.id);
    if (!row) throw new NotFoundAppError(`对象 ${objectId} 不存在`);
    // 物理表清理
    try {
      dropDataTable(row.data_table_name);
    } catch (err) {
      // dropDataTable 失败不阻断（表可能已被清理），仅记录
      // eslint-disable-next-line no-console
      console.warn(
        `[object.service] dropDataTable(${row.data_table_name}) 失败：${(err as Error).message}`,
      );
    }
    // ontology-engine 不再清理（语义层不删，Sprint 1 演示阶段保留）
    // 真实生产应当调用 ontologyClient.dropObjectType(id)
  },
};

// ── helpers ─────────────────────────────────────────────────

function assertAppOwnedByTenant(appId: number, tenantId: string) {
  const app = appRepository.findById(appId, tenantId);
  if (!app) throw new NotFoundAppError(`应用 ${appId} 不存在`);
  return { app };
}

function validateAndNormalizeFields(raw: unknown): ObjectFieldInput[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestAppError("fields 必须为数组");
  }
  if (raw.length === 0) {
    throw new BadRequestAppError("fields 至少要 1 个字段");
  }
  if (raw.length > MAX_FIELDS_PER_OBJECT) {
    throw new BadRequestAppError(
      `fields 数量超过上限 ${MAX_FIELDS_PER_OBJECT}`,
    );
  }
  const seen = new Set<string>();
  const normalized: ObjectFieldInput[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") {
      throw new BadRequestAppError("fields 项必须为对象");
    }
    const item = f as Partial<ObjectFieldInput>;
    const code = String(item.code ?? "").trim();
    const name = String(item.name ?? "").trim();
    const type = String(item.type ?? "") as ObjectFieldInput["type"];
    if (!FIELD_CODE_PATTERN.test(code)) {
      throw new BadRequestAppError(
        `字段 code '${code}' 不合法：必须以字母开头，仅含字母数字下划线`,
      );
    }
    if (!name) {
      throw new BadRequestAppError(`字段 ${code} 缺少 name`);
    }
    if (!ALLOWED_FIELD_TYPES.includes(type)) {
      throw new BadRequestAppError(
        `字段 ${code} 的 type '${type}' 非法，允许：${ALLOWED_FIELD_TYPES.join(", ")}`,
      );
    }
    if (seen.has(code)) {
      throw new BadRequestAppError(`字段 code '${code}' 重复`);
    }
    seen.add(code);
    normalized.push({
      code,
      name,
      type,
      required: !!item.required,
      options: type === "enum" ? (item.options ?? []) : undefined,
    });
  }
  return normalized;
}