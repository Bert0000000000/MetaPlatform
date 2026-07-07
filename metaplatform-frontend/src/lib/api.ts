/**
 * MetaPlatform API Client
 * Connects to the backend API at /api/*
 */

import { getToken, logout, type AuthUser } from "./auth";

const BASE_URL = "/api";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    logout();
    throw new Error("Unauthorized — redirecting to login");
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error || `API error: ${res.status}`);
  }
  return json.data as T;
}

// ─── Auth ──────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { name: string; email: string; password: string; department?: string }) =>
    request<{ user: AuthUser; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  me: () => request<AuthUser>("/auth/me"),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ message: string }>("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
};

// ─── Applications ─────────────────────────────────────────
export const appsApi = {
  list: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : "";
    return request<Application[]>(`/apps${qs}`);
  },
  get: (id: string) => request<Application>(`/apps/${id}`),
  create: (data: Partial<Application>) =>
    request<Application>("/apps", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Application>) =>
    request<Application>(`/apps/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/apps/${id}`, { method: "DELETE" }),
  stats: (id: string) =>
    request<{ objects: number; pages: number; flows: number }>(
      `/apps/${id}/stats`,
    ),
  publish: (id: string) =>
    request<Application & { published_url: string; app_slug: string }>(
      `/apps/${id}/publish`,
      { method: "POST" },
    ),
  unpublish: (id: string) =>
    request<Application>(`/apps/${id}/unpublish`, { method: "POST" }),
  listPublished: () => request<Application[]>("/apps/published"),
  getBySlug: (slug: string) => request<Application>(`/apps/slug/${slug}`),

  // App Pages (nested under /api/apps/:id/pages)
  listPages: (appId: string) =>
    request<AppPage[]>(`/apps/${appId}/pages`),
  createPage: (appId: string, data: Partial<AppPage>) =>
    request<AppPage>(`/apps/${appId}/pages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePage: (appId: string, pageId: string, data: Partial<AppPage>) =>
    request<AppPage>(`/apps/${appId}/pages/${pageId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePage: (appId: string, pageId: string) =>
    request(`/apps/${appId}/pages/${pageId}`, { method: "DELETE" }),

  // App Config (nested under /api/apps/:id/config)
  listConfig: (appId: string) =>
    request<AppConfigItem[]>(`/apps/${appId}/config`),
  createConfig: (appId: string, data: Partial<AppConfigItem>) =>
    request<AppConfigItem>(`/apps/${appId}/config`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateConfig: (appId: string, key: string, data: Partial<AppConfigItem>) =>
    request<AppConfigItem>(`/apps/${appId}/config/${key}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Gray release
  getGrayConfig: (appId: string) =>
    request<{ strategy: string; percentage: number; tenants: string[]; userGroups: string[] } | null>(
      `/apps/${appId}/gray`,
    ),
  setGrayConfig: (appId: string, data: { strategy: string; percentage: number; tenants?: string[]; userGroups?: string[] }) =>
    request<{ strategy: string; percentage: number }>(`/apps/${appId}/gray`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rollback: (appId: string, data: { versionId: string }) =>
    request<{ message: string }>(`/apps/${appId}/rollback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  activity: (appId: string, limit = 10) =>
    request<any[]>(`/apps/${appId}/activity?limit=${limit}`),
};

// ─── Pages (standalone) ──────────────────────────────────
export const pagesApi = {
  list: (appId?: string) => {
    const qs = appId ? `?app_id=${appId}` : "";
    return request<AppPage[]>(`/pages${qs}`);
  },
  get: (id: string) => request<AppPage>(`/pages/${id}`),
  create: (data: Partial<AppPage>) =>
    request<AppPage>("/pages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<AppPage>) =>
    request<AppPage>(`/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/pages/${id}`, { method: "DELETE" }),
  reorder: (data: { items: Array<{ id: string; sort_order: number }> }) =>
    request<{ updated: number }>("/pages/reorder", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Ontology ─────────────────────────────────────────────
export const ontologyApi = {
  listObjects: (appId?: string) => {
    const qs = appId ? `?app_id=${appId}` : "";
    return request<OntologyObject[]>(`/ontology/objects${qs}`);
  },
  getObject: (id: string) =>
    request<OntologyObject & { properties: OntologyProperty[] }>(
      `/ontology/objects/${id}`,
    ),
  createObject: (data: Partial<OntologyObject>) =>
    request<OntologyObject>("/ontology/objects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateObject: (id: string, data: Partial<OntologyObject>) =>
    request<OntologyObject>(`/ontology/objects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteObject: (id: string) =>
    request(`/ontology/objects/${id}`, { method: "DELETE" }),
  listProperties: (objectId: string) =>
    request<OntologyProperty[]>(`/ontology/objects/${objectId}/properties`),
  createProperty: (objectId: string, data: Partial<OntologyProperty>) =>
    request<OntologyProperty>(
      `/ontology/objects/${objectId}/properties`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  deleteProperty: (id: string) =>
    request(`/ontology/properties/${id}`, { method: "DELETE" }),
  updateProperty: (id: string, data: Partial<OntologyProperty>) =>
    request<OntologyProperty>(`/ontology/properties/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listRelations: () => request<OntologyRelation[]>("/ontology/relations"),
  createRelation: (data: Partial<OntologyRelation>) =>
    request<OntologyRelation>("/ontology/relations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Actions
  listActions: (objectId?: string) => {
    const qs = objectId ? `?object_id=${objectId}` : "";
    return request<OntologyAction[]>(`/ontology/actions${qs}`);
  },
  createAction: (data: Partial<OntologyAction>) =>
    request<OntologyAction>("/ontology/actions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAction: (id: string, data: Partial<OntologyAction>) =>
    request<OntologyAction>(`/ontology/actions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAction: (id: string) =>
    request(`/ontology/actions/${id}`, { method: "DELETE" }),

  // Functions
  listFunctions: (objectId?: string) => {
    const qs = objectId ? `?object_id=${objectId}` : "";
    return request<OntologyFunction[]>(`/ontology/functions${qs}`);
  },
  createFunction: (data: Partial<OntologyFunction>) =>
    request<OntologyFunction>("/ontology/functions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFunction: (id: string, data: Partial<OntologyFunction>) =>
    request<OntologyFunction>(`/ontology/functions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteFunction: (id: string) =>
    request(`/ontology/functions/${id}`, { method: "DELETE" }),

  // Rules
  listRules: (objectId?: string) => {
    const qs = objectId ? `?object_id=${objectId}` : "";
    return request<OntologyRule[]>(`/ontology/rules${qs}`);
  },
  createRule: (data: Partial<OntologyRule>) =>
    request<OntologyRule>("/ontology/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRule: (id: string, data: Partial<OntologyRule>) =>
    request<OntologyRule>(`/ontology/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRule: (id: string) =>
    request(`/ontology/rules/${id}`, { method: "DELETE" }),

  // Security Rules
  listSecurityRules: () => request<any[]>("/ontology/security-rules"),
  createSecurityRule: (data: any) => request("/ontology/security-rules", { method: "POST", body: JSON.stringify(data) }),
  updateSecurityRule: (id: number, data: any) => request(`/ontology/security-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSecurityRule: (id: number) => request(`/ontology/security-rules/${id}`, { method: "DELETE" }),

  // Auto Numbers
  listAutoNumbers: () => request<any[]>("/ontology/auto-numbers"),
  createAutoNumber: (data: any) => request("/ontology/auto-numbers", { method: "POST", body: JSON.stringify(data) }),
};

// ─── Processes ────────────────────────────────────────────
export const processesApi = {
  list: (params?: { type?: string; app_id?: string }) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request<ProcessDefinition[]>(`/processes${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<ProcessDefinition>(`/processes/${id}`),
  create: (data: Partial<ProcessDefinition>) =>
    request<ProcessDefinition>("/processes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<ProcessDefinition>) =>
    request<ProcessDefinition>(`/processes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/processes/${id}`, { method: "DELETE" }),
  listInstances: () =>
    request<ProcessInstance[]>("/processes/instances"),
  startInstance: (data: Partial<ProcessInstance>) =>
    request<ProcessInstance>("/processes/instances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInstance: (id: string, data: Partial<ProcessInstance>) =>
    request<ProcessInstance>(`/processes/instances/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Data ─────────────────────────────────────────────────
export const dataApi = {
  listSources: () => request<DataSource[]>("/data/sources"),
  createSource: (data: Partial<DataSource>) =>
    request<DataSource>("/data/sources", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSource: (id: string, data: Partial<DataSource>) =>
    request<DataSource>(`/data/sources/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSource: (id: string) =>
    request(`/data/sources/${id}`, { method: "DELETE" }),
  testConnection: (id: string) =>
    request<{ status: string; message: string }>(
      `/data/sources/${id}/test`,
    ),
  listMetrics: () => request<DataMetric[]>("/data/metrics"),
  createMetric: (data: Partial<DataMetric>) =>
    request<DataMetric>("/data/metrics", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ETL Tasks
  listETLTasks: () => request<any[]>("/data/etl-tasks"),

  // Quality Rules
  listQualityRules: () => request<any[]>("/data/quality-rules"),

  // Realtime Events
  listRealtimeEvents: () => request<any[]>("/data/realtime-events"),
};

// ─── Knowledge ────────────────────────────────────────────
export const knowledgeApi = {
  listDocuments: (category?: string) => {
    const qs = category ? `?category=${category}` : "";
    return request<KnowledgeDocument[]>(`/knowledge/documents${qs}`);
  },
  getDocument: (id: string) =>
    request<KnowledgeDocument>(`/knowledge/documents/${id}`),
  createDocument: (data: Partial<KnowledgeDocument>) =>
    request<KnowledgeDocument>("/knowledge/documents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDocument: (id: string, data: Partial<KnowledgeDocument>) =>
    request<KnowledgeDocument>(`/knowledge/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDocument: (id: string) =>
    request(`/knowledge/documents/${id}`, { method: "DELETE" }),
  search: (query: string) =>
    request<KnowledgeDocument[]>(
      `/knowledge/search?q=${encodeURIComponent(query)}`,
    ),
  categories: () =>
    request<{ category: string; count: number }[]>(
      "/knowledge/categories",
    ),

  // Processing Jobs
  listProcessingJobs: () => request<any[]>("/knowledge/processing-jobs"),
  createProcessingJob: (data: any) => request("/knowledge/processing-jobs", { method: "POST", body: JSON.stringify(data) }),

  // Subscriptions
  listSubscriptions: () => request<any[]>("/knowledge/subscriptions"),
  createSubscription: (data: any) => request("/knowledge/subscriptions", { method: "POST", body: JSON.stringify(data) }),
  toggleSubscription: (id: number, data: any) => request(`/knowledge/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Agents ───────────────────────────────────────────────
export const agentsApi = {
  list: () => request<Agent[]>("/agents"),
  get: (id: string) => request<Agent>(`/agents/${id}`),
  create: (data: Partial<Agent>) =>
    request<Agent>("/agents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Agent>) =>
    request<Agent>(`/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request(`/agents/${id}`, { method: "DELETE" }),
  listTasks: (agentId: string) =>
    request<AgentTask[]>(`/agents/${agentId}/tasks`),
  createTask: (agentId: string, data: Partial<AgentTask>) =>
    request<AgentTask>(`/agents/${agentId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, data: Partial<AgentTask>) =>
    request<AgentTask>(`/agents/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Export ────────────────────────────────────────────────
export const exportApi = {
  generate: (appId: string, targets: string[]) =>
    request<{
      exportId: string;
      files: Array<{ name: string; content: string; type: string }>;
      status: string;
      app: { id: string; name: string; version: string };
      generatedAt: string;
    }>("/export/generate", {
      method: "POST",
      body: JSON.stringify({ appId, targets }),
    }),
  download: (appId: string, targets: string[]) =>
    request<{
      exportId: string;
      files: Array<{ name: string; content: string; type: string }>;
      status: string;
    }>("/export/download", {
      method: "POST",
      body: JSON.stringify({ appId, targets }),
    }),
  /** Download all generated files for an app from backend (GET endpoint) */
  downloadAll: (appId: string) =>
    request<{
      frontend: Array<{ name: string; content: string; type: string }>;
      backend: Array<{ name: string; content: string; type: string }>;
      database: Array<{ name: string; content: string; type: string }>;
      deploy: Array<{ name: string; content: string; type: string }>;
      app: { id: string; name: string; version: string };
    }>(`/export/download/${appId}`),
};

// ─── Admin ────────────────────────────────────────────────
export const adminApi = {
  listUsers: () => request<User[]>("/admin/users"),
  createUser: (data: Partial<User>) =>
    request<User>("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: Partial<User>) =>
    request<User>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    request(`/admin/users/${id}`, { method: "DELETE" }),
  listRoles: () => request<Role[]>("/admin/roles"),
  listDepartments: () =>
    request<Department[]>("/admin/departments"),
  createDepartment: (data: Partial<Department>) =>
    request<Department>("/admin/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDepartment: (id: string, data: Partial<Department>) =>
    request<Department>(`/admin/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDepartment: (id: string) =>
    request(`/admin/departments/${id}`, { method: "DELETE" }),
  listLogs: (limit = 20, offset = 0) =>
    request<AuditLog[]>(
      `/admin/logs?limit=${limit}&offset=${offset}`,
    ),
  listConfig: () =>
    request<SystemConfig[]>("/admin/config"),
  updateConfig: (key: string, data: Partial<SystemConfig>) =>
    request<SystemConfig>(`/admin/config/${key}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createLog: (data: Partial<AuditLog>) =>
    request<AuditLog>("/admin/logs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // LLM / AI Gateway config
  getLlmConfig: () =>
    request<{ key: string; label: string; description: string; placeholder: string; value: string }[]>(
      "/admin/llm-config",
    ),
  saveLlmConfig: (items: { key: string; value: string }[]) =>
    request<{ key: string; label: string; value: string }[]>("/admin/llm-config", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),
  testLlmConnection: () =>
    request<{ connected: boolean; reason?: string; baseUrl?: string; model?: string }>(
      "/admin/llm-config/status",
    ),
};

// ─── Messages ─────────────────────────────────────────────
export const messagesApi = {
  list: () => request<Message[]>("/messages"),
  markRead: (id: string) =>
    request<Message>(`/messages/${id}/read`, { method: "PUT" }),
  create: (data: Partial<Message>) =>
    request<Message>("/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unreadCount: () =>
    request<{ count: number }>("/messages/unread-count"),
};

// ─── Announcements ─────────────────────────────────────
export const announcementsApi = {
  list: async (limit = 10) => {
    const res = await request<any[]>(`/announcements?limit=${limit}`);
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/announcements", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
};

// ─── Todos ─────────────────────────────────────────────
export const todosApi = {
  list: async (params?: { user_id?: string; status?: string }) => {
    const qs = new URLSearchParams(params || {}).toString();
    const res = await request<any[]>(`/todos${qs ? `?${qs}` : ""}`);
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/todos", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
};

// ─── Quality ───────────────────────────────────────────
export const qualityApi = {
  listCases: async () => {
    const res = await request<any[]>("/quality/cases");
    return res;
  },
  createCase: async (data: any) => {
    const res = await request<any>("/quality/cases", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  runCase: async (id: string, result: string, duration: number) => {
    const res = await request<any>(`/quality/cases/${id}/run`, {
      method: "PUT",
      body: JSON.stringify({ result, duration }),
    });
    return res;
  },
  listBugs: async () => {
    const res = await request<any[]>("/quality/bugs");
    return res;
  },
  createBug: async (data: any) => {
    const res = await request<any>("/quality/bugs", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  updateBug: async (id: string, data: any) => {
    const res = await request<any>(`/quality/bugs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res;
  },
  getStats: async () => {
    const res = await request<{
      totalCases: number;
      passedCases: number;
      failedCases: number;
      passRate: string;
      totalBugs: number;
      openBugs: number;
    }>("/quality/stats");
    return res;
  },

  // Ontology Tests
  listOntologyTests: async () => {
    const res = await request<any[]>("/quality/ontology-tests");
    return res;
  },
  runOntologyTest: async (id: number) => {
    const res = await request<any>(`/quality/ontology-tests/${id}/run`, { method: "POST" });
    return res;
  },

  // UI Tests
  listUITests: async () => {
    const res = await request<any[]>("/quality/ui-tests");
    return res;
  },
  runUITest: async (id: number) => {
    const res = await request<any>(`/quality/ui-tests/${id}/run`, { method: "POST" });
    return res;
  },

  // Process Tests
  listProcessTests: async () => {
    const res = await request<any[]>("/quality/process-tests");
    return res;
  },
  runProcessTest: async (id: number) => {
    const res = await request<any>(`/quality/process-tests/${id}/run`, { method: "POST" });
    return res;
  },

  // AI Fixes
  listAIFixes: async () => {
    const res = await request<any[]>("/quality/ai-fixes");
    return res;
  },
  applyAIFix: async (id: number) => {
    const res = await request<any>(`/quality/ai-fixes/${id}/apply`, { method: "POST" });
    return res;
  },

  // Reports
  listReports: async () => {
    const res = await request<any[]>("/quality/reports");
    return res;
  },
  createReport: async (data: any) => {
    const res = await request<any>("/quality/reports", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
};

// ─── Versions ──────────────────────────────────────────
export const versionsApi = {
  listByApp: async (appId: string) => {
    const res = await request<any[]>(`/versions/app/${appId}`);
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/versions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
};

// ─── Triggers ──────────────────────────────────────────
export const triggersApi = {
  list: async () => {
    const res = await request<any[]>("/triggers");
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/triggers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  delete: async (id: string) => {
    const res = await request<any>(`/triggers/${id}`, { method: "DELETE" });
    return res;
  },
};

// ─── Architecture ──────────────────────────────────────
export const architectureApi = {
  getSection: (section: "ba" | "aa" | "da" | "ta") =>
    request<Record<string, unknown>>(`/architecture/${section}`),
  updateSection: (section: "ba" | "aa" | "da" | "ta", data: Record<string, unknown>) =>
    request(`/architecture/${section}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Export History ─────────────────────────────────────
export const exportHistoryApi = {
  list: async () => {
    const res = await request<any[]>("/export-history");
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/export-history", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
};

// ─── Knowledge Q&A ─────────────────────────────────────
export const knowledgeQaApi = {
  list: async (limit = 20) => {
    const res = await request<any[]>(`/knowledge/qa?limit=${limit}`);
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/knowledge/qa", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
};

// ─── Knowledge Graph ───────────────────────────────────
export const knowledgeGraphApi = {
  listNodes: async () => {
    const res = await fetch(`${BASE_URL}/knowledge/graph/nodes`, {
      headers: { "Authorization": `Bearer ${getToken()}` },
    });
    const json = await res.json();
    return json.data;
  },
  createNode: async (data: any) => {
    const res = await fetch(`${BASE_URL}/knowledge/graph/nodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },
  listEdges: async () => {
    const res = await fetch(`${BASE_URL}/knowledge/graph/edges`, {
      headers: { "Authorization": `Bearer ${getToken()}` },
    });
    const json = await res.json();
    return json.data;
  },
  createEdge: async (data: any) => {
    const res = await fetch(`${BASE_URL}/knowledge/graph/edges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`,
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.data;
  },
};

// ─── Market ────────────────────────────────────────────
export const marketApi = {
  listTemplates: async (category?: string) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    const res = await request<any[]>(`/market/templates${qs}`);
    return res;
  },
  createTemplate: async (data: any) => {
    const res = await request<any>("/market/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  installTemplate: async (id: string) => {
    const res = await request<any>(`/market/templates/${id}/install`, {
      method: "POST",
    });
    return res;
  },

  // Developers
  listDevelopers: async () => {
    const res = await request<any[]>("/market/developers");
    return res;
  },

  // Skills
  listSkills: async () => {
    const res = await request<any[]>("/market/skills");
    return res;
  },

  // Workflow Templates
  listWorkflowTemplates: async () => {
    const res = await request<any[]>("/market/workflow-templates");
    return res;
  },

  // Knowledge Packages
  listKnowledgePackages: async () => {
    const res = await request<any[]>("/market/knowledge-packages");
    return res;
  },

  // API Library
  listAPILibrary: async () => {
    const res = await request<any[]>("/market/api-library");
    return res;
  },
};

// ─── Filesystem (WebIDE) ──────────────────────────────
export const filesystemApi = {
  listFiles: async (params: { app_id?: string; parent_id?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
    ).toString();
    const res = await request<any[]>(`/filesystem/files${qs ? `?${qs}` : ""}`);
    return res;
  },
  createFile: async (data: any) => {
    const res = await request<any>("/filesystem/files", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  updateFile: async (id: string, data: any) => {
    const res = await request<any>(`/filesystem/files/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res;
  },
  deleteFile: async (id: string) => {
    const res = await request<any>(`/filesystem/files/${id}`, {
      method: "DELETE",
    });
    return res;
  },
};

// ─── Orchestrations ────────────────────────────────────
export const orchestrationsApi = {
  list: async () => {
    const res = await request<any[]>("/orchestrations");
    return res;
  },
  get: async (id: string) => {
    const res = await request<any>(`/orchestrations/${id}`);
    return res;
  },
  create: async (data: any) => {
    const res = await request<any>("/orchestrations", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res;
  },
  update: async (id: string, data: any) => {
    const res = await request<any>(`/orchestrations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res;
  },
  delete: async (id: string) => {
    const res = await request<any>(`/orchestrations/${id}`, { method: "DELETE" });
    return res;
  },
};

// ─── Types ────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  avatar?: string;
  last_login?: string;
}

export interface Application {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  icon?: string;
  version: string;
  owner_id?: string;
  objects_count: number;
  pages_count: number;
  flows_count: number;
  app_slug?: string;
  published_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OntologyObject {
  id: string;
  app_id?: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  status: string;
  properties_count: number;
  actions_count: number;
  rules_count: number;
}

export interface OntologyProperty {
  id: string;
  object_id: string;
  name: string;
  label: string;
  type: string;
  required: number;
  unique_field: number;
  default_value?: string;
  description?: string;
}

export interface OntologyRelation {
  id: string;
  source_object_id: string;
  target_object_id: string;
  type: string;
  label?: string;
  description?: string;
}

export interface OntologyAction {
  id: string;
  object_id?: string;
  name: string;
  type: string;
  trigger_type: string;
  config?: string;
  status: string;
  created_at?: string;
}

export interface OntologyFunction {
  id: string;
  object_id?: string;
  name: string;
  type: string;
  expression?: string;
  description?: string;
  status: string;
  created_at?: string;
}

export interface OntologyRule {
  id: string;
  object_id?: string;
  name: string;
  type: string;
  condition_expr?: string;
  action?: string;
  status: string;
  created_at?: string;
}

export interface ProcessDefinition {
  id: string;
  app_id?: string;
  name: string;
  type: string;
  status: string;
  version: number;
  bpmn_xml?: string;
  description?: string;
}

export interface ProcessInstance {
  id: string;
  definition_id: string;
  status: string;
  initiator_id?: string;
  variables?: string;
  started_at: string;
  ended_at?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  database_name?: string;
  status: string;
  description?: string;
}

export interface DataMetric {
  id: string;
  name: string;
  value: string;
  unit?: string;
  trend?: number;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  type: string;
  category?: string;
  content?: string;
  file_size?: number;
  status: string;
  tags?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  model?: string;
  skills?: string;
  owner_id?: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  title: string;
  status: string;
  input?: string;
  output?: string;
}

export interface Role {
  id: string;
  name: string;
  label?: string;
  code?: string;
  permissions?: string[];
  userCount?: number;
  permissionCount?: number;
  desc?: string;
  builtin?: boolean;
}

export interface Department {
  id: number;
  name: string;
  parent: string;
  count: number;
  leader: string;
  icon: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  module?: string;
  target?: string;
  detail?: string;
  result: string;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content?: string;
  read: number;
  link?: string;
  created_at: string;
}

export interface SystemConfig {
  key: string;
  value: string;
  description?: string;
}

export interface AppPage {
  id: string;
  app_id: string;
  name: string;
  type: string;
  icon?: string;
  status: string;
  config?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AppConfigItem {
  id: string;
  app_id: string;
  key: string;
  value?: string;
  description?: string;
  updated_at?: string;
}

export interface Orchestration {
  id: string;
  name: string;
  type: string;
  adapters: string[];
  status: "active" | "draft" | "error";
  trigger_type: string;
  config?: string;
  last_run?: string;
  created_at?: string;
  updated_at?: string;
}
