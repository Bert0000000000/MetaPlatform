import type { AppItem, AppCreateRequest, AppUpdateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_apphub_apps';

function loadApps(): AppItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppItem[];
  } catch {
    return [];
  }
}

function saveApps(apps: AppItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

function now(): string {
  return new Date().toISOString();
}

export async function listApps(params?: {
  keyword?: string;
  group?: string;
  status?: string;
}): Promise<PageResponse<AppItem>> {
  let items = loadApps();
  if (params?.keyword) {
    const k = params.keyword.toLowerCase();
    items = items.filter(
      (a) => a.name.toLowerCase().includes(k) || a.code.toLowerCase().includes(k)
    );
  }
  if (params?.group) {
    items = items.filter((a) => a.group === params.group);
  }
  if (params?.status) {
    items = items.filter((a) => a.status === params.status);
  }
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

export async function getApp(appId: string): Promise<AppItem> {
  const app = loadApps().find((a) => a.appId === appId);
  if (!app) throw new Error('应用不存在');
  return app;
}

export async function createApp(request: AppCreateRequest): Promise<AppItem> {
  const apps = loadApps();
  if (apps.some((a) => a.code === request.code)) {
    throw new Error('应用编码已存在');
  }
  const app: AppItem = {
    appId: crypto.randomUUID(),
    ...request,
    status: 'DESIGNING',
    moduleCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  apps.push(app);
  saveApps(apps);
  return app;
}

export async function updateApp(appId: string, request: AppUpdateRequest): Promise<AppItem> {
  const apps = loadApps();
  const idx = apps.findIndex((a) => a.appId === appId);
  if (idx === -1) throw new Error('应用不存在');
  apps[idx] = { ...apps[idx], ...request, updatedAt: now() };
  saveApps(apps);
  return apps[idx];
}

export async function deleteApp(appId: string): Promise<void> {
  const apps = loadApps().filter((a) => a.appId !== appId);
  saveApps(apps);
}

export async function listGroups(): Promise<string[]> {
  const groups = new Set<string>();
  loadApps().forEach((a) => {
    if (a.group) groups.add(a.group);
  });
  return Array.from(groups);
}
