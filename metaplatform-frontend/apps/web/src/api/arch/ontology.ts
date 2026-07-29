import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ont', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }

import type { OntologyConcept } from './types';

export async function searchOntologyConcepts(keyword?: string): Promise<OntologyConcept[]> {
  return get<OntologyConcept[]>('/v1/ont/concepts/search', keyword ? { keyword } : undefined);
}
