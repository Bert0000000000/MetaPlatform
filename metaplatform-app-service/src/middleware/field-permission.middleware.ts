/**
 * 字段权限中间件 —— Sprint 0 骨架
 * ────────────────────────────────────────────────────────────
 * 后续 Sprint 任务（参考 05-architecture.md §4.2）：
 * 1. 在 list / submit / workflow 等读取/写入表数据的路由前调用；
 * 2. 通过 req.user.roles 与对象的字段权限矩阵比对，过滤掉无权限字段；
 * 3. 写场景下：剔除无权限字段后再入库；
 * 4. 读场景下：剔除无权限字段后再返回；
 * 5. 当前角色完全无权限 → 抛 ForbiddenError。
 */
import { Request, Response, NextFunction } from "express";

export type FieldAction = "read" | "write";

export interface FieldPermissionContext {
  /** 当前表单 / 对象的 code，用于定位字段权限矩阵 */
  resourceCode: string;
  /** 当前操作（读 / 写） */
  action: FieldAction;
}

export function fieldPermission(_ctx: FieldPermissionContext) {
  return function fieldPermissionMiddleware(
    _req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    // TODO(Sprint 3): T3-10 字段权限拦截
    next();
  };
}
