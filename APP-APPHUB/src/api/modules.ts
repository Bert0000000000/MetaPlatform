import type { ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_apphub_modules';

function loadModules(): ModuleItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ModuleItem[];
  } catch {
    return [];
  }
}

function saveModules(modules: ModuleItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
}

function now(): string {
  return new Date().toISOString();
}

function updateAppModuleCount(appId: string): void {
  const count = loadModules().filter((m) => m.appId === appId).length;
  const appsRaw = localStorage.getItem('mate_apphub_apps');
  if (!appsRaw) return;
  const apps = JSON.parse(appsRaw) as Array<{ appId: string; moduleCount: number; updatedAt: string }>;
  const idx = apps.findIndex((a) => a.appId === appId);
  if (idx !== -1) {
    apps[idx].moduleCount = count;
    apps[idx].updatedAt = now();
    localStorage.setItem('mate_apphub_apps', JSON.stringify(apps));
  }
}

export async function listModules(appId?: string): Promise<PageResponse<ModuleItem>> {
  let items = loadModules();
  if (appId) {
    items = items.filter((m) => m.appId === appId);
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

export async function getModule(moduleId: string): Promise<ModuleItem> {
  const module = loadModules().find((m) => m.moduleId === moduleId);
  if (!module) throw new Error('模块不存在');
  return module;
}

export async function createModule(request: ModuleCreateRequest): Promise<ModuleItem> {
  const modules = loadModules();
  if (modules.some((m) => m.appId === request.appId && m.code === request.code)) {
    throw new Error('模块编码已存在');
  }
  const module: ModuleItem = {
    moduleId: crypto.randomUUID(),
    ...request,
    createdAt: now(),
    updatedAt: now(),
  };
  modules.push(module);
  saveModules(modules);
  updateAppModuleCount(request.appId);
  return module;
}

export async function updateModule(moduleId: string, request: ModuleUpdateRequest): Promise<ModuleItem> {
  const modules = loadModules();
  const idx = modules.findIndex((m) => m.moduleId === moduleId);
  if (idx === -1) throw new Error('模块不存在');
  modules[idx] = { ...modules[idx], ...request, updatedAt: now() };
  saveModules(modules);
  return modules[idx];
}

export async function deleteModule(moduleId: string): Promise<void> {
  const modules = loadModules();
  const target = modules.find((m) => m.moduleId === moduleId);
  if (!target) return;
  const remaining = modules.filter((m) => m.moduleId !== moduleId);
  saveModules(remaining);
  updateAppModuleCount(target.appId);
}
