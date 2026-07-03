import axios from "axios";

const http = axios.create({ baseURL: "/api/v1" });

// 审计日志
export async function getAuditLogs(tenantId = "00000000-0000-0000-0000-000000000001", limit = 50) {
  const { data } = await http.get("/security/audit-logs", { params: { tenantId, limit } });
  return data;
}

// 数据血缘
export async function getLineageImpact(sourceType: string, sourceId: string) {
  const { data } = await http.get("/lineage/impact", { params: { sourceType, sourceId } });
  return data;
}

export async function getLineageRecords(tenantId = "00000000-0000-0000-0000-000000000001", limit = 50) {
  const { data } = await http.get("/lineage", { params: { tenantId, limit } });
  return Array.isArray(data) ? data : (data.records || []);
}

// Agent 执行记录
export async function listAgentExecutions(userId?: string) {
  const { data } = await http.get("/agents/executions", { params: userId ? { userId } : {} });
  return data;
}

export async function listAgents() {
  const { data } = await http.get("/agents");
  return data;
}

// 流程监控
export async function listProcessInstances(status?: string) {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const { data } = await http.get("/processes/instances", { params });
  return data;
}

export async function listProcessDefinitions() {
  const { data } = await http.get("/processes/definitions");
  return data;
}

export async function getProcessHistory(instanceId: string) {
  const { data } = await http.get(`/processes/instances/${instanceId}/history`);
  return data;
}

// 本体查询
export async function semanticQuery(text: string, tenantId = "00000000-0000-0000-0000-000000000001") {
  const { data } = await http.get("/ontology/query", { params: { text, tenantId, limit: 20 } });
  return data;
}

export async function getSchemaGraph(tenantId = "00000000-0000-0000-0000-000000000001") {
  const { data } = await http.get("/ontology/schema-graph", { params: { tenantId } });
  return data;
}

export async function getInferenceSuggestions(entityTypeId: string, tenantId = "00000000-0000-0000-0000-000000000001") {
  const { data } = await http.get("/ontology/infer/suggestions", { params: { entityTypeId, tenantId } });
  return data;
}

// MDM
export async function listGoldenRecords(objectTypeId: string) {
  const { data } = await http.get("/mdm/golden-records", { params: { objectTypeId, tenantId: "00000000-0000-0000-0000-000000000001" } });
  return data;
}

// 数据同步
export async function getDataSyncStats() {
  const { data } = await http.get("/data-sync/stats");
  return data;
}

// 多模态历史
export async function getMultimodalHistory(limit = 20) {
  const { data } = await http.get("/multimodal/history", { params: { tenantId: "00000000-0000-0000-0000-000000000001", limit } });
  return data;
}
