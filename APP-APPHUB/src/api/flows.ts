import { get, post, put, del } from './client';
import type { FlowConfig, FlowValidationResult, FlowTestResult, PageResponse, ModuleItem } from '@/types';

const STORAGE_KEY = 'mate_apphub_flows';

function loadFlows(): Record<string, FlowConfig> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, FlowConfig>;
  } catch {
    return {};
  }
}

function saveFlows(flows: Record<string, FlowConfig>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
}

function now(): string {
  return new Date().toISOString();
}

export async function getFlow(moduleId: string): Promise<FlowConfig> {
  try {
    return await get<FlowConfig>(`/v1/wfe/flows/${moduleId}`);
  } catch {
    const flows = loadFlows();
    return flows[moduleId] || { name: '', description: '', nodes: [], edges: [] };
  }
}

export async function saveFlow(moduleId: string, config: FlowConfig): Promise<FlowConfig> {
  try {
    return await put<FlowConfig>(`/v1/wfe/flows/${moduleId}`, config);
  } catch {
    const flows = loadFlows();
    flows[moduleId] = config;
    saveFlows(flows);
    return config;
  }
}

export async function validateFlow(config: FlowConfig): Promise<FlowValidationResult> {
  try {
    return await post<FlowValidationResult>('/v1/wfe/flows/validate', config);
  } catch {
    return mockValidate(config);
  }
}

export async function testFlow(config: FlowConfig): Promise<FlowTestResult> {
  try {
    return await post<FlowTestResult>('/v1/wfe/flows/test', config);
  } catch {
    return mockTest(config);
  }
}

export async function publishFlow(moduleId: string, config: FlowConfig): Promise<{ success: boolean; message: string }> {
  try {
    await post(`/v1/wfe/flows/${moduleId}/publish`, config);
    return { success: true, message: '流程已发布到 TECH-WFE' };
  } catch {
    const flows = loadFlows();
    flows[moduleId] = { ...config, name: config.name + ' (已发布)' };
    saveFlows(flows);
    return { success: true, message: '流程已发布（本地模拟模式）' };
  }
}

export async function listFormModules(appId: string): Promise<ModuleItem[]> {
  try {
    const res = await get<PageResponse<ModuleItem>>('/v1/apphub/modules', { appId, type: 'FORM' });
    return res.items;
  } catch {
    const raw = localStorage.getItem('mate_apphub_modules');
    if (!raw) return [];
    try {
      const modules = JSON.parse(raw) as ModuleItem[];
      return modules.filter((m) => m.appId === appId && m.type === 'FORM');
    } catch {
      return [];
    }
  }
}

function mockValidate(config: FlowConfig): FlowValidationResult {
  const errors: FlowValidationResult['errors'] = [];
  const warnings: FlowValidationResult['warnings'] = [];

  if (config.nodes.length === 0) {
    errors.push({ code: 'EMPTY_FLOW', message: '流程为空，请添加节点' });
    return { valid: false, errors, warnings };
  }

  const startNodes = config.nodes.filter((n) => n.type === 'start');
  const endNodes = config.nodes.filter((n) => n.type === 'end');

  if (startNodes.length === 0) {
    errors.push({ code: 'NO_START', message: '缺少开始节点' });
  } else if (startNodes.length > 1) {
    errors.push({ code: 'MULTIPLE_START', message: '存在多个开始节点' });
  }

  if (endNodes.length === 0) {
    errors.push({ code: 'NO_END', message: '缺少结束节点' });
  }

  for (const node of config.nodes) {
    const hasIncoming = config.edges.some((e) => e.target === node.id);
    const hasOutgoing = config.edges.some((e) => e.source === node.id);

    if (node.type !== 'start' && !hasIncoming) {
      errors.push({ nodeId: node.id, code: 'NO_INCOMING', message: `节点「${node.name}」没有入边` });
    }
    if (node.type !== 'end' && !hasOutgoing) {
      errors.push({ nodeId: node.id, code: 'NO_OUTGOING', message: `节点「${node.name}」没有出边` });
    }

    if (node.type === 'approval') {
      const approvalConfig = node.config as { assigneeIds?: string[] } | undefined;
      if (!approvalConfig?.assigneeIds || approvalConfig.assigneeIds.length === 0) {
        errors.push({ nodeId: node.id, code: 'NO_ASSIGNEE', message: `审批节点「${node.name}」未配置审批人` });
      }
    }

    if (node.type === 'condition') {
      const condConfig = node.config as { branches?: unknown[] } | undefined;
      if (!condConfig?.branches || condConfig.branches.length === 0) {
        errors.push({ nodeId: node.id, code: 'NO_BRANCHES', message: `条件节点「${node.name}」未配置分支` });
      }
    }
  }

  const visited = new Set<string>();
  const startNode = startNodes[0];
  if (startNode) {
    const queue = [startNode.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      config.edges
        .filter((e) => e.source === current)
        .forEach((e) => queue.push(e.target));
    }
  }

  const unvisited = config.nodes.filter((n) => !visited.has(n.id));
  for (const node of unvisited) {
    warnings.push({ nodeId: node.id, code: 'UNREACHABLE', message: `节点「${node.name}」不可达` });
  }

  const nodeIds = new Set(config.nodes.map((n) => n.id));
  for (const edge of config.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({ edgeId: edge.id, code: 'INVALID_SOURCE', message: `边引用了不存在的源节点` });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({ edgeId: edge.id, code: 'INVALID_TARGET', message: `边引用了不存在的目标节点` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function mockTest(config: FlowConfig): FlowTestResult {
  const steps: FlowTestResult['steps'] = [];
  const startTime = Date.now();
  let currentStep = 0;

  const startNode = config.nodes.find((n) => n.type === 'start');
  if (!startNode) {
    return {
      steps: [],
      finalStatus: 'error',
      duration: 0,
    };
  }

  let currentNodeId: string | undefined = startNode.id;
  const visited = new Set<string>();
  let approved = true;

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = config.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    let action: FlowTestStep['action'] = 'complete';
    let actionLabel = '完成';
    let assignee: string | undefined;

    switch (node.type) {
      case 'start':
        action = 'submit';
        actionLabel = '提交申请';
        break;
      case 'approval':
        action = approved ? 'approve' : 'reject';
        actionLabel = approved ? '审批通过' : '审批拒绝';
        const approvalConfig = node.config as { assigneeIds?: string[] } | undefined;
        assignee = approvalConfig?.assigneeIds?.[0] || '审批人';
        break;
      case 'condition':
        action = 'condition_check';
        actionLabel = '条件判断';
        break;
      case 'end':
        action = 'complete';
        actionLabel = '流程结束';
        break;
    }

    steps.push({
      stepIndex: currentStep,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      assignee,
      action,
      actionLabel,
      timestamp: new Date(Date.now() + currentStep * 60000).toISOString(),
      status: 'completed',
    });

    currentStep++;

    const nextEdge = config.edges.find((e) => e.source === currentNodeId);
    currentNodeId = nextEdge?.target;
  }

  const lastStep = steps[steps.length - 1];
  if (lastStep) {
    lastStep.status = 'completed';
  }

  return {
    steps,
    finalStatus: approved ? 'approved' : 'rejected',
    duration: Date.now() - startTime,
  };
}
