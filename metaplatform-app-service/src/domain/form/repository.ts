/**
 * 表单（Form）领域层 —— 仓储
 * ────────────────────────────────────────────────────────────
 * 设计要点：repository 工厂每次调用 getDb()，不缓存 db 句柄，
 * 原因是测试中会 resetDb() 重置底层 SQLite 文件。
 */

import type Database from "better-sqlite3";
import { getDb } from "../../db/connection";
import type { FormRow, FormStatus } from "./entity";

/** update() 接受的局部 patch 类型 */
interface UpdateFormPatch {
  name?: string;
  schemaJson?: string;
}

function db(): Database.Database {
  return getDb();
}

export function createFormRepository() {
  const insertStmt = () =>
    db().prepare<[number, number, string, string, string, FormStatus, string]>(`
      INSERT INTO app_forms
        (app_id, object_id, code, name, schema_json, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

  const findByIdStmt = () =>
    db().prepare<[number, number]>(`
      SELECT * FROM app_forms WHERE id = ? AND app_id = ?
    `);

  const findByCodeStmt = () =>
    db().prepare<[number, number, string]>(`
      SELECT * FROM app_forms WHERE app_id = ? AND object_id = ? AND code = ?
    `);

  const listStmt = () =>
    db().prepare<[number]>(`
      SELECT * FROM app_forms WHERE app_id = ? ORDER BY id ASC
    `);

  const updateStmt = () =>
    db().prepare<[string, string, number, number]>(`
      UPDATE app_forms
      SET name = ?, schema_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND app_id = ?
    `);

  const publishStmt = () =>
    db().prepare<[number, number]>(`
      UPDATE app_forms
      SET status = 'published', version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND app_id = ?
    `);

  function insert(input: {
    appId: number;
    objectId: number;
    code: string;
    name: string;
    schemaJson: string;
    status: FormStatus;
    createdBy: string;
  }): FormRow {
    const result = insertStmt().run(
      input.appId,
      input.objectId,
      input.code,
      input.name,
      input.schemaJson,
      input.status,
      input.createdBy,
    );
    const id = Number(result.lastInsertRowid);
    const row = findByIdStmt().get(id, input.appId) as FormRow | undefined;
    if (!row) {
      throw new Error("app_forms insert 后查不到行（理论上不可能）");
    }
    return row;
  }

  function findById(id: number, appId: number): FormRow | null {
    const row = findByIdStmt().get(id, appId) as FormRow | undefined;
    return row ?? null;
  }

  function findByCode(code: string, appId: number, objectId: number): FormRow | null {
    const row = findByCodeStmt().get(appId, objectId, code) as FormRow | undefined;
    return row ?? null;
  }

  function list(appId: number): FormRow[] {
    return listStmt().all(appId) as FormRow[];
  }

  function update(
    id: number,
    appId: number,
    patch: UpdateFormPatch,
  ): FormRow | null {
    const current = findById(id, appId);
    if (!current) return null;
    const next = {
      name: patch.name ?? current.name,
      schema_json: patch.schemaJson ?? current.schema_json,
    };
    updateStmt().run(next.name, next.schema_json, id, appId);
    return findById(id, appId);
  }

  function publish(id: number, appId: number): FormRow | null {
    const current = findById(id, appId);
    if (!current) return null;
    publishStmt().run(id, appId);
    return findById(id, appId);
  }

  return {
    insert,
    findById,
    findByCode,
    list,
    update,
    publish,
  };
}

export type FormRepository = ReturnType<typeof createFormRepository>;

export const formRepository: FormRepository = {
  insert: (...args) => createFormRepository().insert(...args),
  findById: (...args) => createFormRepository().findById(...args),
  findByCode: (...args) => createFormRepository().findByCode(...args),
  list: (...args) => createFormRepository().list(...args),
  update: (...args) => createFormRepository().update(...args),
  publish: (...args) => createFormRepository().publish(...args),
};