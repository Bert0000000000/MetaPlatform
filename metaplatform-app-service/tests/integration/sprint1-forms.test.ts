/**
 * Sprint 1 主线程：forms 端点集成测试
 * ────────────────────────────────────────────────────────────
 * 覆盖：
 *   - create（含 schema 落库 + objectId 归属校验）
 *   - list / get / update
 *   - publish（draft → published + version+1）
 *   - 重复 code → 409
 *   - 不存在 object → 404
 *   - 跨租户 → 404
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { closeDb, resetDb, getDb } from "../../src/db/connection";
import type Database from "better-sqlite3";
import { appService } from "../../src/domain/app/service";
import { objectService } from "../../src/domain/object/service";

// mock ontology 避免依赖真实服务
jest.mock("../../src/clients/ontology.client", () => ({
  ontologyClient: {
    createObjectType: jest.fn().mockResolvedValue({ id: "ot-mock-1", code: "x" }),
    getObjectTypeByCode: jest.fn().mockResolvedValue(null),
    validateFieldValue: jest.fn().mockResolvedValue({ valid: true }),
  },
}));

const app = createApp();
let db: Database.Database;
const DEV_TENANT = "default";
const TENANT_B = "t-B";

beforeAll(() => {
  closeDb();
  resetDb();
  db = getDb();
});

afterAll(() => {
  closeDb();
});

// 准备一个 dev 租户下的 app + object 供 form 使用
let appId = 0;
let objectId = 0;

beforeAll(async () => {
  const a = appService.create(DEV_TENANT, { code: "travel", name: "差旅", createdBy: "tester" });
  appId = a.id;
  const obj = await objectService.create(appId, DEV_TENANT, {
    code: "reimbursement",
    name: "报销单",
    fields: [{ code: "amount", name: "金额", type: "number", required: true }],
    createdBy: "tester",
  });
  objectId = obj.id;
});

const validSchema = {
  version: 1,
  widgets: [
    { field: "amount", type: "NumberInput", required: true, label: "金额" },
  ],
};

describe("Sprint 1 forms — CRUD + publish", () => {
  let formId = 0;

  it("POST /api/apps/:id/forms → 201", async () => {
    const res = await request(app)
      .post(`/api/apps/${appId}/forms`)
      .send({
        objectId,
        code: "rf_default",
        name: "报销表单",
        schema: validSchema,
      })
      .expect(201);

    expect(res.body.data.id).toBeGreaterThan(0);
    expect(res.body.data.code).toBe("rf_default");
    expect(res.body.data.objectId).toBe(objectId);
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.schema).toEqual(validSchema);
    expect(res.body.data.version).toBe(1);

    // DB schema_json 已落库
    const row = db
      .prepare("SELECT schema_json, status FROM app_forms WHERE id = ?")
      .get(res.body.data.id) as { schema_json: string; status: string };
    expect(JSON.parse(row.schema_json)).toEqual(validSchema);
    expect(row.status).toBe("draft");

    formId = res.body.data.id;
  });

  it("POST 重复 code → 409", async () => {
    await request(app)
      .post(`/api/apps/${appId}/forms`)
      .send({
        objectId,
        code: "rf_default",
        name: "重复",
        schema: validSchema,
      })
      .expect(409);
  });

  it("POST objectId 不存在 → 404", async () => {
    await request(app)
      .post(`/api/apps/${appId}/forms`)
      .send({
        objectId: 9999,
        code: "rf_bad_obj",
        name: "X坏对象",
        schema: validSchema,
      })
      .expect(404);
  });

  it("POST app 不存在 → 404", async () => {
    await request(app)
      .post(`/api/apps/9999/forms`)
      .send({
        objectId,
        code: "rf_bad_app",
        name: "X坏应用",
        schema: validSchema,
      })
      .expect(404);
  });

  it("POST 缺 schema → 400", async () => {
    await request(app)
      .post(`/api/apps/${appId}/forms`)
      .send({
        objectId,
        code: "rf_no_schema",
        name: "无 schema",
      })
      .expect(400);
  });

  it("POST schema 非对象 → 400", async () => {
    await request(app)
      .post(`/api/apps/${appId}/forms`)
      .send({
        objectId,
        code: "rf_array",
        name: "schema 数组",
        schema: [],
      })
      .expect(400);
  });

  it("GET /api/apps/:id/forms → 200 含已建表单", async () => {
    const res = await request(app).get(`/api/apps/${appId}/forms`).expect(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    const codes = res.body.data.items.map((f: { code: string }) => f.code);
    expect(codes).toContain("rf_default");
  });

  it("GET /api/apps/:id/forms/:fid → 200 详情", async () => {
    const res = await request(app).get(`/api/apps/${appId}/forms/${formId}`).expect(200);
    expect(res.body.data.code).toBe("rf_default");
    expect(res.body.data.schema).toEqual(validSchema);
  });

  it("PUT 更新 name → 200", async () => {
    const res = await request(app)
      .put(`/api/apps/${appId}/forms/${formId}`)
      .send({ name: "差旅表单 v2" })
      .expect(200);
    expect(res.body.data.name).toBe("差旅表单 v2");
    expect(res.body.data.version).toBeGreaterThan(1);
  });

  it("PUT 更新 schema → 200", async () => {
    const newSchema = {
      version: 2,
      widgets: [{ field: "amount", type: "NumberInput", required: true, label: "金额 v2" }],
    };
    const res = await request(app)
      .put(`/api/apps/${appId}/forms/${formId}`)
      .send({ schema: newSchema })
      .expect(200);
    expect(res.body.data.schema).toEqual(newSchema);
  });

  it("PUT 空 patch → 400", async () => {
    await request(app)
      .put(`/api/apps/${appId}/forms/${formId}`)
      .send({})
      .expect(400);
  });

  it("POST publish → 200 状态变 published + version+1", async () => {
    const before = await request(app).get(`/api/apps/${appId}/forms/${formId}`).expect(200);
    const res = await request(app)
      .post(`/api/apps/${appId}/forms/${formId}/publish`)
      .expect(200);
    expect(res.body.data.status).toBe("published");
    expect(res.body.data.version).toBe(before.body.data.version + 1);
    expect(typeof res.body.data.publishedAt).toBe("string");

    // DB 已变更
    const row = db
      .prepare("SELECT status, version FROM app_forms WHERE id = ?")
      .get(formId) as { status: string; version: number };
    expect(row.status).toBe("published");
    expect(row.version).toBe(before.body.data.version + 1);
  });

  it("publish 幂等：再次 publish 应当 200 不报错", async () => {
    await request(app)
      .post(`/api/apps/${appId}/forms/${formId}/publish`)
      .expect(200);
  });

  it("GET 不存在的表单 → 404", async () => {
    await request(app).get(`/api/apps/${appId}/forms/9999`).expect(404);
  });
});

describe("Sprint 1 forms — 跨租户隔离", () => {
  it("B 看不到 A 的表单（service 层）", async () => {
    const { formService } = await import("../../src/domain/form/service");
    expect(() => formService.list(appId, TENANT_B)).toThrow();
    try {
      formService.list(appId, TENANT_B);
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});