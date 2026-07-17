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
}

// ============ MCP Server (P3-MCPHUB-02) ============

export interface McpServer {
  id: string;
  name: string;
  code: string;
  description?: string;
  transport: 'stdio' | 'sse' | 'http';
  endpoint: string;
  toolIds: string[];
  enabled: boolean;
  status: 'online' | 'offline' | 'error';
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
  toolIds: string[];
  enabled: boolean;
  tags?: string[];
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

// ============ MCP Client (P3-MCPHUB-04) ============

export interface McpClient {
  id: string;
  name: string;
  endpoint: string;
  authType: 'none' | 'apikey' | 'oauth2';
  apiKey?: string;
  status: 'connected' | 'disconnected' | 'error';
  discoveredTools: number;
  lastSyncAt?: string;
  createdAt?: string;
}

export interface McpClientCreateRequest {
  name: string;
  endpoint: string;
  authType: McpClient['authType'];
  apiKey?: string;
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
