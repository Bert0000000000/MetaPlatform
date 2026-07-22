import { get } from './client';
import type { ConnectionMonitorResponse, ConnectionStatus, IdeConfigResponse, IdeType } from '@/types';

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
