/**
 * Frontend Flowable client.
 *
 * All endpoints here target Flowable 8 REST paths directly:
 *   /repository/process-definitions
 *   /repository/deployments       (POST via JSON; backend wraps to multipart)
 *   /runtime/process-instances
 *   /runtime/tasks
 *   /history/historic-process-instances
 *
 * The MetaPlatform API transparently forwards these to the engine
 * (see metaplatform-api/src/routes/flowable.js), wrapping the response
 * in { success, data }. We unwrap here.
 *
 * Flowable 8 dropped the flat /process-definitions and /tasks roots;
 * everything now lives under /repository, /runtime, or /history.
 */
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
  // ─── Process Definitions (Flowable 8: /repository/process-definitions) ───
  deployProcess: (data: { name: string; bpmnXml: string; tenantId?: string }) =>
    flowableRequest<FlowableDeployment>("/deployments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listProcessDefinitions: (params?: { latest?: boolean; tenantId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.latest) qs.set("latest", "true");
    if (params?.tenantId) qs.set("tenantId", params.tenantId);
    return flowableRequest<FlowableProcessDefinition[]>(`/repository/process-definitions?${qs}`);
  },
  getProcessDefinition: (id: string) =>
    flowableRequest<FlowableProcessDefinition>(`/repository/process-definitions/${id}`),
  getProcessXml: (id: string) =>
    flowableRequest<{ bpmn20Xml: string }>(`/repository/process-definitions/${id}/xml`),
  deleteDeployment: (id: string) =>
    flowableRequest<void>(`/repository/deployments/${id}`, { method: "DELETE" }),

  // ─── Process Instances (Flowable 8: /runtime/process-instances) ───
  startProcess: (data: { processDefinitionId: string; variables?: Record<string, unknown>; businessKey?: string }) => {
    // Flowable 8 expects variables as an array of {name, value, type?}
    // not a plain object. Convert Record → RestVariable[] here.
    const variablesArr = data.variables
      ? Object.entries(data.variables).map(([name, value]) => ({
          name,
          value,
        }))
      : undefined;
    return flowableRequest<FlowableProcessInstance>("/runtime/process-instances", {
      method: "POST",
      body: JSON.stringify({
        processDefinitionId: data.processDefinitionId,
        variables: variablesArr,
        businessKey: data.businessKey,
      }),
    });
  },
  listProcessInstances: (params?: { processDefinitionId?: string; finished?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.processDefinitionId) qs.set("processDefinitionId", params.processDefinitionId);
    if (params?.finished) qs.set("finished", "true");
    return flowableRequest<FlowableProcessInstance[]>(`/runtime/process-instances?${qs}`);
  },
  getProcessInstance: (id: string) =>
    flowableRequest<FlowableProcessInstance>(`/runtime/process-instances/${id}`),
  deleteProcessInstance: (id: string) =>
    flowableRequest<void>(`/runtime/process-instances/${id}`, { method: "DELETE" }),

  // ─── Tasks (Flowable 8: /runtime/tasks) ───
  listTasks: (params?: { assignee?: string; processInstanceId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.assignee) qs.set("assignee", params.assignee);
    if (params?.processInstanceId) qs.set("processInstanceId", params.processInstanceId);
    return flowableRequest<FlowableTask[]>(`/runtime/tasks?${qs}`);
  },
  completeTask: (taskId: string, variables?: Record<string, unknown>) => {
    // Flowable 8 wants variables as an array, not an object
    const variablesArr = variables
      ? Object.entries(variables).map(([name, value]) => ({ name, value }))
      : undefined;
    return flowableRequest<void>(`/runtime/tasks/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ action: "complete", variables: variablesArr }),
    });
  },
  claimTask: (taskId: string, userId: string) =>
    flowableRequest<void>(`/runtime/tasks/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ action: "claim", assignee: userId }),
    }),
  delegateTask: (taskId: string, userId: string) =>
    flowableRequest<void>(`/runtime/tasks/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ action: "delegate", assignee: userId }),
    }),

  // ─── History (Flowable 8: /history/historic-process-instances) ───
  listHistoryInstances: (params?: { processDefinitionId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.processDefinitionId) qs.set("processDefinitionId", params.processDefinitionId);
    return flowableRequest<FlowableHistoricInstance[]>(`/history/historic-process-instances?${qs}`);
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