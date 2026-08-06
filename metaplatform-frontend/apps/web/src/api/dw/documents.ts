import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api/v1' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }


import type { DocumentItem } from './types';

/**
 * 把后端 DwDocument snake_case 字段映射为前端 DocumentItem camelCase。
 * 后端字段：id / tenant_id / name / kind / size_bytes / uploaded_by / uploaded_at / kb_id
 * 前端字段：id / filename / fileType / fileSize / uploader / uploadedAt / status / errorMessage
 */
function normalizeDocument(raw: any): DocumentItem {
  const ext = (raw.name ?? '').split('.').pop()?.toLowerCase() || '';
  const fileType: DocumentItem['fileType'] =
    ext === 'pdf' ? 'pdf' :
    ext === 'doc' || ext === 'docx' ? 'word' :
    ext === 'txt' ? 'txt' :
    ext === 'md' ? 'md' : 'other';
  return {
    id: raw.id,
    employeeId: raw.employeeId ?? raw.employee_id ?? raw.kb_id ?? '',
    filename: raw.filename ?? raw.name,
    fileType,
    fileSize: raw.fileSize ?? raw.size_bytes ?? 0,
    status: raw.status ?? 'ready',
    uploader: raw.uploader ?? raw.uploaded_by,
    uploadedAt: raw.uploadedAt ?? raw.uploaded_at,
    errorMessage: raw.errorMessage,
  };
}

function detectFileType(filename: string): DocumentItem['fileType'] {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  return 'other';
}

export async function uploadDocument(
  employeeId: string,
  file: File,
): Promise<DocumentItem> {
  const fileType = detectFileType(file.name);
  const maxSize = 50 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error('文件大小不能超过 50MB');
  }

  const allowedTypes = ['pdf', 'word', 'txt', 'md'];
  if (!allowedTypes.includes(fileType)) {
    throw new Error('仅支持 PDF、Word、TXT、Markdown 文件');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('employeeId', employeeId);
  const uploaded = await post<any>('/dw/documents/upload', formData);
  return normalizeDocument(uploaded);
}

export async function listDocuments(employeeId: string): Promise<DocumentItem[]> {
  // 后端 /v1/dw/documents 走 _paginate 包装，返回 {items, total, page, pageSize, totalPages}
  const res = await get<any>('/dw/documents', { employeeId });
  const items = Array.isArray(res) ? res : (res?.items ?? []);
  return items.map(normalizeDocument);
}

export async function deleteDocument(docId: string): Promise<void> {
  return del<void>(`/dw/documents/${docId}`);
}

export async function getDocument(docId: string): Promise<DocumentItem> {
  const raw = await get<any>(`/dw/documents/${docId}`);
  return normalizeDocument(raw);
}
