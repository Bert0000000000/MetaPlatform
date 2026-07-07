import { describe, it, expect } from "vitest";
import {
  httpRequestsTotal,
  loginsTotal,
  nl2sqlQueriesTotal,
  cacheHitsTotal,
  renderMetrics,
} from "../src/observability/metrics.js";

describe("metrics", () => {
  it("exposes counters that can be incremented", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/test", status: "200" });
    loginsTotal.inc({ role: "user" });
    nl2sqlQueriesTotal.inc({ safe: "true" });
    cacheHitsTotal.inc();

    const text = await renderMetrics();
    expect(text).toContain("metaplatform_http_requests_total");
    expect(text).toContain("metaplatform_logins_total");
    expect(text).toContain("metaplatform_nl2sql_queries_total");
    expect(text).toContain("metaplatform_cache_hits_total");
    // Default node metrics
    expect(text).toContain("metaplatform_process_cpu_user_seconds_total");
  });

  it("renders Prometheus text format with HELP/TYPE comments", async () => {
    const text = await renderMetrics();
    expect(text.length).toBeGreaterThan(100);
    expect(text).toMatch(/# HELP/);
    expect(text).toMatch(/# TYPE/);
    expect(text).toMatch(/metaplatform_process_cpu_seconds_total/);
  });
});