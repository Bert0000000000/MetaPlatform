/**
 * Multi-tenant isolation middleware (Phase 7 — DX)
 *
 * Two-layer approach (no PG RLS — works with both PG and SQLite):
 *
 *   1. Tenant resolver: determines the active tenant from JWT or header.
 *      - JWT claim `tenantId` (preferred)
 *      - Header `X-Tenant-Id` (admin override)
 *      - Falls back to "default"
 *
 *   2. Tenant guard: enforces that any user-supplied `tenantId` field
 *      in request bodies matches the active tenant. Prevents one tenant
 *      from operating on another's data.
 *
 * Usage:
 *   import { tenantResolver, tenantGuard } from "./middleware/tenant.js";
 *   app.use(authenticate, tenantResolver);
 *   app.post("/api/apps", tenantGuard, appsRoutes.create);
 */

const HEADER = "x-tenant-id";

export function tenantResolver(req, res, next) {
  // 1. JWT claim (most trustworthy)
  const jwtTenant = req.user?.tenantId || req.user?.tenant_id;
  // 2. Header (admin override; only valid for users with role 'admin')
  const headerTenant = req.headers[HEADER];

  if (headerTenant && req.user?.role === "admin") {
    req.tenantId = headerTenant;
  } else if (jwtTenant) {
    req.tenantId = jwtTenant;
  } else {
    req.tenantId = "default";
  }
  next();
}

/**
 * Guard that rejects any request whose body contains a `tenantId`
 * different from the active tenant.
 */
export function tenantGuard(req, res, next) {
  if (req.body && typeof req.body === "object") {
    const bodyTenant = req.body.tenantId || req.body.tenant_id;
    if (bodyTenant && bodyTenant !== req.tenantId) {
      return res.status(403).json({
        success: false,
        error: "tenant_mismatch",
        message: `Body tenant '${bodyTenant}' does not match active tenant '${req.tenantId}'`,
      });
    }
  }
  next();
}

/**
 * Helper for queries: scope any DB operation by tenant.
 * Wraps a row's tenant_id on insert and adds WHERE tenant_id = ? on read.
 */
export function tenantScope(req) {
  return req.tenantId || "default";
}

/**
 * Auto-inject tenant_id on insert if the row has a tenant_id column.
 */
export function withTenant(req, row) {
  return { ...row, tenant_id: req.tenantId };
}