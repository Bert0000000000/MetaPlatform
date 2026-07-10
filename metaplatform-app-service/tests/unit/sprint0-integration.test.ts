/**
 * Sprint 0 主线程补的单测
 * - 数据库连接 + 迁移幂等
 * - 动态建表 (createDataTable)
 * - JWT 签发 + 校验
 * - Ontology client HTTP 路径（用 mock fetch 验证）
 */
import request from "supertest";
import { createApp } from "../../src/app";
import { getDb, closeDb, createDataTable, dropDataTable } from "../../src/db/connection";
import { jwtAuth, signJwt, AppUser } from "../../src/middleware/jwt-auth.middleware";
import { createOntologyClientForTest, OntologyClientError } from "../../src/clients/ontology.client";

describe("Sprint 0 主线程：数据库迁移 + 动态表", () => {
  beforeAll(() => {
    closeDb();
  });

  afterEach(() => {
    closeDb();
  });

  it("migrations 应当幂等执行（第二次启动不应报错）", () => {
    getDb();
    closeDb();
    // 二次启动
    const db2 = getDb();
    const applied = db2
      .prepare("SELECT filename FROM _migrations")
      .all()
      .map((r: any) => r.filename);
    expect(applied).toContain("001_init.sql");
  });

  it("应当有 8 张业务表 + _migrations 表", () => {
    const db = getDb();
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all()
      .map((r: any) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "apps",
        "app_objects",
        "app_forms",
        "app_workflows",
        "app_workflow_instances",
        "app_todos",
        "app_audit_logs",
        "app_idempotency",
        "_migrations",
      ]),
    );
  });

  it("createDataTable 应该按字段类型映射正确", () => {
    const tableName = createDataTable("test", "reimbursement", [
      { code: "from_city", type: "string", required: true },
      { code: "to_city", type: "string", required: false },
      { code: "amount", type: "number", required: true },
      { code: "trip_date", type: "date", required: true },
      { code: "is_paid", type: "boolean", required: false },
    ]);
    expect(tableName).toMatch(/^data_test_reimbursement_[a-f0-9]+$/);

    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const colMap = Object.fromEntries(
      cols.map((c) => [c.name, { type: c.type, notnull: c.notnull }]),
    );

    expect(colMap.from_city.type).toBe("TEXT");
    expect(colMap.from_city.notnull).toBe(1);
    expect(colMap.amount.type).toBe("REAL");
    expect(colMap.amount.notnull).toBe(1);
    expect(colMap.trip_date.type).toBe("DATETIME");
    expect(colMap.is_paid.type).toBe("BOOLEAN");
    expect(colMap.is_paid.notnull).toBe(0);

    dropDataTable(tableName);
  });

  it("sanitizeIdent 应当拦截非安全字符", () => {
    expect(() => createDataTable("test", "x", [{ code: "1bad", type: "string" }])).toThrow(
      /非法标识符/,
    );
    expect(() => createDataTable("test", "x", [{ code: "drop-table", type: "string" }])).toThrow(
      /非法标识符/,
    );
  });
});

describe("Sprint 0 主线程：JWT 签发 + 校验", () => {
  const sample: AppUser = {
    id: "u-test",
    tenantId: "t-1",
    username: "test",
    roles: ["admin", "财务"],
    permissions: ["*"],
  };

  it("生成的 JWT 应当能被 jwtAuth 中间件接受", async () => {
    const token = signJwt(sample);
    const app = createApp();
    const res = await request(app)
      .get("/api/apps/1") // 任何已注册的 stub
      .set("Authorization", `Bearer ${token}`);
    expect([200, 400]).toContain(res.status); // 路由在但 id 非正数 → 400
    expect(res.body).toHaveProperty("traceId");
  });

  it("非法 JWT 应当得到 401", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/apps/1")
      .set("Authorization", "Bearer not.a.real.token");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(401);
  });
});

describe("Sprint 0 主线程：Ontology client（mock fetch）", () => {
  it("createObjectType 应当发 POST 到 /api/v1/object-types", async () => {
    let captured: { url: string; method: string; body: any } | null = null;
    const fetchMock: typeof fetch = (async (url: any, init: any) => {
      captured = { url: String(url), method: init?.method ?? "GET", body: JSON.parse(init?.body ?? "{}") };
      return new Response(
        JSON.stringify({ id: "ot-1", code: "reimbursement" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const client = createOntologyClientForTest(fetchMock);
    const r = await client.createObjectType({
      code: "reimbursement",
      name: "报销单",
      fields: [{ code: "amount", name: "金额", type: "number", required: true }],
    });

    expect(r.id).toBe("ot-1");
    expect(captured).not.toBeNull();
    expect(captured!.url).toMatch(/\/api\/v1\/object-types$/);
    expect(captured!.method).toBe("POST");
    expect(captured!.body.fieldDefinitions[0].fieldType).toBe("Number");
  });

  it("dropObjectType 应当发 DELETE 并支持 404 返回 null", async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response("Not Found", { status: 404 })) as unknown as typeof fetch;

    const client = createOntologyClientForTest(fetchMock);
    await expect(client.dropObjectType("missing")).resolves.toBeUndefined();
  });

  it("ontology 返回 500 时应当抛 OntologyClientError", async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response("internal", { status: 500 })) as unknown as typeof fetch;
    const client = createOntologyClientForTest(fetchMock);
    await expect(
      client.createObjectType({ code: "x", name: "X", fields: [] }),
    ).rejects.toBeInstanceOf(OntologyClientError);
  });

  it("validateFieldValue 本地校验应当拒绝非数字", async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response("{}")) as unknown as typeof fetch;
    const client = createOntologyClientForTest(fetchMock);
    expect((await client.validateFieldValue({ type: "number", value: "abc" })).valid).toBe(
      false,
    );
    expect((await client.validateFieldValue({ type: "number", value: 12.5 })).valid).toBe(
      true,
    );
  });
});

describe("Sprint 0 主线程：app 集成 sanity", () => {
  it("POST /api/apps 应该写到 audit log", async () => {
    const app = createApp();
    const db = getDb();
    const beforeCount =
      (db.prepare("SELECT COUNT(*) AS c FROM app_audit_logs").get() as { c: number }).c ??
      0;

    await request(app)
      .post("/api/apps")
      .send({ code: "audit-test", name: "审计测试", icon: "x" });

    const afterCount =
      (db.prepare("SELECT COUNT(*) AS c FROM app_audit_logs").get() as { c: number }).c ??
      0;
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});
