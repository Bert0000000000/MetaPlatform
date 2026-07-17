import { apiClient } from './client';
import type { JsonRpcRequest, JsonRpcResponse } from '@/types';

export async function callJsonRpc(
  endpoint: string,
  req: JsonRpcRequest,
): Promise<JsonRpcResponse> {
  try {
    const response = await apiClient.post(endpoint, req);
    const data = response.data as { data: JsonRpcResponse };
    return data.data;
  } catch (e) {
    const error = e as Error;
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: {
        code: -32603,
        message: error.message || '调用失败',
      },
    };
  }
}
