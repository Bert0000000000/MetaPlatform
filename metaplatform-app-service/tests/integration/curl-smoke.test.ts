/**
 * Sprint 1 curl smoke —— 模拟任务文档要求的 curl 验证
 */
import request from "supertest";
import { createApp } from "../../src/app";
import { closeDb, resetDb, getDb } from "../../src/db/connection";

jest.mock("../../src/clients/ontology.client", () => ({
  ontologyClient: {
    createObjectType: jest.fn().mockResolvedValue({ id: "ot-smoke", code: "reimbursement" }),
    getObjectTypeByCode: jest.fn().mockResolvedValue(null),
    validateFieldValue: jest.fn().mockResolvedValue({ valid: true }),
  },
}));

let db: ReturnType<typeof getDb>;
const app = createApp();

beforeAll(() => {
  closeDb();
  resetDb();
  db = getDb();
});

afterAll(() => {
  closeDb();
});

describe("curl smoke —— 任务验收清单", () => {
  it("POST /api/apps {code:'travel'} → 201", async () => {
    const res = await request(app).post("/api/apps").send({ code: "travel", name: "差旅" });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeGreaterThan(0);
    expect(res.body.data.code).toBe("travel");
  });

  it("GET /api/apps → 包含 travel", async () => {
    const res = await request(app).get("/api/apps");
    expect(res.status).toBe(200);
    const codes = res.body.data.items.map((a: { code: string }) => a.code);
    expect(codes).toContain("travel");
  });

  it("POST /api/apps/1/objects → 201 含 data_travel_reimbursement_xxx", async () => {
    const res = await request(app)
      .post("/api/apps/1/objects")
      .send({
        code: "reimbursement",
        name: "报销单",
        fields: [
          { code: "amount", name: "金额", type: "number", required: true },
          { code: "remark", name: "备注", type: "string" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.dataTableName).toMatch(/^data_travel_reimbursement_/);
  });

  it("GET /api/apps/1/objects → 包含 reimbursement", async () => {
    const res = await request(app).get("/api/apps/1/objects");
    expect(res.status).toBe(200);
    const codes = res.body.data.items.map((o: { code: string }) => o.code);
    expect(codes).toContain("reimbursement");
  });

  it("DB 校验：apps + app_objects + data_travel_reimbursement_xxx 都存在", async () => {
    const appRow = db.prepare("SELECT id FROM apps WHERE code = ?").get("travel");
    expect(appRow).toBeTruthy();
    const objRow = db
      .prepare("SELECT data_table_name FROM app_objects WHERE code = ?")
      .get("reimbursement") as { data_table_name: string } | undefined;
    expect(objRow).toBeTruthy();
    const tbl = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(objRow!.data_table_name);
    expect(tbl).toBeTruthy();
  });

  it("重复 code POST → 409", async () => {
    const res = await request(app).post("/api/apps").send({ code: "travel", name: "重复" });
    expect(res.status).toBe(409);
  });
});