export interface ApiResponse<T> {
  code: string | number;
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

export interface LoginRequest {
  username: string;
  password: string;
  tenantId: string;
}

export interface AuthResponse {
  loginResult: string;
  userId: string;
  username: string;
  realName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

export type ChatMode =
  | 'chat'
  | 'analysis'
  | 'action'
  | 'exploration'
  | 'code'
  | 'task'
  | 'dispatch';

export interface Citation {
  id: string;
  title: string;
  type: string;
  score: number;
  snippet: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'local' | 'loading' | 'updating' | 'success' | 'error';
  streaming?: boolean;
  citations?: Citation[];
  createdAt: string;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  sql?: string;
  sqlAudit?: SqlAuditResult;
  chartData?: ChartDataSet;
  chartType?: ChartType;
  actionResult?: ActionResult;
  graphData?: GraphData;
  generatedConfig?: GeneratedConfig;
  codeReview?: CodeReviewResult;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  pinned?: boolean;
  favorite?: boolean;
  messages: ChatMessage[];
  updatedAt: string;
  knowledgeBaseIds?: string[];
}

// ============ RAG Types (P2-SAI-03) ============

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  status: 'active' | 'building' | 'inactive';
}

export interface RagSearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
  type: string;
  snippet: string;
}

// ============ Conversation Types (P2-SAI-04, 05) ============

export interface Conversation {
  id: string;
  title: string;
  mode: ChatMode;
  favorite: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface ConversationCreateRequest {
  title: string;
  mode: ChatMode;
}

// ============ Analysis / NL2SQL Types (P2-SAI-07, 08) ============

export interface SqlGenerationResult {
  sql: string;
  explanation: string;
  referencedTables: string[];
  referencedConcepts: string[];
}

export interface SqlExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

export interface SqlAuditResult {
  safe: boolean;
  warnings: string[];
  risks: string[];
  level: 'safe' | 'warning' | 'danger';
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'table';

export interface ChartDataSet {
  type: ChartType;
  title: string;
  columns: string[];
  data: Record<string, unknown>[];
}

// ============ Action Types (P2-SAI-09) ============

export interface ActionParam {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  description?: string;
}

export interface ActionItem {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: ActionParam[];
  outputType: 'text' | 'json' | 'table' | 'file';
  enabled: boolean;
}

export interface ActionMatchResult {
  action: ActionItem;
  confidence: number;
  reason: string;
}

export interface ActionResult {
  actionId: string;
  actionName: string;
  success: boolean;
  output: unknown;
  message: string;
  executedAt: string;
}

// ============ Ontology Types (P2-SAI-10, 11, 12) ============

export interface OntologyConcept {
  id: string;
  name: string;
  definition: string;
  attributes: ConceptAttribute[];
  instances: ConceptInstance[];
  relatedConcepts: string[];
}

export interface ConceptAttribute {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface ConceptInstance {
  id: string;
  name: string;
  values: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'concept' | 'entity' | 'relation';
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============ Generation Types (P2-SAI-13~17) ============

export type GenerateType = 'form' | 'process' | 'code' | 'dashboard' | 'explain' | 'review';

export interface GeneratedConfig {
  type: GenerateType;
  title: string;
  content: string;
  language?: string;
  metadata?: Record<string, unknown>;
  targetAppId?: string;
  targetModuleType?: 'form' | 'flow' | 'page';
}

export interface FormGenResult {
  name: string;
  description: string;
  fields: Array<{
    type: string;
    label: string;
    fieldKey: string;
    required: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
}

export interface ProcessGenResult {
  name: string;
  description: string;
  bpmnXml: string;
  nodes: Array<{ id: string; name: string; type: string; assignee?: string }>;
}

export interface CodeGenResult {
  language: string;
  code: string;
  description: string;
  dependencies?: string[];
}

export interface CodeReviewResult {
  overallScore: number;
  securityIssues: CodeReviewIssue[];
  qualityIssues: CodeReviewIssue[];
  suggestions: string[];
}

export interface CodeReviewIssue {
  line: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  rule: string;
}

export interface DashboardGenResult {
  title: string;
  description: string;
  widgets: Array<{
    id: string;
    title: string;
    type: string;
    dataSource: string;
    apiExample: string;
  }>;
  apiExamples: Array<{ method: string; url: string; description: string; curl: string }>;
}
