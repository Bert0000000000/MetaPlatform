/**
 * JWT Authentication Middleware — Production-grade
 *
 * Provides:
 *   - Password hashing (bcryptjs, 12 rounds)
 *   - JWT generation and verification
 *   - Required auth middleware (rejects unauthenticated requests)
 *   - Optional auth middleware (attaches user if token present)
 *   - Role-based access control (RBAC)
 *   - Permission-based access control
 *   - Tenant isolation helper
 */
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "metaplatform-prod-secret-change-in-production";
const JWT_EXPIRES = "24h";

// ── Password hashing ──────────────────────────────────────
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ── JWT generation ────────────────────────────────────────
export function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tenant_id: user.tenant_id || "default",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ── Auth middleware (REQUIRED token) ──────────────────────
export function authenticate(req, res, next) {
  // F4.6.13 If an upstream API-key middleware has already populated
  // req.apiKey (and synthesised req.user), accept it as a valid
  // credential. This lets clients authenticate via either Bearer JWT
  // OR mp_live_ API key against the same /api/apps router.
  if (req.apiKey && req.user) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: "Missing or invalid authorization header" });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      tenant_id: payload.tenant_id,
    };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token" });
  }
}

// ── Optional auth (attach user if token present, but don't reject) ──
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
      req.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name,
        tenant_id: payload.tenant_id,
      };
    } catch {
      // Invalid token — proceed without user context
    }
  }
  next();
}

// ── RBAC middleware ───────────────────────────────────────
// Usage: requireRole("admin") or requireRole("admin", "manager")
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, error: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

// ── Permission-based access ───────────────────────────────
const PERMISSIONS = {
  admin: ["*"],
  manager: ["read:*", "write:own", "approve:*"],
  business: ["read:own", "write:own"],
  viewer: ["read:own"],
};

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }
    const userPerms = PERMISSIONS[req.user.role] || [];
    const hasPermission =
      userPerms.includes("*") || userPerms.includes(permission);
    if (!hasPermission) {
      return res
        .status(403)
        .json({ success: false, error: `Missing permission: ${permission}` });
    }
    next();
  };
}

// ── Tenant isolation middleware ────────────────────────────
export function withTenantFilter(queryFn) {
  return (req, ...args) => {
    const tenantId = req.user?.tenant_id || "default";
    return queryFn(tenantId, ...args);
  };
}

export { JWT_SECRET };
