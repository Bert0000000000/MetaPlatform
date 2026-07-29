import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { ConnectionMonitorResponse, ConnectionStatus, IdeConfigResponse, IdeType } from './types';

export async function generateServerIdeConfig(
  serverId: string,
  ide: IdeType,
): Promise<IdeConfigResponse> {
  return get<IdeConfigResponse>(`/v1/mcp/servers/${serverId}/ide-config`, { ide });
}
export async function getServerConnectionStatus(serverId: string): Promise<ConnectionStatus> {
  return get<ConnectionStatus>(`/v1/mcp/servers/${serverId}/connection-status`);
}
export async function getConnectionMonitor(): Promise<ConnectionMonitorResponse> {
  return get<ConnectionMonitorResponse>('/v1/mcp/connection-monitor');
}
