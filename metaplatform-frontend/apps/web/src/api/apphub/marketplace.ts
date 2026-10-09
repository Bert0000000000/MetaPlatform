import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '') });
// marketplace 域挂在 mate-app-hub（gateway /api/v1/marketplace → apphub）
const mktClient = createApiClient({ baseURL: '/api/v1/marketplace' });
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
  category: string;
  description: string;
  icon: string;
  tags: string[];
  downloadCount: number;
  rating: number;
  ratingCount?: number;
  preview?: string;
  configSnapshot?: string;
  createdAt: string;
  author?: string;
  usageCount?: number;
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

// ── Marketplace 安装域（/api/v1/marketplace）──

export interface InstallResult {
  success: boolean;
  installId?: string;
  alreadyInstalled?: boolean;
  error?: string;
}

export type InstallKind = 'mcp' | 'agent' | 'ontology';

export interface InstalledItem {
  id: string;
  kind: InstallKind;
  artifactId: string;
  version: string;
  state: 'downloading' | 'verifying' | 'installed' | 'failed' | 'uninstalled';
  installedAt?: string;
}

const INSTALL_KIND_MAP: Record<string, InstallKind> = {
  ontology: 'ontology',
  agent: 'agent',
  mcp: 'mcp',
};

function mapInstalled(raw: Record<string, unknown>): InstalledItem {
  return {
    id: String(raw.id ?? ''),
    kind: (INSTALL_KIND_MAP[String(raw.kind ?? '')] as InstallKind) ?? 'ontology',
    artifactId: String(raw.artifact_id ?? ''),
    version: String(raw.version ?? ''),
    state: (raw.state as InstalledItem['state']) ?? 'installed',
    installedAt: raw.installed_at ? String(raw.installed_at) : undefined,
  };
}

export function canInstallTemplate(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export interface TemplateCreateRequest {
  code: string;
  name: string;
  template_type: 'workflow' | 'form' | 'approval';
  description?: string;
  content: Record<string, unknown>;
}

export async function createTemplate(payload: TemplateCreateRequest): Promise<TemplateItem> {
  return mapTemplate(await post<Record<string, unknown>>('/templates', payload));
}

export async function installTemplate(id: string): Promise<InstallResult> {
  if (!canInstallTemplate(id)) {
    return { success: false, error: '该模板尚未关联可安装的市场制品' };
  }
  try {
    // 真实 marketplace API：POST /install {kind, artifact_id, version}
    const resp = await mktClient.post<{ install_id?: string; already_installed?: boolean }>('/install', {
      kind: 'ontology',
      artifact_id: id,
      version: 'v1',
    });
    const body = resp.data ?? resp;
    return {
      success: true,
      installId: body.install_id,
      alreadyInstalled: body.already_installed ?? false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '安装失败',
    };
  }
}

export async function listInstalled(params?: { kind?: InstallKind }): Promise<InstalledItem[]> {
  const resp = await mktClient.get<{ items?: Array<Record<string, unknown>> }>('/installed', {
    params: params?.kind ? { kind: params.kind } : undefined,
  });
  const body = resp.data ?? resp;
  return (body?.items ?? []).map(mapInstalled);
}

export async function listTemplates(params?: {
  keyword?: string;
  category?: string;
}): Promise<TemplateItem[]> {
  // 后端返回 {items:[...]} 且字段为 id/template_type/description/content，映射到前端结构
  const res = await get<{ items?: Array<Record<string, unknown>> }>('/templates', params?.category ? { template_type: params.category } : undefined);
  const templates = (res?.items ?? []).map(mapTemplate);
  const keyword = params?.keyword?.trim().toLocaleLowerCase();
  return keyword
    ? templates.filter((item) => `${item.name} ${item.description} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(keyword))
    : templates;
}

function mapTemplate(raw: Record<string, unknown>): TemplateItem {
  const content = raw.content && typeof raw.content === 'object' ? raw.content as Record<string, unknown> : {};
  return {
    templateId: String(raw.id ?? raw.code ?? ''),
    name: String(raw.name ?? ''),
    category: String(raw.template_type ?? raw.category ?? 'workflow'),
    description: String(raw.description ?? ''),
    icon: typeof content.icon === 'string' ? content.icon : 'appstore',
    tags: Array.isArray(content.tags) ? content.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    downloadCount: 0,
    rating: 0,
    preview: typeof raw.content === 'string' ? raw.content : undefined,
    configSnapshot: typeof raw.content === 'string' ? raw.content : JSON.stringify(raw.content ?? {}),
    createdAt: '',
  };
}

export async function getTemplate(id: string): Promise<TemplateItem> {
  const templates = await listTemplates();
  const template = templates.find((item) => item.templateId === id);
  if (!template) throw new Error('模板不存在或已不可访问');
  return template;
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
