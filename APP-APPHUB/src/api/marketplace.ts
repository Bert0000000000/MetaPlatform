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
  preview?: string;
  configSnapshot?: string;
  createdAt: string;
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
