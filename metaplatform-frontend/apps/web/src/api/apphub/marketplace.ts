import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}



export interface TemplateItem {
  templateId: string;
  name: string;
  category: 'OA' | 'CRM' | 'HR' | 'Finance' | 'Project' | 'Other';
  description: string;
  icon: string;
  tags: string[];
  downloadCount: number;
  rating: number;
  ratingCount?: number;
  preview?: string;
  configSnapshot?: string;
  createdAt: string;
}

export interface TemplateComment {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCommentRequest {
  rating: number;
  comment?: string;
}

export async function listTemplates(params?: {
  keyword?: string;
  category?: string;
}): Promise<TemplateItem[]> {
  return get<TemplateItem[]>('/templates', params as Record<string, unknown> | undefined);
}

export async function getTemplate(id: string): Promise<TemplateItem> {
  return get<TemplateItem>(`/templates/${id}`);
}

export async function installTemplate(id: string): Promise<{ success: boolean; appId?: string }> {
  return post<{ success: boolean; appId?: string }>(`/templates/${id}/install`);
}

export async function listTemplateComments(
  id: string,
  params?: { page?: number; size?: number },
): Promise<TemplateComment[]> {
  return get<TemplateComment[]>(
    `/templates/${id}/comments`,
    params as Record<string, unknown> | undefined,
  );
}

export async function addTemplateComment(
  id: string,
  req: TemplateCommentRequest,
): Promise<TemplateComment> {
  return post<TemplateComment>(`/templates/${id}/comments`, req);
}
