/** Digital employees / Agents module API. */
import { apiClient } from '../client';
import { ADMIN_BASE, unwrap } from '../admin/base';

export interface AgentRow {
  id: string;
  name: string;
  type: string;
  typeBadge: string;
  status: string;
  statusBadge: string;
  tasks: number;
  successRate: string;
  lastActive: string;
}

export interface AgentTemplate {
  icon: string;
  title: string;
  desc: string;
}

export interface AgentKnowledgeLink {
  id: string;
  agent: string;
  source: string;
  status: string;
  syncedAt: string;
}

export interface AgentTask {
  id: string;
  title: string;
  owner: string;
  status: string;
  priority: string;
  createdAt: string;
  due: string;
}

export interface AgentCollab {
  id: string;
  name: string;
  members: number;
  status: string;
  lastActivity: string;
  output: string;
}

export interface AgentEvaluation {
  id: string;
  agent: string;
  period: string;
  total: number;
  avgScore: number;
  successRate: number;
  trend: 'up' | 'down' | 'flat';
}

const BASE = `${ADMIN_BASE}/agents`;

/** Real list endpoint falls back to [] until the backend lands. */
export async function listAgents(): Promise<AgentRow[]> {
  try {
    return unwrap<AgentRow[]>(await apiClient.get(`${BASE}`));
  } catch {
    return [];
  }
}

export async function listAgentTemplates(): Promise<AgentTemplate[]> {
  try {
    return unwrap<AgentTemplate[]>(await apiClient.get(`${BASE}/templates`));
  } catch {
    return [];
  }
}

export async function listAgentKnowledge(agentId?: string): Promise<AgentKnowledgeLink[]> {
  try {
    return unwrap<AgentKnowledgeLink[]>(await apiClient.get(`${BASE}/knowledge`, { params: { agentId } }));
  } catch {
    return [];
  }
}

export async function listAgentTasks(agentId?: string): Promise<AgentTask[]> {
  try {
    return unwrap<AgentTask[]>(await apiClient.get(`${BASE}/tasks`, { params: { agentId } }));
  } catch {
    return [];
  }
}

export async function listAgentCollabs(): Promise<AgentCollab[]> {
  try {
    return unwrap<AgentCollab[]>(await apiClient.get(`${BASE}/collabs`));
  } catch {
    return [];
  }
}

export async function listAgentEvaluations(agentId?: string): Promise<AgentEvaluation[]> {
  try {
    return unwrap<AgentEvaluation[]>(await apiClient.get(`${BASE}/evaluations`, { params: { agentId } }));
  } catch {
    return [];
  }
}
