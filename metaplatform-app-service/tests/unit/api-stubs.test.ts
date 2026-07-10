/**
 * Sprint 0 全 API stub 烟囱测试
 * ────────────────────────────────────────────────────────────
 * 用 supertest 跑一遍 18 个端点 + 健康检查，确保：
 *  1. 路由可达；
 *  2. 响应包格式符合 05-architecture.md §5.3；
 *  3. 入参校验能命中（坏 path id 应当 400）。
 *
 * 每个用例不深度检查返回 data 的内容（那是 Sprint 1+ 的事）。
 */
import request from "supertest";
import { createApp } from "../../src/app";

const app = createApp();

interface ApiCase {
  name: string;
  method: "get" | "post" | "put" | "delete";
  url: string;
  body?: unknown;
  expect: number;
}

const cases: ApiCase[] = [
  // 健康检查
  { name: "GET /health", method: "get", url: "/health", expect: 200 },

  // 应用
  { name: "GET /api/apps", method: "get", url: "/api/apps", expect: 200 },
  {
    name: "POST /api/apps (ok)",
    method: "post",
    url: "/api/apps",
    body: { code: "demo", name: "demo app" },
    expect: 201,
  },
  { name: "GET /api/apps/:id", method: "get", url: "/api/apps/1", expect: 200 },
  {
    name: "PUT /api/apps/:id",
    method: "put",
    url: "/api/apps/1",
    body: { name: "renamed" },
    expect: 200,
  },
  { name: "DELETE /api/apps/:id", method: "delete", url: "/api/apps/1", expect: 200 },

  // 对象
  { name: "GET objects", method: "get", url: "/api/apps/1/objects", expect: 200 },
  {
    name: "POST objects (ok)",
    method: "post",
    url: "/api/apps/1/objects",
    body: { code: "reimbursement", name: "报销单", fields: [] },
    expect: 201,
  },
  { name: "GET object detail", method: "get", url: "/api/apps/1/objects/11", expect: 200 },
  {
    name: "PUT object",
    method: "put",
    url: "/api/apps/1/objects/11",
    body: { name: "newname" },
    expect: 200,
  },
  { name: "DELETE object", method: "delete", url: "/api/apps/1/objects/11", expect: 200 },

  // 表单
  { name: "GET forms", method: "get", url: "/api/apps/1/forms", expect: 200 },
  {
    name: "POST form (ok)",
    method: "post",
    url: "/api/apps/1/forms",
    body: { objectId: 11, code: "rf", name: "报销表单", schema: { version: 1, widgets: [] } },
    expect: 201,
  },
  { name: "GET form detail", method: "get", url: "/api/apps/1/forms/21", expect: 200 },
  {
    name: "PUT form",
    method: "put",
    url: "/api/apps/1/forms/21",
    body: { name: "newname" },
    expect: 200,
  },
  { name: "POST publish", method: "post", url: "/api/apps/1/forms/21/publish", expect: 200 },

  // 提交 + 列表
  {
    name: "POST submit (ok)",
    method: "post",
    url: "/api/apps/1/forms/21/submit",
    body: { data: { amount: 100 } },
    expect: 201,
  },
  { name: "GET list", method: "get", url: "/api/apps/1/forms/21/list", expect: 200 },
  { name: "GET csv", method: "get", url: "/api/apps/1/forms/21/csv", expect: 200, rawCsv: true },

  // 流程
  {
    name: "POST workflow (ok)",
    method: "post",
    url: "/api/apps/1/forms/21/workflow",
    body: { code: "wf1", name: "流程1", nodes: [{ id: "s", type: "start" }], edges: [] },
    expect: 201,
  },
  { name: "GET workflow", method: "get", url: "/api/apps/1/forms/21/workflow", expect: 200 },

  // 审批
  {
    name: "POST approve",
    method: "post",
    url: "/api/workflow/instances/4001/approve",
    body: { comment: "ok" },
    expect: 200,
  },
  {
    name: "POST reject (comment required)",
    method: "post",
    url: "/api/workflow/instances/4001/reject",
    body: {},
    expect: 400,
  },

  // 待办
  { name: "GET todos", method: "get", url: "/api/todos", expect: 200 },
];

describe("Sprint 0 API stubs — happy paths", () => {
  for (const c of cases) {
    it(c.name, async () => {
      let res: request.Response;
      switch (c.method) {
        case "get":
          res = await request(app).get(c.url);
          break;
        case "post":
          res = await request(app).post(c.url).send(c.body ?? {});
          break;
        case "put":
          res = await request(app).put(c.url).send(c.body ?? {});
          break;
        case "delete":
          res = await request(app).delete(c.url);
          break;
      }
      expect(res.status).toBe(c.expect);
      if ((c as ApiCase & { rawCsv?: boolean }).rawCsv) {
        // CSV 走 text/csv，跳过 envelope 校验，只校验 content-type + body 包含 csv
        expect(res.headers["content-type"]).toMatch(/text\/csv/);
        expect(typeof res.text).toBe("string");
        expect(res.text).toMatch(/^app_id,form_id,trace_id/);
      } else if (c.expect < 400) {
        expect(typeof res.body).toBe("object");
        expect(res.body.code).toBe(0);
        expect(typeof res.body.traceId).toBe("string");
      } else {
        expect(res.body.code).toBe(c.expect);
        expect(typeof res.body.message).toBe("string");
      }
    });
  }
});

describe("Sprint 0 API stubs — parameter validation", () => {
  it("rejects non-numeric app id with 400", async () => {
    const res = await request(app).get("/api/apps/abc").expect(400);
    expect(res.body.message).toMatch(/正整数/);
  });

  it("rejects missing required field on POST /api/apps", async () => {
    const res = await request(app).post("/api/apps").send({ code: "x" }).expect(400);
    expect(res.body.message).toMatch(/name/);
  });

  it("rejects non-array fields on POST objects", async () => {
    const res = await request(app)
      .post("/api/apps/1/objects")
      .send({ code: "x", name: "y", fields: "not-an-array" })
      .expect(400);
    expect(res.body.message).toMatch(/fields/);
  });
});
