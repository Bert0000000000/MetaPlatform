/**
 * Sprint 1 主线程：apps 端点集成测试
 * ────────────────────────────────────────────────────────────
 * 覆盖：
 *   TC-M1-001  GET    /api/apps         → 200，列表
 *   TC-M1-002  POST   /api/apps         → 201，新建
 *   TC-M1-003  GET    /api/apps/:id     → 200，详情
 *   TC-M1-004  PUT    /api/apps/:id     → 200，更新
 *   TC-M1-005  DELETE /api/apps/:id     → 200，软删（status=archived）
 *   TC-M1-006  POST   重复 code         → 409
 *   TC-M1-007  GET    跨租户            → 404（数据隔离）
 *   TC-M1-008  POST   缺 code           → 400
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { closeDb, resetDb, getDb } from "../../src/db/connection";
import type Database from "better-sqlite3";

const app = createApp();
let db: Database.Database;

const TENANT_A = "t-A";
const TENANT_B = "t-B";
const USER_A = "u-A";
const USER_B = "u-B";

// ── helper：在 dev 模式下 jwtAuth() 自动注入 dev-user（tenantId='t-dev'）
//    但我们的测试场景需要多租户，所以我们这里直接打 req.user.tenantId 的 dev 模式
//    由于 jwtAuth 的 dev 默认 userId=dev-user / tenantId=t-dev，这里不能跨租户
//    用 mock 中间件的方法替换更合适。

// 实际上在 dev 模式下，jwtAuth 自动注入 dev-user。我们需要替换中间件或换一种方式
// 跑跨租户用例：直接调 service。

beforeAll(() => {
  closeDb();
  resetDb();
  db = getDb();
});

afterAll(() => {
  closeDb();
});

describe("Sprint 1 apps — list / create / get / update / archive", () => {
  it("TC-M1-001: GET /api/apps 初始为空", async () => {
    const res = await request(app).get("/api/apps").expect(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("TC-M1-002: POST /api/apps → 201 返回 id + status=active", async () => {
    const res = await request(app)
      .post("/api/apps")
      .send({ code: "travel", name: "差旅" })
      .expect(201);
    expect(res.body.data.id).toBeGreaterThan(0);
    expect(res.body.data.code).toBe("travel");
    expect(res.body.data.status).toBe("active");
    expect(res.body.data.version).toBe(1);
    expect(typeof res.body.data.createdAt).toBe("string");
    expect(res.body.data.createdAt).toMatch(/T.*Z/);

    // DB 落表校验
    const row = db
      .prepare("SELECT id, code, name, status FROM apps WHERE code = ?")
      .get("travel") as { id: number; status: string };
    expect(row.status).toBe("active");
  });

  it("TC-M1-006: POST /api/apps 重复 code → 409", async () => {
    await request(app)
      .post("/api/apps")
      .send({ code: "travel", name: "重复" })
      .expect(409);
  });

  it("TC-M1-008: POST /api/apps 缺 name → 400", async () => {
    const res = await request(app)
      .post("/api/apps")
      .send({ code: "no_name" })
      .expect(400);
    expect(res.body.message).toMatch(/name/);
  });

  it("POST /api/apps code 非法（含大写） → 400", async () => {
    const res = await request(app)
      .post("/api/apps")
      .send({ code: "Invalid-Code", name: "valid" })
      .expect(400);
    expect(res.body.message).toMatch(/code/);
  });

  it("TC-M1-003: GET /api/apps/:id → 200", async () => {
    const created = await request(app)
      .post("/api/apps")
      .send({ code: "hr", name: "人事" });
    const id = created.body.data.id;
    const res = await request(app).get(`/api/apps/${id}`).expect(200);
    expect(res.body.data.code).toBe("hr");
    expect(res.body.data.name).toBe("人事");
  });

  it("TC-M1-007: GET /api/apps/:id 跨租户 → 404（service 层数据隔离）", async () => {
    // 直接调 service 模拟跨租户（因为 jwtAuth dev 模式强制 tenantId='t-dev'）
    const { appService } = await import("../../src/domain/app/service");
    expect(() => appService.get(1, TENANT_B)).toThrow();
    try {
      appService.get(1, TENANT_B);
    } catch (err) {
      const status = (err as { status?: number }).status;
      expect(status).toBe(404);
    }
  });

  it("TC-M1-004: PUT /api/apps/:id → 200 + version+1", async () => {
    const created = await request(app)
      .post("/api/apps")
      .send({ code: "ops", name: "运维" });
    const { id, version } = created.body.data;
    const res = await request(app)
      .put(`/api/apps/${id}`)
      .send({ name: "运维 v2", version })
      .expect(200);
    expect(res.body.data.name).toBe("运维 v2");
    expect(res.body.data.version).toBe(version + 1);
  });

  it("PUT /api/apps/:id 乐观锁冲突 → 409", async () => {
    const created = await request(app)
      .post("/api/apps")
      .send({ code: "lock", name: "lock-test" });
    const id = created.body.data.id;
    await request(app)
      .put(`/api/apps/${id}`)
      .send({ name: "first", version: created.body.data.version })
      .expect(200);
    // 第二次传同一个 version 应当冲突
    await request(app)
      .put(`/api/apps/${id}`)
      .send({ name: "second", version: created.body.data.version })
      .expect(409);
  });

  it("PUT /api/apps/:id 缺 version → 400", async () => {
    const created = await request(app)
      .post("/api/apps")
      .send({ code: "noversion", name: "no-ver" });
    const id = created.body.data.id;
    await request(app)
      .put(`/api/apps/${id}`)
      .send({ name: "x" })
      .expect(400);
  });

  it("TC-M1-005: DELETE /api/apps/:id → 200，软删 status=archived", async () => {
    const created = await request(app)
      .post("/api/apps")
      .send({ code: "del_me", name: "删除我" });
    const id = created.body.data.id;

    await request(app).delete(`/api/apps/${id}`).expect(200);

    // GET 仍能查到，但 status 变 archived
    const res = await request(app).get(`/api/apps/${id}`).expect(200);
    expect(res.body.data.status).toBe("archived");

    // 默认 list 不再返回 archived
    const list = await request(app).get("/api/apps").expect(200);
    const ids = list.body.data.items.map((a: { id: number }) => a.id);
    expect(ids).not.toContain(id);

    // includeArchived=true 时能再看到
    const listAll = await request(app)
      .get("/api/apps?includeArchived=true")
      .expect(200);
    const idsAll = listAll.body.data.items.map((a: { id: number }) => a.id);
    expect(idsAll).toContain(id);
  });

  it("GET /api/apps/:id 不存在 → 404", async () => {
    await request(app).get("/api/apps/999999").expect(404);
  });

  it("GET /api/apps/abc 非数字 → 400", async () => {
    await request(app).get("/api/apps/abc").expect(400);
  });
});

describe("Sprint 1 apps — 数据隔离 service 层（绕过 HTTP dev 中间件）", () => {
  it("create 同一 code 跨租户不算冲突", async () => {
    const { appService } = await import("../../src/domain/app/service");
    const a = appService.create(TENANT_A, { code: "shared", name: "A 应用", createdBy: USER_A });
    const b = appService.create(TENANT_B, { code: "shared", name: "B 应用", createdBy: USER_B });
    expect(a.tenantId).toBe(TENANT_A);
    expect(b.tenantId).toBe(TENANT_B);
    expect(a.id).not.toBe(b.id);
  });

  it("A 不能 get B 的应用 → 404", async () => {
    const { appService } = await import("../../src/domain/app/service");
    const b = appService.create(TENANT_B, { code: "only_b", name: "仅 B", createdBy: USER_B });
    expect(() => appService.get(b.id, TENANT_A)).toThrow();
    try {
      appService.get(b.id, TENANT_A);
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });

  it("A 不能 archive B 的应用 → 404", async () => {
    const { appService } = await import("../../src/domain/app/service");
    const b = appService.create(TENANT_B, { code: "b_app", name: "B App", createdBy: USER_B });
    expect(() => appService.archive(b.id, TENANT_A)).toThrow();
  });

  it("list 仅返回当前 tenant 的应用", async () => {
    const { appService } = await import("../../src/domain/app/service");
    appService.create(TENANT_A, { code: "a1", name: "A1", createdBy: USER_A });
    appService.create(TENANT_A, { code: "a2", name: "A2", createdBy: USER_A });
    appService.create(TENANT_B, { code: "b1", name: "B1", createdBy: USER_B });

    const listA = appService.list({ tenantId: TENANT_A });
    const listB = appService.list({ tenantId: TENANT_B });

    expect(listA.items.every((a) => a.tenantId === TENANT_A)).toBe(true);
    expect(listB.items.every((a) => a.tenantId === TENANT_B)).toBe(true);
    expect(listA.items.length).toBeGreaterThanOrEqual(2);
    expect(listB.items.length).toBeGreaterThanOrEqual(1);
  });
});