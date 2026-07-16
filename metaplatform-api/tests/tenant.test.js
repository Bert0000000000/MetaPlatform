import { describe, it, expect } from "vitest";
import { tenantResolver, tenantGuard } from "../src/middleware/tenant.js";

describe("tenant middleware", () => {
  it("tenantResolver falls back to 'default' when no JWT and no header", () => {
    const req = { user: undefined, headers: {} };
    const next = () => {};
    tenantResolver(req, {}, next);
    expect(req.tenantId).toBe("default");
  });

  it("tenantResolver reads tenantId from JWT", () => {
    const req = { user: { id: "u1", tenantId: "tenant-a" }, headers: {} };
    tenantResolver(req, {}, () => {});
    expect(req.tenantId).toBe("tenant-a");
  });

  it("tenantResolver reads tenant_id (snake_case) from JWT", () => {
    const req = { user: { id: "u1", tenant_id: "tenant-b" }, headers: {} };
    tenantResolver(req, {}, () => {});
    expect(req.tenantId).toBe("tenant-b");
  });

  it("tenantResolver allows admin X-Tenant-Id override", () => {
    const req = {
      user: { id: "admin1", role: "admin", tenantId: "tenant-a" },
      headers: { "x-tenant-id": "tenant-other" },
    };
    tenantResolver(req, {}, () => {});
    expect(req.tenantId).toBe("tenant-other");
  });

  it("tenantResolver ignores X-Tenant-Id for non-admin", () => {
    const req = {
      user: { id: "u1", role: "user", tenantId: "tenant-a" },
      headers: { "x-tenant-id": "tenant-other" },
    };
    tenantResolver(req, {}, () => {});
    expect(req.tenantId).toBe("tenant-a");
  });

  it("tenantGuard allows matching tenantId", () => {
    const req = { tenantId: "tenant-a", body: { tenantId: "tenant-a", name: "app" } };
    const next = () => {};
    let nextCalled = false;
    tenantGuard(req, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("tenantGuard rejects mismatched tenantId", () => {
    const req = { tenantId: "tenant-a", body: { tenantId: "tenant-b", name: "app" } };
    const json = (status, body) => { req._status = status; req._body = body; };
    const res = { status: (s) => ({ json: (b) => json(s, b) }), json };
    let nextCalled = false;
    tenantGuard(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(req._status).toBe(403);
    expect(req._body.error).toBe("tenant_mismatch");
  });

  it("tenantGuard allows request without tenantId in body", () => {
    const req = { tenantId: "tenant-a", body: { name: "app" } };
    let nextCalled = false;
    tenantGuard(req, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it("tenantGuard accepts snake_case tenant_id too", () => {
    const req = { tenantId: "tenant-a", body: { tenant_id: "tenant-a" } };
    let nextCalled = false;
    tenantGuard(req, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});