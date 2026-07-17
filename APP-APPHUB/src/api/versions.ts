import { get, post, put, del } from './client';
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

const STORAGE_KEY = 'mate_apphub_versions';

function load(): AppVersion[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppVersion[];
  } catch {
    return [];
  }
}

function save(items: AppVersion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listVersions(appId: string): Promise<PageResponse<AppVersion>> {
  try {
    return await get<PageResponse<AppVersion>>(`/v1/apphub/apps/${appId}/versions`);
  } catch {
    const items = load().filter((v) => v.appId === appId);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    };
  }
}

export async function getVersion(versionId: string): Promise<AppVersion> {
  try {
    return await get<AppVersion>(`/v1/apphub/versions/${versionId}`);
  } catch {
    const v = load().find((x) => x.versionId === versionId);
    if (!v) throw new Error('版本不存在');
    return v;
  }
}

export async function createVersion(req: AppVersionCreateRequest): Promise<AppVersion> {
  try {
    return await post<AppVersion>(`/v1/apphub/apps/${req.appId}/versions`, req);
  } catch {
    const items = load();
    if (items.some((v) => v.appId === req.appId && v.version === req.version)) {
      throw new Error('版本号已存在');
    }
    const created: AppVersion = {
      versionId: generateId(),
      ...req,
      status: 'DRAFT',
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function publishVersion(versionId: string): Promise<AppVersion> {
  const items = load();
  const idx = items.findIndex((v) => v.versionId === versionId);
  if (idx === -1) throw new Error('版本不存在');
  const updated: AppVersion = {
    ...items[idx]!,
    status: 'PUBLISHED',
    publishedAt: now(),
  };
  items.forEach((v, i) => {
    if (v.appId === updated.appId && v.status === 'PUBLISHED' && i !== idx) {
      items[i] = { ...v, status: 'OFFLINE' };
    }
  });
  items[idx] = updated;
  save(items);
  return updated;
}

export async function rollbackVersion(versionId: string): Promise<AppVersion> {
  const items = load();
  const idx = items.findIndex((v) => v.versionId === versionId);
  if (idx === -1) throw new Error('版本不存在');
  const target = items[idx]!;
  const updated: AppVersion = {
    ...target,
    status: 'PUBLISHED',
    publishedAt: now(),
    rolledBackAt: now(),
  };
  items.forEach((v, i) => {
    if (v.appId === target.appId && v.status === 'PUBLISHED' && i !== idx) {
      items[i] = { ...v, status: 'OFFLINE' };
    }
  });
  items[idx] = updated;
  save(items);
  return updated;
}

export async function deleteVersion(versionId: string): Promise<void> {
  try {
    await del(`/v1/apphub/versions/${versionId}`);
  } catch {
    save(load().filter((v) => v.versionId !== versionId));
  }
}

export async function compareVersions(aId: string, bId: string): Promise<{
  added: string[];
  removed: string[];
  modified: string[];
}> {
  const [a, b] = await Promise.all([getVersion(aId), getVersion(bId)]);
  try {
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
  } catch {
    return { added: [], removed: [], modified: [] };
  }
}
