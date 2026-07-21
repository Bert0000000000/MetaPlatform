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

export interface ChatImage {
  uid: string;
  url?: string;
  base64?: string;
  detail?: 'low' | 'high' | 'auto';
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
  images?: ChatImage[];
}

export interface MultimodalModel {
  modelId: string;
  provider: string;
  modelCode: string;
  displayName: string;
  type: string;
  inputPrice: number;
  outputPrice: number;
  contextLength: number;
  capabilities: string[];
  enabled: boolean;
  description?: string;
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
  plan?: Plan;
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
  tags?: string[];
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

// ============ Code Workspace Types (V12-02 / REQ-038~045) ============

export type CodeLanguage = 'python' | 'typescript' | 'sql';

export type ExecutionResultType = 'text' | 'table' | 'error';

export interface CodeExecuteRequest {
  language: string;
  code: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  resultType: ExecutionResultType;
  text?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  errorName?: string | null;
  errorMessage?: string | null;
}

export interface CodeTemplate {
  templateId: string;
  name: string;
  description?: string;
  language: string;
  category?: string;
  code: string;
  tags: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodeTemplateCreateRequest {
  name: string;
  description?: string;
  language: string;
  category?: string;
  code: string;
  tags?: string[];
}

export interface CodeTemplateUpdateRequest {
  name?: string;
  description?: string;
  category?: string;
  code?: string;
  tags?: string[];
}

export interface CodeSnippet {
  snippetId: string;
  title: string;
  description?: string;
  language: string;
  code: string;
  tags: string[];
  version: number;
  changeLog?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodeSnippetVersion extends CodeSnippet {
  previousVersion?: number | null;
}

export interface CodeSnippetCreateRequest {
  title: string;
  description?: string;
  language: string;
  code: string;
  tags?: string[];
}

export interface CodeSnippetUpdateRequest {
  title?: string;
  description?: string;
  code?: string;
  tags?: string[];
  changeLog?: string;
}

export interface CodeSnippetDiffResult {
  snippetId: string;
  versionA: number;
  versionB: number;
  addedLines: string[];
  removedLines: string[];
  unifiedDiff: string;
}

export interface CodeShare {
  shareId: string;
  title?: string;
  description?: string;
  language: string;
  code: string;
  shareUrl: string;
  exportContent: string;
  createdBy?: string;
  createdAt?: string;
  expiresAt?: string | null;
}

export interface CodeShareRequest {
  code: string;
  language: string;
  title?: string;
  description?: string;
}

// ============ Data Analysis Types (V13-12) ============

export type ExportFormat = 'csv' | 'json' | 'excel';

// ============ Autonomous Task Plan Types (V15-02) ============

export type PlanStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'approved';

export type PlanStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PlanStep {
  stepId: string;
  title: string;
  description: string;
  action: string;
  status: PlanStepStatus;
  order: number;
  requiresApproval: boolean;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface Plan {
  planId: string;
  tenantId?: string;
  title: string;
  description: string;
  userInput: string;
  agentId?: string | null;
  status: PlanStatus;
  steps: PlanStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePlanRequest {
  userInput: string;
  agentId?: string;
  title?: string;
}

export interface DataSource {
  id: string;
  name: string;
  sourceType: string;
  status: string;
}

export interface QueryExecuteRequest {
  dataSourceId: string;
  sql: string;
}

export interface QueryExecuteResult {
  queryId: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

export interface QueryHistoryItem {
  id: string;
  dataSourceId: string;
  sql: string;
  rowCount: number;
  executionTimeMs: number;
  status: string;
  createdAt: string;
}

export interface ExecutionPlan {
  plan: unknown;
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
