import { describe, it, expect } from "vitest";
import { logger, getRecentLogs, getStatus, runWithContext } from "../src/observability/logger.js";

describe("logger", () => {
  it("emits JSON-line format with required fields", () => {
    const before = getRecentLogs({ limit: 100 }).length;
    logger.info("test.event", { foo: "bar", n: 42 });
    const after = getRecentLogs({ limit: 100 }).length;
    expect(after).toBeGreaterThan(before);

    const logs = getRecentLogs({ limit: 1 });
    const last = logs[logs.length - 1];
    expect(last.level).toBe("info");
    expect(last.msg).toBe("test.event");
    expect(last.foo).toBe("bar");
    expect(last.n).toBe(42);
    expect(last.ts).toBeDefined();
    expect(last.service).toBe("metaplatform-api");
  });

  it("supports AsyncLocalStorage context propagation", () => {
    runWithContext({ traceId: "tr-test-123" }, () => {
      logger.warn("contextual.event", { foo: 1 });
      const logs = getRecentLogs({ traceId: "tr-test-123" });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.msg === "contextual.event");
      expect(entry).toBeDefined();
      expect(entry.traceId).toBe("tr-test-123");
    });
  });

  it("exposes subsystem status", () => {
    const s = getStatus();
    expect(s.service).toBe("metaplatform-api");
    expect(s.bufferSize).toBeGreaterThan(0);
  });
});