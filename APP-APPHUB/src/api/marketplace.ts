import { get, post } from './client';

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
  return get<TemplateItem[]>('/v1/apphub/templates', params as Record<string, unknown> | undefined);
}

export async function getTemplate(id: string): Promise<TemplateItem> {
  return get<TemplateItem>(`/v1/apphub/templates/${id}`);
}

export async function installTemplate(id: string): Promise<{ success: boolean; appId?: string }> {
  return post<{ success: boolean; appId?: string }>(`/v1/apphub/templates/${id}/install`);
}

export async function listTemplateComments(
  id: string,
  params?: { page?: number; size?: number },
): Promise<TemplateComment[]> {
  return get<TemplateComment[]>(
    `/v1/apphub/templates/${id}/comments`,
    params as Record<string, unknown> | undefined,
  );
}

export async function addTemplateComment(
  id: string,
  req: TemplateCommentRequest,
): Promise<TemplateComment> {
  return post<TemplateComment>(`/v1/apphub/templates/${id}/comments`, req);
}
