import { describe, it, expect } from "vitest";
import { buildSpec, getSpec } from "../src/openapi.js";

describe("openapi spec", () => {
  it("is valid OpenAPI 3.0+ structure", () => {
    const s = getSpec();
    expect(s.openapi).toMatch(/^3\./);
    expect(s.info.title).toBe("MetaPlatform API");
    expect(s.info.version).toBeDefined();
    expect(s.servers).toBeInstanceOf(Array);
    expect(s.servers.length).toBeGreaterThan(0);
  });

  it("declares bearer JWT security scheme", () => {
    const s = getSpec();
    expect(s.components.securitySchemes.bearerAuth).toBeDefined();
    expect(s.components.securitySchemes.bearerAuth.type).toBe("http");
    expect(s.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });

  it("has reusable schemas", () => {
    const s = getSpec();
    expect(s.components.schemas.LoginRequest).toBeDefined();
    expect(s.components.schemas.HealthResponse).toBeDefined();
    expect(s.components.schemas.ChatRequest).toBeDefined();
  });

  it("documents at least 80 paths", () => {
    const s = getSpec();
    const paths = Object.keys(s.paths);
    expect(paths.length).toBeGreaterThanOrEqual(80);
  });

  it("groups endpoints into tags by route file", () => {
    const s = getSpec();
    const tagNames = new Set(s.tags.map((t) => t.name));
    expect(tagNames.has("Auth")).toBe(true);
    expect(tagNames.has("AI")).toBe(true);
    expect(tagNames.has("Analytics")).toBe(true);
    expect(tagNames.has("Observability")).toBe(true);
  });

  it("buildSpec is idempotent (caches)", () => {
    const s1 = buildSpec();
    const s2 = getSpec();
    expect(s1.paths).toEqual(s2.paths);
  });
});