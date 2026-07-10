/**
 * RBAC 简单实现 —— Sprint 0 主线程完成
 * ────────────────────────────────────────────────────────────
 *  基于角色 + 权限字符串的检查器
 *  v1.0.1 MVP：role-based（角色匹配即可），细粒度 permission 推到 v1.0.2
 */
import type { Request, Response, NextFunction } from "express";

/**
 * 要求用户至少拥有其中一个角色
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ code: 401, message: "未登录", traceId: req.traceId });
      return;
    }
    // 超管 / dev 角色直通
    if (user.roles.includes("admin") || user.roles.includes("dev-user")) {
      return next();
    }
    const hit = roles.some((r) => user.roles.includes(r));
    if (!hit) {
      res.status(403).json({
        code: 403,
        message: `需要以下角色之一：${roles.join(", ")}`,
        traceId: req.traceId,
      });
      return;
    }
    next();
  };
}

/**
 * 要求用户拥有所有权限
 */
export function requireAllPermissions(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ code: 401, message: "未登录", traceId: req.traceId });
      return;
    }
    if (user.permissions?.includes("*")) return next();
    const missing = permissions.filter((p) => !user.permissions?.includes(p));
    if (missing.length > 0) {
      res.status(403).json({
        code: 403,
        message: `缺少权限：${missing.join(", ")}`,
        traceId: req.traceId,
      });
      return;
    }
    next();
  };
}
