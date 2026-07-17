export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  traceId?: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type EmployeeStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type RoleCategory =
  | 'FINANCE'
  | 'HR'
  | 'LEGAL'
  | 'DATA_ANALYST'
  | 'CUSTOMER_SERVICE'
  | 'CUSTOM';

export interface EmployeeCapability {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
  tools: string[];
  ragKnowledgeBaseIds: string[];
  retrievalMethod: 'hybrid' | 'vector' | 'keyword';
  topK: number;
  rerank: boolean;
}

export interface Employee {
  employeeId: string;
  tenantId?: string;
  name: string;
  code: string;
  roleCategory: RoleCategory;
  roleIdentity: string;
  description: string;
  avatar?: string;
  status: EmployeeStatus;
  capability: EmployeeCapability;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface EmployeeCreateRequest {
  name: string;
  code: string;
  roleCategory: RoleCategory;
  roleIdentity: string;
  description: string;
  avatar?: string;
  capability: EmployeeCapability;
}

export interface EmployeeUpdateRequest extends EmployeeCreateRequest {}

export const ROLE_CATEGORY_OPTIONS: { label: string; value: RoleCategory; color: string }[] = [
  { label: '财务类', value: 'FINANCE', color: 'blue' },
  { label: 'HR类', value: 'HR', color: 'green' },
  { label: '法务类', value: 'LEGAL', color: 'purple' },
  { label: '数据分析类', value: 'DATA_ANALYST', color: 'cyan' },
  { label: '客服类', value: 'CUSTOMER_SERVICE', color: 'orange' },
  { label: '自定义', value: 'CUSTOM', color: 'default' },
];

export const ROLE_CATEGORY_MAP: Record<RoleCategory, { label: string; color: string }> = {
  FINANCE: { label: '财务类', color: 'blue' },
  HR: { label: 'HR类', color: 'green' },
  LEGAL: { label: '法务类', color: 'purple' },
  DATA_ANALYST: { label: '数据分析类', color: 'cyan' },
  CUSTOMER_SERVICE: { label: '客服类', color: 'orange' },
  CUSTOM: { label: '自定义', color: 'default' },
};

export const EMPLOYEE_STATUS_MAP: Record<EmployeeStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  ACTIVE: { label: '在线', color: 'success' },
  INACTIVE: { label: '已停用', color: 'default' },
  ARCHIVED: { label: '已归档', color: 'text' },
};

export const DIALOG_STYLE_PRESETS = [
  { label: '严谨', temperature: 0.2, topP: 0.8, maxTokens: 4096 },
  { label: '均衡', temperature: 0.7, topP: 0.9, maxTokens: 4096 },
  { label: '灵活', temperature: 0.9, topP: 0.95, maxTokens: 4096 },
] as const;

export const MOCK_TOOLS = [
  { id: 'query_database', name: '查询数据库', category: '数据查询' },
  { id: 'send_email', name: '发送邮件', category: '通知推送' },
  { id: 'read_file', name: '读取文件', category: '文件操作' },
  { id: 'write_file', name: '写入文件', category: '文件操作' },
  { id: 'call_external_api', name: '调用外部 API', category: '外部API' },
  { id: 'search_knowledge', name: '搜索知识库', category: '数据查询' },
] as const;

export const MOCK_MODELS = [
  { id: 'doubao-pro', name: 'Doubao-Pro', description: '推理强，适合复杂任务' },
  { id: 'doubao-lite', name: 'Doubao-Lite', description: '速度快，成本低' },
  { id: 'gpt-4o', name: 'GPT-4o', description: '多模态，通用能力强' },
] as const;

export const MOCK_KNOWLEDGE_BASES = [
  { id: 'kb-finance', name: '财务制度知识库', documentCount: 12 },
  { id: 'kb-hr', name: 'HR 政策知识库', documentCount: 8 },
  { id: 'kb-legal', name: '法务合规矩阵', documentCount: 5 },
  { id: 'kb-product', name: '产品手册知识库', documentCount: 20 },
] as const;

// ============ Document Types (P2-DW-06) ============

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface DocumentItem {
  id: string;
  employeeId: string;
  filename: string;
  fileType: 'pdf' | 'word' | 'txt' | 'md' | 'other';
  fileSize: number;
  status: DocumentStatus;
  uploadedAt: string;
  processedAt?: string;
  errorMessage?: string;
}

// ============ Extraction Types (P2-DW-07, 08) ============

export type ExtractionType = 'concept' | 'entity' | 'rule' | 'action';
export type ExtractionStatus = 'pending' | 'approved' | 'rejected' | 'committed';

export interface ExtractionItem {
  id: string;
  documentId: string;
  employeeId: string;
  type: ExtractionType;
  name: string;
  description: string;
  confidence: number;
  status: ExtractionStatus;
  properties?: Record<string, unknown>;
  extractedAt: string;
  reviewedAt?: string;
  commitResult?: { success: boolean; message: string; ontId?: string };
}

export interface ExtractionResult {
  documentId: string;
  items: ExtractionItem[];
  totalConcepts: number;
  totalEntities: number;
  totalRules: number;
  totalActions: number;
}

// ============ Task Types (P2-DW-04) ============

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface EmployeeTask {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  progress?: number;
}
