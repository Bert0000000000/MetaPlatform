/**
 * metaplatform-app-service 数据库连接（Sprint 0 主线程完成）
 * ────────────────────────────────────────────────────────────
 * 使用 better-sqlite3 + 单连接 + WAL 模式
 * - 自动执行迁移脚本
 * - 暴露 getDb() 给业务层
 * - 提供 createDataTable() 给对象创建时动态建表
 */
import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { config } from "../config";

// 单例 DB 句柄
let _db: Database.Database | null = null;

/**
 * 取得 SQLite 连接（首次调用会建库 + 迁移）
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  // 确保 db 文件所在目录存在（better-sqlite3 不会自动创建）
  try {
    mkdirSync(dirname(config.dbFile), { recursive: true });
  } catch {
    // 忽略 "目录已存在" 等错误
  }

  _db = new Database(config.dbFile);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("synchronous = NORMAL");

  runMigrations(_db);
  return _db;
}

/**
 * 运行所有 SQL 迁移文件（001_init.sql ...）
 * 用 _migrations 表记录已执行过的脚本
 */
function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = join(process.cwd(), "src", "db", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db.prepare("SELECT filename FROM _migrations").all().map((r: any) => r.filename),
  );

  const insertMigration = db.prepare("INSERT INTO _migrations (filename) VALUES (?)");

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    db.exec(sql); // better-sqlite3 同步执行
    insertMigration.run(file);
    console.log(`[migrate] ${file} applied`);
  }
}

/**
 * 关闭数据库连接（用于测试）
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * 为对象创建物理数据表（v1.0.1 主线程调整点：原设计 ontology-engine 建，
 * 实际改为 app-service 自己建，详见 001_init.sql 末尾 ARCHITECTURE_NOTE）
 *
 * @returns 数据表名
 */
export function createDataTable(
  appCode: string,
  objectCode: string,
  fields: Array<{ code: string; type: string; required?: boolean }>,
): string {
  const db = getDb();
  const hash = createHash("sha1")
    .update(`${appCode}/${objectCode}/${Date.now()}`)
    .digest("hex")
    .slice(0, 8);
  const tableName = `data_${appCode}_${objectCode}_${hash}`.replace(/[^a-z0-9_]/gi, "_");

  // 字段映射（v1.0.1 支持 6 种）
  const sqlFields = fields
    .map((f) => {
      const colType =
        f.type === "number"
          ? "REAL"
          : f.type === "date"
            ? "DATETIME"
            : f.type === "boolean"
              ? "BOOLEAN"
              : "TEXT";
      const nullable = f.required ? "NOT NULL" : "NULL";
      return `"${sanitizeIdent(f.code)}" ${colType} ${nullable}`;
    })
    .join(", ");

  const ddl = `CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ${sqlFields}
  );`;

  db.exec(ddl);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at);`);
  return tableName;
}

/**
 * 删除数据表（对象删除时级联调用）
 */
export function dropDataTable(tableName: string): void {
  const db = getDb();
  if (!/^data_[a-z0-9_]+$/i.test(tableName)) {
    throw new Error(`非法表名：${tableName}`);
  }
  db.exec(`DROP TABLE IF EXISTS ${tableName};`);
}

/**
 * 把字段 code 转成安全 SQL 标识符
 */
export function sanitizeIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`非法标识符：${name}`);
  }
  return name;
}

/**
 * 测试用：重置数据库
 */
export function resetDb(): void {
  closeDb();
  try {
    require("node:fs").unlinkSync(config.dbFile);
  } catch {
    // 文件不存在则忽略
  }
}
