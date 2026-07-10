/**
 * 应用（App）领域层 —— 仓储
 * ────────────────────────────────────────────────────────────
 * 纯函数 + 闭包持有 db 连接；不依赖外部 ORM。
 * 所有 SQL 用 prepared statement（防止注入）。
 *
 * 注意：本层不做租户隔离校验，调用方（Service）负责传入 tenantId。
 *
 * 设计要点：repository 工厂每次调用 getDb()，不缓存 db 句柄，
 * 原因是测试中会 resetDb() 重置底层 SQLite 文件。
 */

import type Database from "better-sqlite3";
import { getDb } from "../../db/connection";
import type { AppRow, CreateAppInput, UpdateAppInput } from "./entity";

/** 获取 db 实例（每次调用，避免缓存过期） */
function db(): Database.Database {
  return getDb();
}

/**
 * Repository 工厂：返回一个绑定了 db 的对象。
 * 直接调用本函数得到的是 stateless 风格；prepared statements 缓存
 * 在 closure 内，重置 db 后 prepared statements 会失效，故每次重建。
 */
export function createAppRepository() {
  // ── prepared statements（每次工厂调用重新 prepare，避免持有失效 statement）───
  let insertStmt = db().prepare<
    [string, string, string, string | null, string | null, string]
  >(`
    INSERT INTO apps (tenant_id, code, name, icon, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const findByIdStmt = () => db().prepare<[number, string]>(`
    SELECT * FROM apps WHERE id = ? AND tenant_id = ?
  `);

  const findByCodeStmt = () => db().prepare<[string, string]>(`
    SELECT * FROM apps WHERE tenant_id = ? AND code = ?
  `);

  const listStmt = () => db().prepare<[string]>(`
    SELECT * FROM apps WHERE tenant_id = ? AND status = 'active' ORDER BY id DESC
  `);

  const listAllStmt = () => db().prepare<[string]>(`
    SELECT * FROM apps WHERE tenant_id = ? ORDER BY id DESC
  `);

  const updateStmt = () =>
    db().prepare<[string, string | null, string | null, number, string, number]>(`
      UPDATE apps
      SET name = ?, icon = ?, description = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ? AND version = ?
    `);

  const archiveStmt = () =>
    db().prepare<[number, string]>(`
      UPDATE apps
      SET status = 'archived', version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `);

  // ── methods ────────────────────────────────────────────

  /** 插入新应用 */
  function insert(input: CreateAppInput & { tenantId: string }): AppRow {
    insertStmt = db().prepare<
      [string, string, string, string | null, string | null, string]
    >(`
      INSERT INTO apps (tenant_id, code, name, icon, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = insertStmt.run(
      input.tenantId,
      input.code,
      input.name,
      input.icon ?? null,
      input.description ?? null,
      input.createdBy,
    );
    const id = Number(result.lastInsertRowid);
    const row = findByIdStmt().get(id, input.tenantId) as AppRow | undefined;
    if (!row) {
      throw new Error("apps insert 后查不到行（理论上不可能）");
    }
    return row;
  }

  /** 按 id 查（强制带 tenantId 防越权） */
  function findById(id: number, tenantId: string): AppRow | null {
    const row = findByIdStmt().get(id, tenantId) as AppRow | undefined;
    return row ?? null;
  }

  /** 按 code 查（用于唯一性校验） */
  function findByCode(code: string, tenantId: string): AppRow | null {
    const row = findByCodeStmt().get(tenantId, code) as AppRow | undefined;
    return row ?? null;
  }

  /** 列表 */
  function list(tenantId: string, includeArchived = false): AppRow[] {
    const stmt = includeArchived ? listAllStmt() : listStmt();
    return stmt.all(tenantId) as AppRow[];
  }

  /**
   * 局部更新。
   * 基于乐观锁 version：传 None 表示该字段不更新。
   * 返回更新后的行；版本号 mismatch 时返回 null（调用方决定如何处理）。
   */
  function update(
    id: number,
    tenantId: string,
    expectedVersion: number,
    patch: UpdateAppInput,
  ): AppRow | null {
    // 取当前行
    const current = findById(id, tenantId);
    if (!current) return null;
    if (current.version !== expectedVersion) return null;

    const next = {
      name: patch.name ?? current.name,
      icon: patch.icon === undefined ? current.icon : patch.icon,
      description: patch.description === undefined ? current.description : patch.description,
    };
    updateStmt().run(next.name, next.icon, next.description, id, tenantId, expectedVersion);
    return findById(id, tenantId);
  }

  /** 软删：把 status 改成 archived（保留行，version+1） */
  function archiveById(id: number, tenantId: string): AppRow | null {
    const before = findById(id, tenantId);
    if (!before) return null;
    if (before.status === "archived") {
      // 幂等：已经 archived 不再 +1 version
      return before;
    }
    archiveStmt().run(id, tenantId);
    return findById(id, tenantId);
  }

  return {
    insert,
    findById,
    findByCode,
    list,
    update,
    archiveById,
  };
}

export type AppRepository = ReturnType<typeof createAppRepository>;

/**
 * 默认实例：每次调用方法都重新拿 db（不会缓存失效句柄）。
 * 用 Proxy 让代码看起来还是 `appRepository.xxx(...)`。
 */
function makeLazyRepository(): AppRepository {
  // 每次调用都 build 一个新的 repo（避免 prepared statement 失效）
  return {
    insert: (...args) => createAppRepository().insert(...args),
    findById: (...args) => createAppRepository().findById(...args),
    findByCode: (...args) => createAppRepository().findByCode(...args),
    list: (...args) => createAppRepository().list(...args),
    update: (...args) => createAppRepository().update(...args),
    archiveById: (...args) => createAppRepository().archiveById(...args),
  };
}

export const appRepository: AppRepository = makeLazyRepository();