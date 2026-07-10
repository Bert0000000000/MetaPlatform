/**
 * JWT 鉴权中间件 —— Sprint 0 主线程完成
 * ────────────────────────────────────────────────────────────
 *  - 解析 Authorization: Bearer <token>
 *  - 用 config.jwtSecret 校验签名
 *  - 把解析出的用户信息（id, tenantId, roles）放到 req.user
 *  - 用户未登录 → 返回 401
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AppUser {
  id: string;
  tenantId: string;
  username?: string;
  roles: string[];
  permissions?: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AppUser;
      traceId?: string;
    }
  }
}

export interface JwtPayload extends AppUser {
  iat?: number;
  exp?: number;
}

export function jwtAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.header("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      // Sprint 0：未带 token 也允许通过，标记为 dev-user（开发/测试环境）
      // 生产环境（production）要求强制带 token
      if (config.env === "production") {
        res.status(401).json({
          code: 401,
          message: "未提供 Authorization Bearer token",
          traceId: req.traceId,
        });
        return;
      }
      req.user = {
        id: "dev-user",
        tenantId: "default",
        roles: ["admin"],
        permissions: ["*"],
      };
      return next();
    }

    const token = auth.slice("Bearer ".length).trim();
    try {
      const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
      req.user = {
        id: payload.id,
        tenantId: payload.tenantId,
        username: payload.username,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
      };
      next();
    } catch (err: any) {
      res.status(401).json({
        code: 401,
        message: "JWT 校验失败：" + (err.message ?? "未知"),
        traceId: req.traceId,
      });
    }
  };
}

/**
 * 工具函数：生成 JWT（开发测试用）
 */
export function signJwt(payload: AppUser, expiresInSec = 3600): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresInSec });
}
