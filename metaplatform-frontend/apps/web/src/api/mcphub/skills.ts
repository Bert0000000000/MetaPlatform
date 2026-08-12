import { createApiClient } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api/v1/marketplace' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}

/** SKILL HUB artifact (marketplace kind="skill"). Backend returns snake_case. */
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author_tenant: string;
  visibility: 'public' | 'private';
  content: string;
  installs: number;
  created_at: string;
  /** 当前租户是否为作者（后端按请求租户计算） */
  is_owner?: boolean;
}

export interface SkillPage {
  items: Skill[];
  total: number;
}

export interface UploadSkillRequest {
  name: string;
  description?: string;
  version?: string;
  visibility?: 'public' | 'private';
  content: string;
}

export async function listSkills(params?: { q?: string; visibility?: string }): Promise<SkillPage> {
  return get<SkillPage>('/skills', params as Record<string, unknown> | undefined);
}

export async function listInstalledSkills(): Promise<SkillPage> {
  return get<SkillPage>('/skills/installed');
}

export async function uploadSkill(body: UploadSkillRequest): Promise<Skill> {
  return post<Skill>('/skills', body);
}

export async function updateSkill(id: string, body: UploadSkillRequest): Promise<Skill> {
  return put<Skill>(`/skills/${id}`, body);
}

export async function getSkill(id: string): Promise<Skill> {
  return get<Skill>(`/skills/${id}`);
}

export async function downloadSkill(id: string): Promise<{ id: string; name: string; version: string; content: string }> {
  return get<{ id: string; name: string; version: string; content: string }>(`/skills/${id}/download`);
}

export async function installSkill(id: string): Promise<{ id: string; installs: number; status: string }> {
  return post<{ id: string; installs: number; status: string }>(`/skills/${id}/install`);
}

export async function deleteSkill(id: string): Promise<{ deleted: string }> {
  return del<{ deleted: string }>(`/skills/${id}`);
}
