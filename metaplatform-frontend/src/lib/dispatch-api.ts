/**
 * Agent Dispatch API — SuperAI cross-module orchestration
 * Routes natural language commands to the appropriate module agents
 */

const DISPATCH_BASE = "/api/dispatch";

export interface DispatchAgent {
  id: string;
  name: string;
  icon: string;
  module: string;
  description: string;
  actions: string[];
}

export interface DispatchResult {
  type: "dispatch" | "chat";
  agents: DispatchedAgent[];
  results: DispatchActionResult[];
  response: string | null;
  message: string;
}

export interface DispatchedAgent {
  id: string;
  name: string;
  icon: string;
  module: string;
  status: "success" | "error";
}

export interface DispatchActionResult {
  type: "created" | "list" | "search" | "navigate" | "stats" | "error";
  module: string;
  data?: unknown;
  count?: number;
  id?: string;
  name?: string;
  link?: string;
  message?: string;
  error?: string;
}

export interface AgentExecuteResult {
  agent: { id: string; name: string; icon: string };
  action: string;
  results: DispatchActionResult[];
}

async function dispatchRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = localStorage.getItem("mp_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${DISPATCH_BASE}${path}`, { ...options, headers });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Dispatch error");
  return json.data as T;
}

export const dispatchApi = {
  /** Get list of all available agents */
  listAgents: () => dispatchRequest<DispatchAgent[]>("/agents"),

  /** Dispatch a natural language command — auto-detects intent and routes to agents */
  dispatch: (message: string) =>
    dispatchRequest<DispatchResult>("/dispatch", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  /** Dispatch directly to a specific agent */
  dispatchToAgent: (agentId: string, message?: string) =>
    dispatchRequest<DispatchResult>("/dispatch", {
      method: "POST",
      body: JSON.stringify({ agentId, message }),
    }),

  /** Execute a specific agent action */
  execute: (agentId: string, action: string, params?: Record<string, unknown>) =>
    dispatchRequest<AgentExecuteResult>("/execute", {
      method: "POST",
      body: JSON.stringify({ agentId, action, params }),
    }),
};
