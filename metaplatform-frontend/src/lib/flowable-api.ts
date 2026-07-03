const FLOWABLE_BASE = "/api/flowable";

async function flowableRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${FLOWABLE_BASE}${path}`, { ...options, headers });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `Flowable API error: ${res.status}`);
  return json.data as T;
}

export const flowableApi = {
  // Process Definitions
  deployProcess: (data: { name: string; bpmnXml: string; tenantId?: string }) =>
    flowableRequest<FlowableDeployment>("/process-definitions/deploy", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listProcessDefinitions: (params?: { latest?: boolean; tenantId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.latest) qs.set("latest", "true");
    if (params?.tenantId) qs.set("tenantId", params.tenantId);
    return flowableRequest<FlowableProcessDefinition[]>(`/process-definitions?${qs}`);
  },
  getProcessDefinition: (id: string) =>
    flowableRequest<FlowableProcessDefinition>(`/process-definitions/${id}`),
  getProcessXml: (id: string) =>
    flowableRequest<{ bpmn20Xml: string }>(`/process-definitions/${id}/xml`),
  deleteDeployment: (id: string) =>
    flowableRequest<void>(`/deployments/${id}`, { method: "DELETE" }),

  // Process Instances
  startProcess: (data: { processDefinitionId: string; variables?: Record<string, unknown>; businessKey?: string }) =>
    flowableRequest<FlowableProcessInstance>("/process-instances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listProcessInstances: (params?: { processDefinitionId?: string; finished?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.processDefinitionId) qs.set("processDefinitionId", params.processDefinitionId);
    if (params?.finished) qs.set("finished", "true");
    return flowableRequest<FlowableProcessInstance[]>(`/process-instances?${qs}`);
  },
  getProcessInstance: (id: string) =>
    flowableRequest<FlowableProcessInstance>(`/process-instances/${id}`),
  deleteProcessInstance: (id: string) =>
    flowableRequest<void>(`/process-instances/${id}`, { method: "DELETE" }),

  // Tasks
  listTasks: (params?: { assignee?: string; processInstanceId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.assignee) qs.set("assignee", params.assignee);
    if (params?.processInstanceId) qs.set("processInstanceId", params.processInstanceId);
    return flowableRequest<FlowableTask[]>(`/tasks?${qs}`);
  },
  completeTask: (taskId: string, variables?: Record<string, unknown>) =>
    flowableRequest<void>(`/tasks/${taskId}/complete`, {
      method: "POST",
      body: JSON.stringify({ variables }),
    }),
  claimTask: (taskId: string, userId: string) =>
    flowableRequest<void>(`/tasks/${taskId}/claim`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  delegateTask: (taskId: string, userId: string) =>
    flowableRequest<void>(`/tasks/${taskId}/delegate`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  // History
  listHistoryInstances: (params?: { processDefinitionId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.processDefinitionId) qs.set("processDefinitionId", params.processDefinitionId);
    return flowableRequest<FlowableHistoricInstance[]>(`/history/process-instances?${qs}`);
  },
};

// Types
export interface FlowableDeployment {
  id: string;
  name: string;
  deploymentTime: string;
  tenantId?: string;
}

export interface FlowableProcessDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
  deploymentId: string;
  tenantId?: string;
  suspended: boolean;
}

export interface FlowableProcessInstance {
  id: string;
  processDefinitionId: string;
  processDefinitionKey: string;
  businessKey?: string;
  startTime: string;
  endTime?: string;
  startUserId?: string;
  variables?: Array<{ name: string; value: unknown }>;
}

export interface FlowableTask {
  id: string;
  name: string;
  assignee?: string;
  createTime: string;
  dueDate?: string;
  processInstanceId: string;
  processDefinitionId: string;
  taskDefinitionKey: string;
  description?: string;
  priority?: number;
}

export interface FlowableHistoricInstance {
  id: string;
  processDefinitionId: string;
  processDefinitionKey: string;
  startTime: string;
  endTime?: string;
  durationInMillis?: number;
  startUserId?: string;
}
