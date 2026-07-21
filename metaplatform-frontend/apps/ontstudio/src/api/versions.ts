import { get, post, put, del } from './client';

export interface OntologyVersion {
  versionId: string;
  code: string;
  description?: string;
  snapshot: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

const BASE = '/v1/ont/versions';

export async function listVersions(): Promise<OntologyVersion[]> {
  return get<OntologyVersion[]>(BASE);
}

export async function createVersion(req: Omit<OntologyVersion, 'versionId' | 'createdAt'>): Promise<OntologyVersion> {
  return post<OntologyVersion>(BASE, req);
}

export async function updateVersion(id: string, req: Partial<OntologyVersion>): Promise<OntologyVersion> {
  return put<OntologyVersion>(`${BASE}/${id}`, req);
}

export async function deleteVersion(id: string): Promise<void> {
  await del<void>(`${BASE}/${id}`);
}

export async function compareVersions(aId: string, bId: string): Promise<VersionDiff> {
  return get<VersionDiff>(`${BASE}/compare`, { aId, bId });
}
