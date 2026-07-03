import axios from "axios";

const http = axios.create({ baseURL: "/api/v1" });

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

/** 获取计费套餐列表 */
export async function listPlans() {
  const { data } = await http.get("/billing/plans");
  return data;
}

/** 获取当前订阅 */
export async function getSubscription(tenantId: string = TENANT_ID) {
  const { data } = await http.get("/billing/subscription", { params: { tenantId } });
  return data;
}

/** 订阅套餐 */
export async function subscribe(tenantId: string, planId: string) {
  const { data } = await http.post("/billing/subscribe", { tenantId, planId });
  return data;
}

/** 获取使用量统计 */
export async function getUsageStats(tenantId: string = TENANT_ID, userId?: string) {
  const params: Record<string, string> = { tenantId };
  if (userId) params.userId = userId;
  const { data } = await http.get("/billing/usage", { params });
  return data;
}

/** 获取使用量汇总 */
export async function getUsageSummary(tenantId: string = TENANT_ID, periodType: string = "daily") {
  const { data } = await http.get("/billing/usage/summary", { params: { tenantId, periodType } });
  return data;
}
