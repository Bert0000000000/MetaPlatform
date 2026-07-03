/**
 * MetaPlatform API Client
 * Connects to the backend API at /api/*
 */

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
  const token = localStorage.getItem("mp_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error || `API error: ${res.status}`);
  }
  return json.data as T;
}

// ─── Auth ──────────────────────────────────────────────────
export const authApi = {
  login: (email: string, _password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: _password }),
    }),
  me: () => request<User>("/auth/me"),
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
  listRelations: () => request<OntologyRelation[]>("/ontology/relations"),
  createRelation: (data: Partial<OntologyRelation>) =>
    request<OntologyRelation>("/ontology/relations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
  listLogs: (limit = 20, offset = 0) =>
    request<AuditLog[]>(
      `/admin/logs?limit=${limit}&offset=${offset}`,
    ),
  listConfig: () =>
    request<SystemConfig[]>("/admin/config"),
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
  id: number;
  name: string;
  code: string;
  userCount: number;
  permissionCount: number;
  desc: string;
  builtin: boolean;
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
