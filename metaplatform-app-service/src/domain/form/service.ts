/**
 * 表单（Form）领域层 —— 业务编排
 * ────────────────────────────────────────────────────────────
 * Sprint 1：create / list / get / update / publish
 *
 * 关键约束：
 *  - form 必须挂在已存在的 object 下
 *  - object 必须挂在当前 tenant 的 app 下（避免跨租户悬挂）
 */

import { BadRequestAppError, ConflictAppError, NotFoundAppError } from "../../utils/errors";
import { appRepository } from "../app/repository";
import { objectRepository } from "../object/repository";
import {
  type CreateFormInput,
  type FormEntity,
  type UpdateFormInput,
  rowToEntity,
} from "./entity";
import { formRepository } from "./repository";

const CODE_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;

export const formService = {
  /** 列表 */
  list(appId: number, tenantId: string): { appId: number; items: FormEntity[]; total: number } {
    const app = assertAppOwnedByTenant(appId, tenantId);
    const rows = formRepository.list(app.id);
    const items = rows.map(rowToEntity);
    return { appId: app.id, items, total: items.length };
  },

  /** 详情 */
  get(appId: number, formId: number, tenantId: string): FormEntity {
    const app = assertAppOwnedByTenant(appId, tenantId);
    const row = formRepository.findById(formId, app.id);
    if (!row) throw new NotFoundAppError(`表单 ${formId} 不存在`);
    return rowToEntity(row);
  },

  /**
   * 创建表单
   * 校验：objectId 必须存在 + 归属当前 app
   */
  create(appId: number, tenantId: string, input: CreateFormInput): FormEntity {
    const app = assertAppOwnedByTenant(appId, tenantId);

    // 入参校验
    if (typeof input.objectId !== "number" || !Number.isInteger(input.objectId) || input.objectId <= 0) {
      throw new BadRequestAppError("objectId 必填且必须为正整数");
    }
    const code = (input.code ?? "").trim();
    const name = (input.name ?? "").trim();
    if (!CODE_PATTERN.test(code)) {
      throw new BadRequestAppError(
        "code 必须以小写字母开头，长度 2~40，仅含 a-z、0-9、_、-",
      );
    }
    if (name.length < 2 || name.length > 30) {
      throw new BadRequestAppError("name 长度必须为 2~30");
    }
    if (!input.schema || typeof input.schema !== "object" || Array.isArray(input.schema)) {
      throw new BadRequestAppError("schema 必填且必须为对象");
    }
    if (!input.createdBy || typeof input.createdBy !== "string") {
      throw new BadRequestAppError("createdBy 必填");
    }

    // object 归属校验
    const obj = objectRepository.findById(input.objectId, app.id);
    if (!obj) {
      throw new NotFoundAppError(
        `对象 ${input.objectId} 不存在或不属于应用 ${app.id}`,
      );
    }

    // 唯一性（同 object 内 code 唯一）
    if (formRepository.findByCode(code, app.id, obj.id)) {
      throw new ConflictAppError(`表单 code '${code}' 在当前对象下已存在`);
    }

    const row = formRepository.insert({
      appId: app.id,
      objectId: obj.id,
      code,
      name,
      schemaJson: JSON.stringify(input.schema),
      status: "draft",
      createdBy: input.createdBy,
    });
    return rowToEntity(row);
  },

  /** 更新表单（name / schema） */
  update(appId: number, formId: number, tenantId: string, patch: UpdateFormInput): FormEntity {
    const app = assertAppOwnedByTenant(appId, tenantId);

    const hasAny = patch.name !== undefined || patch.schema !== undefined;
    if (!hasAny) {
      throw new BadRequestAppError("至少要更新一个字段");
    }
    if (patch.name !== undefined) {
      const n = String(patch.name).trim();
      if (n.length < 2 || n.length > 30) {
        throw new BadRequestAppError("name 长度必须为 2~30");
      }
    }
    if (patch.schema !== undefined) {
      if (
        !patch.schema ||
        typeof patch.schema !== "object" ||
        Array.isArray(patch.schema)
      ) {
        throw new BadRequestAppError("schema 必须是对象");
      }
    }

    const row = formRepository.update(formId, app.id, {
      name: patch.name,
      schemaJson: patch.schema !== undefined ? JSON.stringify(patch.schema) : undefined,
    });
    if (!row) throw new NotFoundAppError(`表单 ${formId} 不存在`);
    return rowToEntity(row);
  },

  /**
   * 发布表单：draft → published；version+1
   * Sprint 2 起会调 pageGenerator.validateSchema()，先留 TODO
   */
  publish(appId: number, formId: number, tenantId: string): FormEntity {
    const app = assertAppOwnedByTenant(appId, tenantId);
    const current = formRepository.findById(formId, app.id);
    if (!current) throw new NotFoundAppError(`表单 ${formId} 不存在`);
    if (current.status === "published") {
      // 幂等：已发布直接返回
      return rowToEntity(current);
    }
    const row = formRepository.publish(formId, app.id);
    if (!row) throw new NotFoundAppError(`表单 ${formId} 不存在`);
    // TODO(Sprint 2): pageGenerator.validateSchema()
    return rowToEntity(row);
  },
};

// ── helpers ─────────────────────────────────────────────────

function assertAppOwnedByTenant(appId: number, tenantId: string) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new BadRequestAppError("缺少 tenantId");
  }
  const app = appRepository.findById(appId, tenantId);
  if (!app) throw new NotFoundAppError(`应用 ${appId} 不存在`);
  return app;
}