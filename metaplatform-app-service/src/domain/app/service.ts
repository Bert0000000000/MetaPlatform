/**
 * 应用（App）领域层 —— 业务编排
 * ────────────────────────────────────────────────────────────
 * 职责：
 *  1. 入参校验（直接抛 BadRequestAppError）
 *  2. 调 Repository 读写
 *  3. 调 audit log（中间件 auditLogMiddleware 已经处理，所以这里不再写）
 *  4. 错误归一化（统一抛 AppError / 内置子类）
 *
 * Sprint 1：list / create / get / update / archive（软删）
 *
 * 跨租户隔离策略：所有读操作强制带 tenantId；跨租户访问 → 404 NotFoundAppError
 * （不用 403，避免泄漏资源存在性）。
 */

import { BadRequestAppError, ConflictAppError, NotFoundAppError } from "../../utils/errors";
import { appRepository } from "./repository";
import {
  rowToEntity,
  type AppEntity,
  type CreateAppInput,
  type ListAppFilter,
  type UpdateAppInput,
} from "./entity";

// code 合法字符：英文小写 + 数字 + 下划线 + 中划线，长度 2~40
const CODE_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;

export const appService = {
  /**
   * 列表
   * @throws 当 tenantId 缺失时抛 BadRequestAppError（理论上不会发生，路由层已校验）
   */
  list(filter: ListAppFilter): { items: AppEntity[]; total: number } {
    const tenantId = requireTenant(filter.tenantId);
    const rows = appRepository.list(tenantId, filter.includeArchived);
    const items = rows.map(rowToEntity);
    return { items, total: items.length };
  },

  /**
   * 创建
   * @throws BadRequestAppError 入参不合规
   * @throws ConflictAppError 同租户 code 已存在
   */
  create(tenantId: string, input: CreateAppInput): AppEntity {
    const tid = requireTenant(tenantId);

    // ── 入参校验 ──
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
    if (!input.createdBy || typeof input.createdBy !== "string") {
      throw new BadRequestAppError("createdBy 必填");
    }

    // ── 唯一性校验（同租户） ──
    if (appRepository.findByCode(code, tid)) {
      throw new ConflictAppError(`code '${code}' 在当前租户下已存在`);
    }

    const row = appRepository.insert({
      tenantId: tid,
      code,
      name,
      icon: input.icon ?? null,
      description: input.description ?? null,
      createdBy: input.createdBy,
    });
    return rowToEntity(row);
  },

  /**
   * 详情
   * @throws NotFoundAppError 跨租户 / 不存在
   */
  get(id: number, tenantId: string): AppEntity {
    const tid = requireTenant(tenantId);
    const row = appRepository.findById(id, tid);
    if (!row) throw new NotFoundAppError(`应用 ${id} 不存在`);
    return rowToEntity(row);
  },

  /**
   * 局部更新
   * @throws BadRequestAppError 入参不合规
   * @throws NotFoundAppError 应用不存在 / 跨租户
   * @throws ConflictAppError 乐观锁冲突
   */
  update(id: number, tenantId: string, expectedVersion: number, patch: UpdateAppInput): AppEntity {
    const tid = requireTenant(tenantId);

    // 入参校验（空 patch 直接抛）
    const hasAny = patch.name !== undefined || patch.icon !== undefined || patch.description !== undefined;
    if (!hasAny) {
      throw new BadRequestAppError("至少要更新一个字段");
    }
    if (patch.name !== undefined) {
      const n = String(patch.name).trim();
      if (n.length < 2 || n.length > 30) {
        throw new BadRequestAppError("name 长度必须为 2~30");
      }
    }

    const row = appRepository.update(id, tid, expectedVersion, patch);
    if (!row) {
      // 区分：当前行版本 vs 期望版本
      const current = appRepository.findById(id, tid);
      if (!current) throw new NotFoundAppError(`应用 ${id} 不存在`);
      throw new ConflictAppError(
        `乐观锁冲突：当前 version=${current.version}，请求 version=${expectedVersion}`,
      );
    }
    return rowToEntity(row);
  },

  /**
   * 软删（archive）
   * @throws NotFoundAppError 应用不存在 / 跨租户
   */
  archive(id: number, tenantId: string): AppEntity {
    const tid = requireTenant(tenantId);
    const row = appRepository.archiveById(id, tid);
    if (!row) throw new NotFoundAppError(`应用 ${id} 不存在`);
    return rowToEntity(row);
  },
};

// ── helpers ─────────────────────────────────────────────────

function requireTenant(tenantId: string | undefined | null): string {
  if (!tenantId || typeof tenantId !== "string" || tenantId.length === 0) {
    throw new BadRequestAppError("缺少 tenantId（请通过 JWT 登录）");
  }
  return tenantId;
}