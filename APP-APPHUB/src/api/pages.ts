import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface DashboardWidget {
  id: string;
  type: 'table' | 'chart-bar' | 'chart-line' | 'chart-pie' | 'stat' | 'text';
  title: string;
  dataSource?: string;
  apiExample?: string;
  config?: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface PageDesignerConfig {
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout?: 'grid' | 'free';
}

const STORAGE_KEY = 'mate_apphub_pages';

function load(): Record<string, PageDesignerConfig> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, PageDesignerConfig>;
  } catch {
    return {};
  }
}

function save(items: Record<string, PageDesignerConfig>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function getPage(id: string): Promise<PageDesignerConfig> {
  try {
    return await get<PageDesignerConfig>(`/v1/apphub/pages/${id}`);
  } catch {
    return (
      load()[id] || {
        name: '未命名页面',
        widgets: [],
        layout: 'grid',
      }
    );
  }
}

export async function savePage(id: string, config: PageDesignerConfig): Promise<PageDesignerConfig> {
  try {
    return await put<PageDesignerConfig>(`/v1/apphub/pages/${id}`, config);
  } catch {
    const all = load();
    all[id] = config;
    save(all);
    return config;
  }
}

export async function deletePage(id: string): Promise<void> {
  try {
    await del(`/v1/apphub/pages/${id}`);
  } catch {
    const all = load();
    delete all[id];
    save(all);
  }
}

export async function listPages(): Promise<PageResponse<{ id: string; name: string }>> {
  const all = load();
  return {
    items: Object.keys(all).map((id) => ({ id, name: all[id]!.name })),
    total: Object.keys(all).length,
    page: 1,
    pageSize: Object.keys(all).length,
    totalPages: 1,
  };
}
