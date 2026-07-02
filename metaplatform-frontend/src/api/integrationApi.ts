import axios from "axios";

const http = axios.create({ baseURL: "/api/v1" });

export async function listConnectors(
  tenantId: string = "00000000-0000-0000-0000-000000000001",
) {
  const { data } = await http.get("/integration/connectors", {
    params: { tenantId },
  });
  return data;
}

export async function createConnector(connector: Record<string, unknown>) {
  const { data } = await http.post("/integration/connectors", connector);
  return data;
}

export async function deleteConnector(id: string) {
  await http.delete(`/integration/connectors/${id}`);
}

export async function testConnection(id: string) {
  const { data } = await http.post(`/integration/connectors/${id}/test`);
  return data;
}

export async function syncConnector(
  id: string,
  direction: string = "inbound",
  params: Record<string, unknown> = {},
) {
  const { data } = await http.post(`/integration/connectors/${id}/sync`, {
    direction,
    ...params,
  });
  return data;
}

export async function getSyncLogs(id: string) {
  const { data } = await http.get(`/integration/connectors/${id}/logs`);
  return data;
}

export async function getSupportedTypes() {
  const { data } = await http.get("/integration/types");
  return data;
}
