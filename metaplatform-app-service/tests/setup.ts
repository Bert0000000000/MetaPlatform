/**
 * Jest global setup —— Sprint 1 主线程落地
 * ────────────────────────────────────────────────────────────
 * 目的：
 *  - 跑每个测试文件前清理 DB，避免上一次测试残留的 apps / app_objects / app_forms 等数据影响断言
 *  - better-sqlite3 是单进程单连接，跨测试文件 reset 必须 close + unlink + 重新打开
 *  - 公共方法：resetDb()（见 src/db/connection.ts）
 */
import { closeDb, resetDb, getDb } from "../src/db/connection";

beforeAll(() => {
  // 关闭当前连接 + 删 db 文件 + 重建（迁移脚本会自动跑）
  closeDb();
  resetDb();
  // 触发一次 getDb() 让迁移跑完
  getDb();
});

afterAll(() => {
  closeDb();
});