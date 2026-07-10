/**
 * metaplatform-api 客户端 —— Sprint 0 骨架（待主线程接入）
 * ────────────────────────────────────────────────────────────
 * 后端服务地址：默认 http://localhost:3001（参考 05-architecture.md §3.3）
 *
 * 主线程后续要接入的方法：
 *  1) getUser(id)   → GET  /api/users/:id
 *        用途：审批 / 通知时反查用户基本信息（昵称、邮箱、头像）；
 *  2) getTenant(id) → GET  /api/tenants/:id
 *        用途：解析 tenant 信息（租户名、套餐、配额）；
 *  3) listRoles(tenantId) → GET /api/tenants/:id/roles
 *        用途：rbac 中间件需要获取租户角色清单；
 *  4) notifyUser({ userId, channel, payload }) → POST /api/notifications
 *        用途：审批节点流转后给相关人发邮件 / 站内信。
 *
 * 调用约定：
 *  - 网关层耦合，app-service 不感知 metaplatform-api 的存在（Sprint 0 直连即可）；
 *  - 应注入 Bearer Token（沿用上游用户的 JWT）以免重复登录；
 *  - 调用失败（5xx / 网络）走 error-handler 统一 500。
 */
import { config } from "../config";

export interface ApiClientUser {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface ApiClientTenant {
  id: string;
  name: string;
  plan: string;
}

export interface ApiClientRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface ApiClient {
  getUser(id: string, bearer?: string): Promise<ApiClientUser>;
  getTenant(id: string, bearer?: string): Promise<ApiClientTenant>;
  listRoles(tenantId: string, bearer?: string): Promise<ApiClientRole[]>;
  notifyUser(
    input: { userId: string; channel: "email" | "inbox" | "sms"; payload: Record<string, unknown> },
    bearer?: string,
  ): Promise<{ ok: boolean }>;
}

/**
 * Sprint 0 占位实现：所有方法抛错，提示尚未接入。
 * 主线程后续会换成真实 HTTP 客户端（建议沿用 metaplatform-api 自身的 fetch 工具）。
 */
export class StubApiClient implements ApiClient {
  async getUser(): Promise<ApiClientUser> {
    throw new Error(
      `[api.client] getUser not implemented. ` +
        `Will call GET ${config.metaplatformApiUrl}/api/users/:id`,
    );
  }
  async getTenant(): Promise<ApiClientTenant> {
    throw new Error(
      `[api.client] getTenant not implemented. ` +
        `Will call GET ${config.metaplatformApiUrl}/api/tenants/:id`,
    );
  }
  async listRoles(): Promise<ApiClientRole[]> {
    throw new Error(
      `[api.client] listRoles not implemented. ` +
        `Will call GET ${config.metaplatformApiUrl}/api/tenants/:id/roles`,
    );
  }
  async notifyUser(): Promise<{ ok: boolean }> {
    throw new Error(
      `[api.client] notifyUser not implemented. ` +
        `Will call POST ${config.metaplatformApiUrl}/api/notifications`,
    );
  }
}

export const apiClient: ApiClient = new StubApiClient();
