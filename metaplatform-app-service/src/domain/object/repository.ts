/**
 * 对象（Object）领域层 —— 仓储
 * ────────────────────────────────────────────────────────────
 * 纯函数 + prepared statements。
 * 注意：app_id 是对象归属，跨 app 隔离由 Service 负责。
 *
 * 设计要点：repository 工厂每次调用 getDb()，不缓存 db 句柄，
 * 原因是测试中会 resetDb() 重置底层 SQLite 文件。
 */

import type Database from "better-sqlite3";
import { getDb } from "../../db/connection";
import type { ObjectRow, UpdateObjectInput } from "./entity";

function db(): Database.Database {
  return getDb();
}

export function createObjectRepository() {
  const insertStmt = () =>
    db().prepare<
      [number, string, string, string | null, string, string, string]
    >(`
      INSERT INTO app_objects
        (app_id, code, name, description, schema_json, data_table_name, version, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

  const findByIdStmt = () =>
    db().prepare<[number, number]>(`
      SELECT * FROM app_objects WHERE id = ? AND app_id = ?
    `);

  const findByCodeStmt = () =>
    db().prepare<[number, string]>(`
      SELECT * FROM app_objects WHERE app_id = ? AND code = ?
    `);

  const listStmt = () =>
    db().prepare<[number]>(`
      SELECT * FROM app_objects WHERE app_id = ? ORDER BY id ASC
    `);

  const updateStmt = () =>
    db().prepare<[string, string | null, string, number, number]>(`
      UPDATE app_objects
      SET name = ?, description = ?, schema_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND app_id = ?
    `);

  const deleteStmt = () =>
    db().prepare<[number, number]>(`
      DELETE FROM app_objects WHERE id = ? AND app_id = ?
    `);

  function insert(input: {
    appId: number;
    code: string;
    name: string;
    description: string | null;
    fields: unknown[];
    dataTableName: string;
    createdBy: string;
  }): ObjectRow {
    const schemaJson = JSON.stringify(input.fields);
    const result = insertStmt().run(
      input.appId,
      input.code,
      input.name,
      input.description,
      schemaJson,
      input.dataTableName,
      input.createdBy,
    );
    const id = Number(result.lastInsertRowid);
    const row = findByIdStmt().get(id, input.appId) as ObjectRow | undefined;
    if (!row) {
      throw new Error("app_objects insert 后查不到行（理论上不可能）");
    }
    return row;
  }

  function findById(id: number, appId: number): ObjectRow | null {
    const row = findByIdStmt().get(id, appId) as ObjectRow | undefined;
    return row ?? null;
  }

  function findByCode(code: string, appId: number): ObjectRow | null {
    const row = findByCodeStmt().get(appId, code) as ObjectRow | undefined;
    return row ?? null;
  }

  function list(appId: number): ObjectRow[] {
    return listStmt().all(appId) as ObjectRow[];
  }

  function update(
    id: number,
    appId: number,
    patch: UpdateObjectInput,
  ): ObjectRow | null {
    const current = findById(id, appId);
    if (!current) return null;
    const next = {
      name: patch.name ?? current.name,
      description: patch.description === undefined ? current.description : patch.description,
      // Sprint 1 禁止修改 fields（service 层负责 400 拦截）。这里如果真的传了 fields，
      // 仅当它是合法数组时才会重新序列化 schema_json。
      schema_json: Array.isArray(patch.fields)
        ? JSON.stringify(patch.fields)
        : current.schema_json,
    };
    updateStmt().run(next.name, next.description, next.schema_json, id, appId);
    return findById(id, appId);
  }

  function deleteById(id: number, appId: number): ObjectRow | null {
    const current = findById(id, appId);
    if (!current) return null;
    deleteStmt().run(id, appId);
    return current;
  }

  return {
    insert,
    findById,
    findByCode,
    list,
    update,
    deleteById,
  };
}

export type ObjectRepository = ReturnType<typeof createObjectRepository>;

export const objectRepository: ObjectRepository = {
  insert: (...args) => createObjectRepository().insert(...args),
  findById: (...args) => createObjectRepository().findById(...args),
  findByCode: (...args) => createObjectRepository().findByCode(...args),
  list: (...args) => createObjectRepository().list(...args),
  update: (...args) => createObjectRepository().update(...args),
  deleteById: (...args) => createObjectRepository().deleteById(...args),
};