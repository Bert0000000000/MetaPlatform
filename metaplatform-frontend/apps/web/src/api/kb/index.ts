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

const kbClient = createApiClient({ baseURL: apiPath('kb', '') });
const ragClient = createApiClient({ baseURL: apiPath('rag', '') });

export interface KbEntity {
  id: string;
  kbCode: string;
  displayName: string;
  description?: string;
  kbKind: string;
  enabled: boolean;
  chunkCount: number;
}

/** Raw shape returned by the backend TECH-KB /api/v1/kb/collections endpoint. */
interface KbCollectionRaw {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  status: string;
  config?: Record<string, unknown>;
}

function mapCollection(raw: KbCollectionRaw): KbEntity {
  return {
    id: raw.id,
    kbCode: raw.id,
    displayName: raw.name,
    description: raw.description,
    kbKind: String(raw.config?.kind ?? 'GENERAL'),
    enabled: raw.status === 'active',
    chunkCount: raw.document_count,
  };
}

export interface KbDocument {
  id: string;
  kbId: string;
  title: string;
  status: string;
  chunkCount: number;
  fileSize?: number;
}

/** Raw shape returned by the backend TECH-KB /api/v1/kb/documents endpoint. */
interface KbDocumentRaw {
  id: string;
  collection_id: string;
  filename: string;
  status: string;
  chunk_count: number;
  size_bytes: number;
}

function mapDocument(raw: KbDocumentRaw): KbDocument {
  return {
    id: raw.id,
    kbId: raw.collection_id,
    title: raw.filename,
    status: raw.status,
    chunkCount: raw.chunk_count,
    fileSize: raw.size_bytes,
  };
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
  /** Retrieval strategy: AUTO | FACTUAL | ENTITY | THEMATIC (backend default AUTO). */
  mode?: 'AUTO' | 'FACTUAL' | 'ENTITY' | 'THEMATIC';
  /** Second-pass reranker: identity | keyword | length (backend default identity). */
  rerankStrategy?: 'identity' | 'keyword' | 'length';
  /** Number of hits to return (backend default 10). */
  topK?: number;
}

/** Raw RetrievalResponse from backend TECH-RAG /api/v1/rag/search.

 * The endpoint returns this object directly (no {code,data} envelope), so the
 * shared axios interceptor passes it through unchanged and snake_case. */
interface RagRetrievalResponse {
  query: string;
  hits: Array<{
    chunk_id: string;
    document_id: string;
    score: number;
    text: string;
    metadata: Record<string, string>;
  }>;
  total: number;
  latency_ms: number;
  mode: string;
}

/** 列出所有知識庫 */
export async function listKb(): Promise<KbEntity[]> {
  const resp = await kbClient.get<KbCollectionRaw[]>('/collections');
  return (resp.data ?? []).map(mapCollection);
}

/** 列出某個知識庫下的文檔 */
export async function listDocuments(kbId: string): Promise<KbDocument[]> {
  const resp = await kbClient.get<KbDocumentRaw[]>('/documents', { params: { collection_id: kbId } });
  return (resp.data ?? []).map(mapDocument);
}

/** 混合檢索(BM25 + 向量) */
export async function search(payload: SearchPayload): Promise<Evidence[]> {
  const resp = await ragClient.post<RagRetrievalResponse>('/search', {
    // Map to backend RetrievalRequest field names. tenantId is resolved from
    // the auth context server-side, so it is not part of the body.
    query: payload.query,
    kb_id: payload.kbId,
    mode: payload.mode,
    rerank_strategy: payload.rerankStrategy,
    top_k: payload.topK,
  });
  const hits = resp.data?.hits ?? [];
  return hits.map((h) => ({
    evidenceId: h.chunk_id,
    type: h.metadata?.mode ?? 'chunk',
    documentId: h.document_id,
    kbId: payload.kbId ?? '',
    fragment: h.text,
    score: h.score,
    title: h.metadata?.filename,
  }));
}

/** 新建知識庫 */
export async function createKb(payload: Partial<KbEntity>): Promise<KbEntity> {
  const resp = await kbClient.post<KbCollectionRaw>('/collections', {
    name: payload.displayName || payload.kbCode,
    description: payload.description,
    config: { kind: payload.kbKind },
  });
  return mapCollection(resp.data);
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

// ---------------------------------------------------------------------------
// Retrieval configuration (knowledge/config page) — GET/PUT /retrieval-config
// ---------------------------------------------------------------------------
export type RetrievalMode = 'AUTO' | 'FACTUAL' | 'ENTITY' | 'THEMATIC';
export type RerankStrategy = 'identity' | 'keyword' | 'length';
export type ChunkStrategy = 'recursive' | 'markdown' | 'semantic' | 'sliding';

export interface RetrievalConfig {
  tenantId: string;
  mode: RetrievalMode;
  rerankStrategy: RerankStrategy;
  topK: number;
  similarityThreshold: number;
  chunkStrategy: ChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  vectorWeight: number;
  keywordWeight: number;
  rerankerEnabled: boolean;
  showCitations: boolean;
  updatedAt: string;
}

/** Editable subset (no tenant_id / updated_at server-managed fields). */
export type RetrievalConfigUpdate = Omit<RetrievalConfig, 'tenantId' | 'updatedAt'>;

interface RetrievalConfigRaw {
  tenant_id: string; mode: string; rerank_strategy: string; top_k: number;
  similarity_threshold: number; chunk_strategy: string; chunk_size: number;
  chunk_overlap: number; vector_weight: number; keyword_weight: number;
  reranker_enabled: boolean; show_citations: boolean; updated_at: string;
}

function mapConfig(raw: RetrievalConfigRaw): RetrievalConfig {
  return {
    tenantId: raw.tenant_id,
    mode: raw.mode as RetrievalMode,
    rerankStrategy: raw.rerank_strategy as RerankStrategy,
    topK: raw.top_k,
    similarityThreshold: raw.similarity_threshold,
    chunkStrategy: raw.chunk_strategy as ChunkStrategy,
    chunkSize: raw.chunk_size,
    chunkOverlap: raw.chunk_overlap,
    vectorWeight: raw.vector_weight,
    keywordWeight: raw.keyword_weight,
    rerankerEnabled: raw.reranker_enabled,
    showCitations: raw.show_citations,
    updatedAt: raw.updated_at,
  };
}

function toUpdatePayload(cfg: RetrievalConfigUpdate): Record<string, unknown> {
  return {
    mode: cfg.mode,
    rerank_strategy: cfg.rerankStrategy,
    top_k: cfg.topK,
    similarity_threshold: cfg.similarityThreshold,
    chunk_strategy: cfg.chunkStrategy,
    chunk_size: cfg.chunkSize,
    chunk_overlap: cfg.chunkOverlap,
    vector_weight: cfg.vectorWeight,
    keyword_weight: cfg.keywordWeight,
    reranker_enabled: cfg.rerankerEnabled,
    show_citations: cfg.showCitations,
  };
}

/** 讀取當前租戶的檢索配置 */
export async function getRetrievalConfig(): Promise<RetrievalConfig> {
  const resp = await kbClient.get<RetrievalConfigRaw>('/retrieval-config');
  return mapConfig(resp.data);
}

/** 保存當前租戶的檢索配置 */
export async function putRetrievalConfig(cfg: RetrievalConfigUpdate): Promise<RetrievalConfig> {
  const resp = await kbClient.put<RetrievalConfigRaw>('/retrieval-config', toUpdatePayload(cfg));
  return mapConfig(resp.data);
}
