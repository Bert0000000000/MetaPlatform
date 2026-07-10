/**
 * Sprint 1 主线程：objects 端点集成测试
 * ────────────────────────────────────────────────────────────
 * 覆盖：
 *   - create（含 ontology mock、动态建表、元数据落库、跨租户隔离）
 *   - list / get / update / delete
 *   - 重复 code → 409
 *   - 非法字段类型 → 400
 *   - 改 fields → 400
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { closeDb, resetDb, getDb } from "../../src/db/connection";
import type Database from "better-sqlite3";
import { appService } from "../../src/domain/app/service";

// ── 关键：mock ontology-client，测试环境不依赖真实 ontology-engine ──
jest.mock("../../src/clients/ontology.client", () => ({
  ontologyClient: {
    createObjectType: jest.fn().mockResolvedValue({ id: "ot-mock-1", code: "reimbursement" }),
    getObjectTypeByCode: jest.fn().mockResolvedValue(null),
    validateFieldValue: jest.fn().mockResolvedValue({ valid: true }),
  },
}));

const app = createApp();
let db: Database.Database;

const TENANT_A = "t-A";
const TENANT_B = "t-B";
const DEV_TENANT = "default"; // 与 jwtAuth dev 模式注入的 tenantId 对齐

beforeAll(() => {
  closeDb();
  resetDb();
  db = getDb();
});

afterAll(() => {
  closeDb();
});

// ── helpers ───────────────────────────────────────────────
// HTTP 请求走 jwtAuth dev 中间件，会自动注入 tenantId='t-dev'。
// 所以走 HTTP 创建的应用必须用 DEV_TENANT；service 层可直接传任意 tenantId。
// 为了统一 HTTP 与 service 测试，所有走 HTTP 的应用都用 DEV_TENANT。

async function createAppInDb(tenantId: string, code: string, name: string): Promise<number> {
  const created = appService.create(tenantId, { code, name, createdBy: "tester" });
  return created.id;
}

const validFields = [
  { code: "amount", name: "金额", type: "number", required: true },
  { code: "remark", name: "备注", type: "string" },
  { code: "happened_at", name: "发生时间", type: "datetime" },
  { code: "category", name: "类别", type: "enum", options: [{ value: "travel", label: "差旅" }] },
  { code: "active", name: "激活", type: "boolean" },
];

// ── tests ────────────────────────────────────────────────

describe("Sprint 1 objects — create / list / get / update / delete", () => {
  let appId = 0;

  beforeAll(async () => {
    appId = await createAppInDb(DEV_TENANT, "travel", "差旅");
  });

  it("POST /api/apps/:id/objects → 201（含 ontology mock + 动态建表）", async () => {
    const res = await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "reimbursement",
        name: "报销单",
        fields: validFields,
      })
      .expect(201);

    expect(res.body.data.id).toBeGreaterThan(0);
    expect(res.body.data.code).toBe("reimbursement");
    expect(res.body.data.dataTableName).toMatch(/^data_travel_reimbursement_/);
    expect(res.body.data.fields.length).toBe(validFields.length);

    // 元数据落库校验
    const row = db
      .prepare("SELECT code, name, data_table_name, schema_json FROM app_objects WHERE id = ?")
      .get(res.body.data.id) as { code: string; data_table_name: string; schema_json: string };
    expect(row.code).toBe("reimbursement");
    expect(row.data_table_name).toBe(res.body.data.dataTableName);
    expect(JSON.parse(row.schema_json).length).toBe(validFields.length);

    // 物理表已建：尝试 SELECT 1 不报错
    const physicalTable = row.data_table_name;
    const tbl = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(physicalTable) as { name: string } | undefined;
    expect(tbl?.name).toBe(physicalTable);
  });

  it("POST 重复 code → 409", async () => {
    await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "reimbursement",
        name: "报销单 v2",
        fields: validFields,
      })
      .expect(409);
  });

  it("POST 缺 fields → 400", async () => {
    await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "no_fields",
        name: "无 fields",
      })
      .expect(400);
  });

  it("POST fields 非数组 → 400", async () => {
    await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "bad_fields",
        name: "坏 fields",
        fields: "string",
      })
      .expect(400);
  });

  it("POST 非法字段类型 → 400", async () => {
    const res = await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "bad_type",
        name: "坏类型",
        fields: [{ code: "f", name: "F", type: "binary_blob" }],
      })
      .expect(400);
    expect(res.body.message).toMatch(/type/);
  });

  it("POST 字段 code 重复 → 400", async () => {
    await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "dup_field",
        name: "字段重复",
        fields: [
          { code: "f1", name: "F1", type: "string" },
          { code: "f1", name: "F2", type: "number" },
        ],
      })
      .expect(400);
  });

  it("POST 字段超过上限 → 400", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      code: `f${i}`,
      name: `F${i}`,
      type: "string",
    }));
    await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "too_many",
        name: "字段过多",
        fields: many,
      })
      .expect(400);
  });

  it("GET /api/apps/:id/objects → 200 含已建对象", async () => {
    const res = await request(app).get(`/api/apps/${appId}/objects`).expect(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    const codes = res.body.data.items.map((o: { code: string }) => o.code);
    expect(codes).toContain("reimbursement");
  });

  it("GET /api/apps/:id/objects/:oid → 200 详情", async () => {
    const list = await request(app).get(`/api/apps/${appId}/objects`).expect(200);
    const oid = list.body.data.items[0].id as number;
    const res = await request(app).get(`/api/apps/${appId}/objects/${oid}`).expect(200);
    expect(res.body.data.code).toBe("reimbursement");
    expect(res.body.data.fields.length).toBeGreaterThan(0);
  });

  it("PUT 改 name → 200", async () => {
    const list = await request(app).get(`/api/apps/${appId}/objects`).expect(200);
    const oid = list.body.data.items[0].id as number;
    const res = await request(app)
      .put(`/api/apps/${appId}/objects/${oid}`)
      .send({ name: "报销单 v2" })
      .expect(200);
    expect(res.body.data.name).toBe("报销单 v2");
  });

  it("PUT 改 fields → 400（AC-103.5）", async () => {
    const list = await request(app).get(`/api/apps/${appId}/objects`).expect(200);
    const oid = list.body.data.items[0].id as number;
    await request(app)
      .put(`/api/apps/${appId}/objects/${oid}`)
      .send({ fields: [{ code: "x", name: "X", type: "string" }] })
      .expect(400);
  });

  it("DELETE 对象 → 200 + 物理表 drop + 行删除", async () => {
    // 先建一个临时对象用于删除
    const created = await request(app)
      .post(`/api/apps/${appId}/objects`)
      .send({
        code: "tmp_obj",
        name: "临时对象",
        fields: [{ code: "x", name: "X", type: "string" }],
      })
      .expect(201);
    const oid = created.body.data.id;
    const dataTableName = created.body.data.dataTableName;

    await request(app).delete(`/api/apps/${appId}/objects/${oid}`).expect(200);

    // 行已删除
    const row = db.prepare("SELECT id FROM app_objects WHERE id = ?").get(oid);
    expect(row).toBeUndefined();
    // 物理表已 drop
    const tbl = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(dataTableName);
    expect(tbl).toBeUndefined();
  });

  it("GET 不存在对象 → 404", async () => {
    await request(app).get(`/api/apps/${appId}/objects/99999`).expect(404);
  });

  it("POST /api/apps/:id/objects 跨租户 app → 404", async () => {
    await request(app)
      .post(`/api/apps/9999/objects`)
      .send({
        code: "cross_t",
        name: "X",
        fields: [{ code: "f", name: "F", type: "string" }],
      })
      .expect(404);
  });
});

describe("Sprint 1 objects — 跨租户隔离（service 层）", () => {
  it("B 看不到 A 的对象", async () => {
    // A 创建一个 app + object
    const appId = appService.create(TENANT_A, { code: "ta_app", name: "A's app", createdBy: "x" }).id;
    const { objectService } = await import("../../src/domain/object/service");
    await objectService.create(appId, TENANT_A, {
      code: "ta_obj",
      name: "A 的对象",
      fields: [{ code: "f", name: "F", type: "string" }],
      createdBy: "x",
    });

    // B 拿到 A 的 app id 也查不到（B 不能访问 A 的 app）
    expect(() => objectService.list(appId, TENANT_B)).toThrow();
    try {
      objectService.list(appId, TENANT_B);
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});