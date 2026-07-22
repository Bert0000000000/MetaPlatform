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
  size: number;
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

// ============ MCP Tool (P3-MCPHUB-01) ============

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  enumValues?: string[];
}

export interface McpTool {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  inputSchema: ToolParam[];
  outputType: 'text' | 'json' | 'file' | 'table';
  enabled: boolean;
  version: string;
  serverId?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface McpToolCreateRequest {
  name: string;
  code: string;
  category: string;
  description: string;
  inputSchema: ToolParam[];
  outputType: McpTool['outputType'];
  enabled: boolean;
  tags?: string[];
  changeLog?: string;
}

export interface McpToolVersion {
  id: string;
  toolId: string;
  version: string;
  schema: ToolParam[];
  description: string;
  changeLog: string;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
}

export interface McpToolVersionCompareResult {
  left: McpToolVersion;
  right: McpToolVersion;
  differences: string[];
}

export interface McpToolCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  sortOrder: number;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpToolCategoryCreateRequest {
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
  parentId?: string;
}

// ============ MCP Server (P3-MCPHUB-02) ============

export interface McpServer {
  id: string;
  name: string;
  code: string;
  description?: string;
  transport: 'stdio' | 'sse' | 'http';
  endpoint: string;
  host?: string;
  port?: number;
  sseEndpoint?: string;
  authType?: 'none' | 'apikey' | 'oauth2';
  authConfig?: string;
  timeoutMs?: number;
  maxConcurrentCalls?: number;
  healthCheckUrl?: string;
  toolIds: string[];
  toolCount?: number;
  enabled: boolean;
  status: 'online' | 'offline' | 'error';
  lastHeartbeatAt?: string;
  lastErrorMessage?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface McpServerCreateRequest {
  name: string;
  code: string;
  description?: string;
  transport: McpServer['transport'];
  endpoint: string;
  host?: string;
  port?: number;
  sseEndpoint?: string;
  authType?: McpServer['authType'];
  authConfig?: string;
  timeoutMs?: number;
  maxConcurrentCalls?: number;
  healthCheckUrl?: string;
  toolIds: string[];
  enabled: boolean;
  tags?: string[];
}

export interface McpServerStatus {
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  connectionStatus: 'online' | 'offline' | 'error';
  lastHeartbeatAt?: string;
  lastErrorMessage?: string;
  healthCheckUrl?: string;
  responseTimeMs?: number;
}

// ============ JSON-RPC / Debugger (P3-MCPHUB-03) ============

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============ MCP Debugger (V13-04) ============

export interface McpDebugSession {
  id: string;
  serverId?: string;
  toolId?: string;
  method?: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  rawRequest?: string;
  rawResponse?: string;
  durationMs?: number;
  status: 'SUCCESS' | 'FAILED' | 'BREAKPOINT';
  errorMessage?: string;
  breakpoint: boolean;
  traceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpDebugExecuteRequest {
  serverId?: string;
  toolId?: string;
  requestPayload: Record<string, unknown>;
  breakpoint?: boolean;
}

export interface McpDebugCompareResult {
  left: McpDebugSession;
  right: McpDebugSession;
  differences: string[];
}

// ============ MCP Client (P3-MCPHUB-04) ============

export interface McpClient {
  id: string;
  name: string;
  endpoint: string;
  serverUrl?: string;
  baseUrl?: string;
  clientType?: string;
  transportType?: string;
  authType?: 'none' | 'apikey' | 'oauth2' | 'bearer';
  apiKey?: string;
  authToken?: string;
  timeoutMs?: number;
  headers?: string;
  serverIds?: string;
  status: 'connected' | 'disconnected' | 'error' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  discoveredTools: number;
  lastSyncAt?: string;
  lastConnectedAt?: string;
  config?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpClientCreateRequest {
  name: string;
  endpoint: string;
  serverUrl?: string;
  baseUrl?: string;
  clientType?: string;
  transportType?: string;
  authType?: McpClient['authType'];
  apiKey?: string;
  authToken?: string;
  timeoutMs?: number;
  headers?: string;
  serverIds?: string;
  config?: string;
}

export interface McpDiscoveredTool {
  id: string;
  serverId?: string;
  name: string;
  code: string;
  description?: string;
  toolType?: string;
  enabled?: boolean;
  inputSchema?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============ Permission (P3-MCPHUB-05) ============

export interface PermissionRule {
  id: string;
  name: string;
  subject: string;
  subjectType: 'user' | 'role' | 'app';
  resourceType: 'tool' | 'server' | 'resource' | 'prompt';
  resourceId: string;
  actions: ('invoke' | 'read' | 'admin')[];
  effect: 'allow' | 'deny';
  priority: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PermissionRuleCreateRequest {
  name: string;
  subject: string;
  subjectType: PermissionRule['subjectType'];
  resourceType: PermissionRule['resourceType'];
  resourceId: string;
  actions: PermissionRule['actions'];
  effect: PermissionRule['effect'];
  priority: number;
  enabled: boolean;
}

// ============ Resource (P3-MCPHUB-06) ============

export interface McpResource {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface McpResourceCreateRequest {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  content: string;
  tags?: string[];
}

// ============ Prompt (P3-MCPHUB-07) ============

export interface PromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  role: string;
  template: string;
  variables: PromptVariable[];
  category: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptTemplateCreateRequest {
  name: string;
  description?: string;
  role: PromptTemplate['role'];
  template: string;
  variables: PromptVariable[];
  category: string;
  tags?: string[];
}

// ============ Audit (P3-MCPHUB-08) ============

export interface AuditLog {
  id: string;
  timestamp: string;
  toolId: string;
  toolName: string;
  serverId?: string;
  clientId?: string;
  userId?: string;
  method: string;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorCode?: string;
  errorMessage?: string;
  traceId?: string;
}

export interface AuditLogDetail extends AuditLog {
  requestParams?: Record<string, unknown>;
  response?: unknown;
  stackTrace?: string;
}

// ============ Integration (P3-MCPHUB-09) ============

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  enabled: boolean;
}

export interface Integration {
  id: string;
  name: string;
  platform: 'cursor' | 'copilot' | 'claude-desktop' | 'cline' | 'windsurf' | 'custom';
  configSnippet: string;
  endpoint: string;
  apiKeyId?: string;
  enabled: boolean;
  createdAt?: string;
}

export interface IntegrationCreateRequest {
  name: string;
  platform: Integration['platform'];
  configSnippet: string;
  endpoint: string;
  apiKeyId?: string;
  enabled: boolean;
}

// ============ Overview (V12-03) ============

export interface OverviewServerStats {
  total: number;
  online: number;
  offline: number;
  error: number;
}

export interface OverviewToolStats {
  total: number;
  enabled: number;
  disabled: number;
}

export interface OverviewCallStats {
  todayCalls: number;
  successRate: number;
  avgDuration: number;
}

export interface OverviewTokenStats {
  todayInputTokens: number;
  todayOutputTokens: number;
  todayTotalTokens: number;
}

export interface OverviewErrorAlert {
  id: string;
  toolCode: string;
  status: string;
  level: 'error' | 'warning';
  errorMessage?: string;
  calledAt: string;
  traceId?: string;
}

export interface OverviewTopTool {
  toolCode: string;
  count: number;
}

export interface OverviewTrendPoint {
  time: string;
  count: number;
  tokens: number;
}

export interface OverviewResponse {
  serverStats: OverviewServerStats;
  toolStats: OverviewToolStats;
  callStats: OverviewCallStats;
  tokenStats: OverviewTokenStats;
  errorAlerts: OverviewErrorAlert[];
  topTools: OverviewTopTool[];
  callTrend: OverviewTrendPoint[];
  tokenTrend: OverviewTrendPoint[];
}

// ============ Audit Statistics / Analytics / Alert Rules (V13-05) ============

export interface AuditLogStatistics {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  byStatus: Record<string, number>;
  byTool: Record<string, number>;
}

export interface TrendPoint {
  time: string;
  count: number;
  errorCount: number;
  tokenCount: number;
  avgDuration: number;
}

export interface AnalyticsItem {
  dimension: string;
  dimensionKey: string;
  count: number;
  errorCount: number;
  tokenCount: number;
  avgDuration: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
  notifyChannels: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertRuleCreateRequest {
  name: string;
  metric: string;
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
  notifyChannels?: string[];
}

// ============ ABAC Policy (V13-06) ============

export type PolicySubjectType = 'USER' | 'APP';
export type PolicyEffect = 'ALLOW' | 'DENY';

export interface Policy {
  id: string;
  name: string;
  subjectType: PolicySubjectType;
  subjectId: string;
  resourceType: string;
  resourceIds: string[];
  action: string;
  effect: PolicyEffect;
  conditionExpression?: string;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  priority: number;
  enabled: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PolicyCreateRequest {
  name: string;
  subjectType: PolicySubjectType;
  subjectId: string;
  resourceType: string;
  resourceIds: string[];
  action: string;
  effect: PolicyEffect;
  conditionExpression?: string;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  priority: number;
  enabled: boolean;
}

export interface PolicyMatrixSubject {
  subjectId: string;
  subjectName: string;
  subjectType: PolicySubjectType;
}

export interface PolicyMatrixColumn {
  toolId: string;
  toolCode: string;
  toolName: string;
}

export type MatrixCellEffect = 'allow' | 'deny' | 'inherit';

export interface PolicyMatrixRow {
  subject: PolicyMatrixSubject;
  cells: Record<string, MatrixCellEffect>;
}

export interface PolicyMatrix {
  type: string;
  action: string;
  columns: PolicyMatrixColumn[];
  rows: PolicyMatrixRow[];
}

export interface ConditionSyntax {
  syntax: string;
  description: string;
  examples: string[];
  variables: string[];
}

// ============ IDE Config & Connection Monitor (V13-07) ============

export type IdeType = 'cursor' | 'claude_desktop' | 'claude_code' | 'copilot' | 'generic';

export interface IdeConfigResponse {
  ideType: IdeType;
  fileName: string;
  contentType: string;
  content: string;
}

export interface ConnectionStatus {
  id: string;
  name: string;
  type: 'server' | 'client';
  transportType?: string;
  status: string;
  connectionStatus: 'online' | 'offline' | 'error';
  lastHeartbeatAt?: string;
  lastErrorMessage?: string;
  errorRate?: number;
  latencyMs?: number;
  endpoint?: string;
}

export interface ConnectionMonitorSummary {
  totalServers: number;
  onlineServers: number;
  offlineServers: number;
  errorServers: number;
  totalClients: number;
  connectedClients: number;
  disconnectedClients: number;
  errorClients: number;
}

export interface ConnectionMonitorResponse {
  summary: ConnectionMonitorSummary;
  servers: ConnectionStatus[];
  clients: ConnectionStatus[];
}

// ============ External Agent / Trust / Collaboration Audit (V14-09) ============

export interface ExternalAgent {
  id: string;
  name: string;
  description?: string;
  endpoint: string;
  protocolType: 'MCP' | 'A2A' | 'BOTH';
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  trustLevel: 'TRUSTED' | 'UNTRUSTED' | 'BLOCKED';
  authType?: 'none' | 'apikey' | 'oauth2' | 'bearer';
  authConfig?: string;
  capabilities?: string;
  lastConnectedAt?: string;
  lastErrorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExternalAgentCreateRequest {
  name: string;
  description?: string;
  endpoint: string;
  protocolType: ExternalAgent['protocolType'];
  authType?: ExternalAgent['authType'];
  authConfig?: string;
  capabilities?: string;
}

export interface ExternalAgentTestResult {
  success: boolean;
  responseTimeMs?: number;
  message?: string;
  protocolType?: string;
}

export interface AgentTrust {
  id: string;
  agentId: string;
  agentName?: string;
  trustLevel: 'TRUSTED' | 'UNTRUSTED' | 'BLOCKED';
  reason?: string;
  allowedOperations?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentTrustCreateRequest {
  agentId: string;
  trustLevel: AgentTrust['trustLevel'];
  reason?: string;
  allowedOperations?: string;
  expiresAt?: string;
}

export interface CollaborationAudit {
  id: string;
  callerId: string;
  callerType: 'AGENT' | 'USER' | 'APP';
  calleeId: string;
  calleeType: 'AGENT' | 'SERVER' | 'TOOL';
  operation?: string;
  protocolType: 'MCP' | 'A2A';
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  durationMs: number;
  requestPayload?: string;
  responsePayload?: string;
  errorMessage?: string;
  traceId?: string;
  calledAt?: string;
}

export interface CollaborationAuditCreateRequest {
  callerId: string;
  callerType: CollaborationAudit['callerType'];
  calleeId: string;
  calleeType: CollaborationAudit['calleeType'];
  operation?: string;
  protocolType: CollaborationAudit['protocolType'];
  status: CollaborationAudit['status'];
  durationMs: number;
  requestPayload?: string;
  responsePayload?: string;
  errorMessage?: string;
  traceId?: string;
  calledAt?: string;
}
