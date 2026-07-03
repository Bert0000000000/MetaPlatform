/**
 * /api/auth — Authentication routes (login, me, logout)
 */
import { Router } from "express";
import jwt from "jsonwebtoken";
import db from "../db.js";
import { JWT_SECRET } from "../middleware/auth.js";

const router = Router();

// POST /login — authenticate user
router.post("/login", (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "请提供邮箱" });

    // Find user by email (password not stored – dev mode accepts any password)
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ success: false, error: "用户不存在" });
    if (user.status !== "active") return res.status(403).json({ success: false, error: "用户已被禁用" });

    // Update last_login
    const now = new Date().toISOString();
    db.prepare("UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?").run(now, now, user.id);

    // Generate JWT
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      data: {
        token,
        user: payload,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /me — get current user from token
router.get("/me", (req, res) => {
  // req.user is set by authenticate middleware
  res.json({ success: true, data: req.user });
});

// POST /logout — logout (client-side token removal, server just acknowledges)
router.post("/logout", (_req, res) => {
  res.json({ success: true, data: { message: "已退出登录" } });
});

export default router;
