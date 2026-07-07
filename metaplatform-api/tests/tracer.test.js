import { describe, it, expect } from "vitest";
import { withSpan, getTrace, listTraces, getStatus } from "../src/observability/tracer.js";
import { runWithContext } from "../src/observability/logger.js";

describe("tracer", () => {
  it("captures a span inside withSpan()", async () => {
    await runWithContext({ traceId: "tr-test-tracer" }, async () => {
      const result = await withSpan("test.op", async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 42;
      });
      expect(result).toBe(42);
      const trace = getTrace("tr-test-tracer");
      expect(trace).toBeDefined();
      expect(trace.spans.length).toBe(1);
      const span = trace.spans[0];
      expect(span.name).toBe("test.op");
      expect(span.durationMs).toBeGreaterThanOrEqual(10);
      expect(span.status).toBe("ok");
    });
    const trace = getTrace("tr-test-tracer");
    expect(trace.traceId).toBe("tr-test-tracer");
  });

  it("marks spans as error on throw", async () => {
    runWithContext({ traceId: "tr-error" }, async () => {
      await expect(
        withSpan("op.fail", async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      const trace = getTrace("tr-error");
      const span = trace.spans.find((s) => s.name === "op.fail");
      expect(span.status).toBe("error");
      expect(span.fields.error).toBe("boom");
    });
  });

  it("listTraces returns summary list", async () => {
    const list = listTraces({ limit: 10 });
    expect(Array.isArray(list)).toBe(true);
    // Each entry has traceId, startedAt, spanCount
    for (const t of list) {
      expect(t.traceId).toBeDefined();
      expect(typeof t.spanCount).toBe("number");
    }
  });

  it("exposes tracer status", () => {
    const s = getStatus();
    expect(typeof s.tracesInMemory).toBe("number");
  });
});