/**
 * Sprint 0 健康检查单测
 * ────────────────────────────────────────────────────────────
 * 任务要求：测试 GET /health 返回 { status: 'ok', version: 'v1.0.1-sprint0' }
 * 配套文档：docs/v1.0.x/v1.0.1/02-sprint-plan.md §一 Sprint 0 DoD
 */
import request from "supertest";
import { createApp } from "../../src/app";

describe("GET /health (Sprint 0 smoke test)", () => {
  const app = createApp();

  it("should return 200 with status ok and v1.0.1-sprint0 version", async () => {
    const res = await request(app).get("/health").expect(200);

    expect(res.body).toMatchObject({
      code: 0,
      data: {
        status: "ok",
        version: "v1.0.1-sprint0",
      },
    });
    // traceId 由 ok() 写入
    expect(typeof res.body.traceId).toBe("string");
    expect(res.body.traceId.length).toBeGreaterThan(0);
  });

  it("should propagate incoming x-trace-id header if provided", async () => {
    const customTrace = "test-trace-12345";
    const res = await request(app)
      .get("/health")
      .set("x-trace-id", customTrace)
      .expect(200);

    expect(res.body.traceId).toBe(customTrace);
  });
});
