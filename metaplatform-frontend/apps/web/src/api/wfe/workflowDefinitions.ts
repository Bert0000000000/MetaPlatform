import { createApiClient } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api/v1' });
const data = <T>(response: { data: T }): T => response.data;

export type PlanNodeType = 'start' | 'action' | 'end';

export interface PlanNode {
  id: string;
  type: PlanNodeType;
  action_type?: string;
  input?: Record<string, unknown>;
  requires_confirmation?: boolean;
}

export interface PlanEdge {
  source: string;
  target: string;
}

export interface PlanDraft {
  nodes: PlanNode[];
  edges: PlanEdge[];
}

export interface PlanValidationIssue {
  node_id: string | null;
  field: string;
  code: string;
  message: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  draft_plan: PlanDraft;
  version: number;
  status: string;
  published_version: number | null;
  published_at: string;
  published_by: string;
  validation?: { valid: boolean; issues: PlanValidationIssue[] };
}

export interface ActionTypeDescriptor {
  action_type: string;
  required_inputs: string[];
  requires_confirmation: boolean;
}

export interface NodeRegistryItem {
  type: PlanNodeType;
  label: string;
  editable_fields: string[];
  action_types?: ActionTypeDescriptor[];
}

export interface WorkflowRunStarted {
  run_id: string;
  status: string;
  status_url: string;
  definition_version: string;
}

export async function getWorkflowDefinition(definitionId: string): Promise<WorkflowDefinition> {
  return data(await client.get<WorkflowDefinition>(`/workflow-definitions/${definitionId}`));
}

export async function saveWorkflowDefinition(
  definitionId: string,
  payload: Pick<WorkflowDefinition, 'name' | 'version' | 'draft_plan'>,
): Promise<WorkflowDefinition> {
  return data(await client.put<WorkflowDefinition>(`/workflow-definitions/${definitionId}`, payload));
}

export async function publishWorkflowDefinition(definitionId: string, idempotencyKey: string): Promise<WorkflowDefinition> {
  return data(await client.post<WorkflowDefinition>(`/workflow-definitions/${definitionId}:publish`, undefined, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }));
}

export async function getNodeRegistry(): Promise<NodeRegistryItem[]> {
  const response = await client.get<{ items: NodeRegistryItem[] }>('/workflow-definitions/node-registry');
  return response.data.items;
}

export async function startWorkflowRun(
  definitionId: string,
  idempotencyKey: string,
  input: Record<string, unknown> = {},
): Promise<WorkflowRunStarted> {
  return data(await client.post<WorkflowRunStarted>(`/workflows/${definitionId}/runs`, { input }, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }));
}
