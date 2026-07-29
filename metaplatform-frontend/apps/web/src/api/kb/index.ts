/**
 * APP-KB API 客户端(Phase 1: 從 apps/kb 遷入 @mate/web)。
 *
 * 與其他 web 業務 API 一致:用 @mate/shared 的 createApiClient 統一處理
 *   - 401 自動 refresh + 重放(走 /api/v1/iam/auth/refresh)
 *   - Bearer token / X-Tenant-Id / X-Trace-Id 注入
 *   - ApiResponse(code / data)自動解包,response.data 即為業務 payload
 *
 * 端點對齊後端 TECH-KB 服務(/api/v1/kb)與 TECH-RAG 服務(/api/v1/rag),
 *   走 vite proxy 轉發到對應上游,見 apps/web/vite.config.ts。
 */
import { createApiClient, apiPath } from '@mate/shared/api';

const kbClient = createApiClient({ baseURL: apiPath('kb', '/') });
const ragClient = createApiClient({ baseURL: apiPath('rag', '/') });

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

export interface SearchPayload {
  tenantId: string;
  kbId?: string;
  query: string;
}

/** 列出所有知識庫 */
export async function listKb(): Promise<KbEntity[]> {
  const resp = await kbClient.get<KbEntity[]>('/knowledge-bases');
  return resp.data;
}

/** 列出某個知識庫下的文檔 */
export async function listDocuments(kbId: string): Promise<KbDocument[]> {
  const resp = await kbClient.get<KbDocument[]>('/documents', { params: { kbId } });
  return resp.data;
}

/** 混合檢索(BM25 + 向量) */
export async function search(payload: SearchPayload): Promise<Evidence[]> {
  const resp = await ragClient.post<Evidence[]>('/search', payload);
  return resp.data;
}

/** 新建知識庫 */
export async function createKb(payload: Partial<KbEntity>): Promise<KbEntity> {
  const resp = await kbClient.post<KbEntity>('/knowledge-bases', payload);
  return resp.data;
}

/** 上傳文檔(由後端負責文件內容) */
export async function uploadDocument(payload: Partial<KbDocument>): Promise<KbDocument> {
  const resp = await kbClient.post<KbDocument>('/documents', payload);
  return resp.data;
}

/** 觸發文檔處理流水線(切片 / 索引) */
export async function triggerProcess(documentId: string, rawContent: string) {
  const resp = await kbClient.post<unknown>(`/documents/${documentId}/process`, { rawContent });
  return resp.data;
}
