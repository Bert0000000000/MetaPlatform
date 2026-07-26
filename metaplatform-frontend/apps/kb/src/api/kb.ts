import axios from 'axios';

/**
 * APP-KB 前端 API 客户端（P2.3.1）。
 */
export const kbApi = axios.create({ baseURL: '/api/v1/kb', timeout: 30000 });

export interface KbEntity {
  id: string;
  kbCode: string;
  displayName: string;
  description?: string;
  kbKind: string;
  enabled: boolean;
  chunkCount: number;
}

export interface KbDocument {
  id: string;
  kbId: string;
  title: string;
  status: string;
  chunkCount: number;
  fileSize?: number;
}

export interface Evidence {
  evidenceId: string;
  type: string;
  documentId: string;
  kbId: string;
  fragment: string;
  score: number;
  title?: string;
}

export async function listKb(): Promise<KbEntity[]> {
  const resp = await kbApi.get('/knowledge-bases');
  return resp.data?.data ?? [];
}

export async function listDocuments(kbId: string): Promise<KbDocument[]> {
  const resp = await kbApi.get('/documents', { params: { kbId } });
  return resp.data?.data ?? [];
}

export async function search(query: { tenantId: string; kbId?: string; query: string }): Promise<Evidence[]> {
  const resp = await axios.post('/api/v1/rag/search', query);
  return resp.data?.data ?? [];
}

export async function createKb(payload: Partial<KbEntity>): Promise<KbEntity> {
  const resp = await kbApi.post('/knowledge-bases', payload);
  return resp.data?.data;
}

export async function uploadDocument(payload: Partial<KbDocument>): Promise<KbDocument> {
  const resp = await kbApi.post('/documents', payload);
  return resp.data?.data;
}

export async function triggerProcess(documentId: string, rawContent: string) {
  const resp = await kbApi.post(`/documents/${documentId}/process`, { rawContent });
  return resp.data?.data;
}
