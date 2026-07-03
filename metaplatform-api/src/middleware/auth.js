/**
 * JWT Authentication Middleware
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = "metaplatform-secret";

/** Default admin user for dev mode (no token) */
const DEFAULT_USER = {
  id: "u-admin",
  name: "管理员",
  email: "admin@metaplatform.com",
  role: "admin",
  department: "技术部",
};

/**
 * Express middleware – validates Bearer token.
 * In dev mode, if no token is provided, req.user falls back to DEFAULT_USER.
 */
export function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
    } else {
      // Dev mode – allow without token
      req.user = { ...DEFAULT_USER };
    }
  } catch {
    // Token invalid – still allow in dev mode
    req.user = { ...DEFAULT_USER };
  }
  next();
}

export { JWT_SECRET };
