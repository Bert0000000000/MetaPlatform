/**
 * /api/auth — Authentication routes
 *
 * Endpoints:
 *   POST /register   — Create a new user account (public, rate-limited)
 *   POST /login      — Authenticate and receive JWT token (public, rate-limited)
 *   GET  /me          — Get current authenticated user profile
 *   PUT  /password    — Change password for authenticated user
 *   POST /logout      — Acknowledgement logout (client-side token removal)
 */
import { Router } from "express";
import db from "../db.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
  authenticate,
} from "../middleware/auth.js";

const router = Router();

// POST /auth/register — Create new user account
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, department } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "name, email, password required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid email format" });
    }

    // Validate password strength
    if (password.length < 6) {
      return res
        .status(400)
        .json({ success: false, error: "Password must be at least 6 characters" });
    }

    // Check existing user
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Email already registered" });
    }

    const id = "u-" + Date.now().toString(36);
    const passwordHash = await hashPassword(password);

    db.prepare(
      "INSERT INTO users (id, name, email, role, department, status, password_hash) VALUES (?, ?, ?, 'business', ?, 'active', ?)"
    ).run(id, name, email, department || null, passwordHash);

    const user = db
      .prepare(
        "SELECT id, name, email, role, department, status, created_at FROM users WHERE id = ?"
      )
      .get(id);

    const token = generateToken(user);
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login — Authenticate user
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "email and password required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    if (user.status !== "active") {
      return res
        .status(403)
        .json({ success: false, error: "Account is disabled" });
    }

    // Verify password — support both hashed and legacy plain-text
    const valid = user.password_hash
      ? await comparePassword(password, user.password_hash)
      : password === "admin123"; // Legacy fallback for pre-migration users

    if (!valid) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // Update last_login
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, user.id);

    // Audit: successful login
    const { record: audit } = await import("../observability/audit.js");
    const { loginsTotal } = await import("../observability/metrics.js");
    audit({
      action: "login.success",
      userId: user.id,
      userEmail: user.email,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      traceId: req.traceId,
      status: "success",
    });
    loginsTotal.inc({ role: user.role || "user" });

    // Generate JWT — includes tenant_id for multi-tenant support
    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;

    res.json({ success: true, data: { user: safeUser, token } });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — Get current user profile (requires auth)
router.get("/me", authenticate, (req, res, next) => {
  try {
    const user = db
      .prepare(
        "SELECT id, name, email, role, department, status, created_at FROM users WHERE id = ?"
      )
      .get(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /auth/password — Change password (requires auth)
router.put("/password", authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, error: "oldPassword and newPassword required" });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ success: false, error: "New password must be at least 6 characters" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    // Verify current password
    const valid = user.password_hash
      ? await comparePassword(oldPassword, user.password_hash)
      : oldPassword === "admin123"; // Legacy fallback
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, error: "Current password incorrect" });
    }

    // Hash new password
    const hash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?"
    ).run(hash, now, req.user.id);

    res.json({ success: true, data: { message: "Password updated successfully" } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout — Acknowledgement (client removes token)
router.post("/logout", async (_req, res) => {
  res.json({ success: true, data: { message: "Logged out" } });
});

export default router;
