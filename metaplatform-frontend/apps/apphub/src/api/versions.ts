import { get, post, del } from './client';
import type { PageResponse } from '@/types';

export interface AppVersion {
  versionId: string;
  appId: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE' | 'ROLLBACK';
  changeLog?: string;
  snapshot: string;
  publishedAt?: string;
  rolledBackAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface AppVersionCreateRequest {
  appId: string;
  version: string;
  changeLog?: string;
  snapshot: string;
}

export async function listVersions(appId: string): Promise<PageResponse<AppVersion>> {
  return get<PageResponse<AppVersion>>(`/v1/apphub/apps/${appId}/versions`);
}

export async function getVersion(versionId: string): Promise<AppVersion> {
  return get<AppVersion>(`/v1/apphub/versions/${versionId}`);
}

export async function createVersion(req: AppVersionCreateRequest): Promise<AppVersion> {
  return post<AppVersion>(`/v1/apphub/apps/${req.appId}/versions`, req);
}

export async function publishVersion(versionId: string): Promise<AppVersion> {
  return post<AppVersion>(`/v1/apphub/versions/${versionId}/publish`);
}

export async function rollbackVersion(versionId: string): Promise<AppVersion> {
  return post<AppVersion>(`/v1/apphub/versions/${versionId}/rollback`);
}

export async function deleteVersion(versionId: string): Promise<void> {
  return del<void>(`/v1/apphub/versions/${versionId}`);
}

export async function compareVersions(
  aId: string,
  bId: string,
): Promise<{
  added: string[];
  removed: string[];
  modified: string[];
}> {
  const [a, b] = await Promise.all([getVersion(aId), getVersion(bId)]);
  const aObj = JSON.parse(a.snapshot) as Record<string, unknown>;
  const bObj = JSON.parse(b.snapshot) as Record<string, unknown>;
  const aKeys = new Set(Object.keys(aObj));
  const bKeys = new Set(Object.keys(bObj));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  bKeys.forEach((k) => {
    if (!aKeys.has(k)) added.push(k);
    else if (JSON.stringify(aObj[k]) !== JSON.stringify(bObj[k])) modified.push(k);
  });
  aKeys.forEach((k) => {
    if (!bKeys.has(k)) removed.push(k);
  });
  return { added, removed, modified };
}
