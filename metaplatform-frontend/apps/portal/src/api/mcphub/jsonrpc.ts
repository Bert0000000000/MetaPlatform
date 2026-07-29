import { createApiClient, apiPath } from '@mate/shared/api';

export const apiClient = createApiClient({ baseURL: apiPath('mcp', '/v1') });

import type { JsonRpcRequest, JsonRpcResponse } from './types';

export async function callJsonRpc(
  endpoint: string,
  req: JsonRpcRequest,
): Promise<JsonRpcResponse> {
  const response = await apiClient.post(endpoint, req);
  return (response.data as { data: JsonRpcResponse }).data;
}
