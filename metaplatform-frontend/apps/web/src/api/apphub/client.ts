/**
 * Re-export the get/post/put/del helpers for components that need them
 * (e.g. DashboardCanvas, which manages its own data fetching outside
 * the typed API functions in apps/portal/src/api/apphub/*.ts).
 *
 * All routes are bound to the apphub service; for other services use
 * @mate/shared/api's createApiClient directly.
 */
import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
export async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
export async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}
