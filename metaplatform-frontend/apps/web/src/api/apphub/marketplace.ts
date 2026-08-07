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

// UUIDv5-style deterministic UUID from a template id（marketplace artifact_id 是 UUID 类型）
function templateIdToUuid(id: string): string {
  // 简单确定性映射：把任意字符串哈希成合法 UUID（v4 格式）
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0') + '00000000000000000000';
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function installTemplate(id: string): Promise<InstallResult> {
  try {
    // 真实 marketplace API：POST /install {kind, artifact_id, version}
    const resp = await mktClient.post<{ install_id?: string; already_installed?: boolean }>('/install', {
      kind: 'ontology',
      artifact_id: templateIdToUuid(id),
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
  const res = await get<{ items?: Array<Record<string, unknown>> }>('/templates', params as Record<string, unknown> | undefined);
  return (res?.items ?? []).map(mapTemplate);
}

function mapTemplate(raw: Record<string, unknown>): TemplateItem {
  return {
    templateId: String(raw.id ?? raw.code ?? ''),
    name: String(raw.name ?? ''),
    category: String(raw.template_type ?? raw.category ?? 'workflow'),
    description: String(raw.description ?? ''),
    icon: 'appstore',
    tags: [],
    downloadCount: 0,
    rating: 0,
    preview: String(raw.content ?? ''),
    createdAt: '',
  };
}

export async function getTemplate(id: string): Promise<TemplateItem> {
  return get<TemplateItem>(`/templates/${id}`);
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
