import { apiClient } from './client';
import type { JsonRpcRequest, JsonRpcResponse } from '@/types';

export async function callJsonRpc(
  endpoint: string,
  req: JsonRpcRequest,
): Promise<JsonRpcResponse> {
  const response = await apiClient.post(endpoint, req);
  return (response.data as { data: JsonRpcResponse }).data;
}
