/**
 * 把 FlowCanvas 业务物料映射为 FlowGram.AI 1.0.12 的注册表与适配器。
 */
import {
  FixedLayoutEditorProvider,
} from '@flowgram.ai/fixed-layout-editor';
import type { FlowData, FlowNodeMaterial, FlowPaletteCategory } from './flow-types';
import { BPMN_END_MATERIAL } from './materials/bpmn/EndNode';
import { BPMN_GATEWAY_MATERIALS } from './materials/bpmn/GatewayNode';
import { BPMN_SERVICE_TASK_MATERIAL } from './materials/bpmn/ServiceTaskNode';
import { BPMN_START_MATERIAL } from './materials/bpmn/StartNode';
import { BPMN_USER_TASK_MATERIAL } from './materials/bpmn/UserTaskNode';
import {
  AGENT_CODE_MATERIAL,
  AGENT_CONDITION_MATERIAL,
  AGENT_HUMAN_MATERIAL,
  AGENT_INPUT_MATERIAL,
  AGENT_KNOWLEDGE_MATERIAL,
  AGENT_LLM_MATERIAL,
  AGENT_LOOP_MATERIAL,
  AGENT_OUTPUT_MATERIAL,
  AGENT_SUBFLOW_MATERIAL,
  AGENT_TOOL_CALL_MATERIAL,
} from './materials/agent';

export type MaterialComponent = unknown;

/**
 * 业务模型 → FlowGram DocumentJSON
 */
export function flowDataToFlowgramJSON(data: FlowData): Parameters<typeof FixedLayoutEditorProvider>[0]['initialData'] {
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      meta: { position: { x: n.x, y: n.y } },
      data: { title: n.name, ...((n.data ?? {}) as Record<string, unknown>) },
      style:
        n.width !== undefined || n.height !== undefined
          ? { width: n.width, height: n.height }
          : undefined,
    })),
    edges: data.edges.map((e) => ({
      id: e.id,
      sourceNodeID: e.source,
      targetNodeID: e.target,
      sourcePortID: e.sourcePort ?? 'output',
      targetPortID: e.targetPort ?? 'input',
      text: e.label,
      data: e.data ? (e.data as Record<string, unknown>) : undefined,
    })),
  } as unknown as Parameters<typeof FixedLayoutEditorProvider>[0]['initialData'];
}

/**
 * 把业务物料映射为 FlowGram NodeRegistry 数组。
 * 渲染壳沿用 FlowGram 自身默认渲染：节点 title 字段。
 * 业务想自定义渲染可通过 formMeta.render 覆盖（后续可加）。
 */
export function buildFlowNodeRegistries(
  materials: FlowNodeMaterial[],
): Parameters<typeof FixedLayoutEditorProvider>[0]['nodeRegistries'] {
  const registries = materials.map((material) => ({
    type: material.type,
    meta: { defaultExpanded: true },
    formMeta: {
      render: () => null,
    },
  }));
  return registries as unknown as Parameters<typeof FixedLayoutEditorProvider>[0]['nodeRegistries'];
}

/**
 * 标准 BPMN + Agent 物料合集（与 materials/bpmn & materials/agent 同步）。
 */
export const ALL_NODE_MATERIALS: FlowNodeMaterial[] = [
  BPMN_START_MATERIAL,
  BPMN_END_MATERIAL,
  BPMN_USER_TASK_MATERIAL,
  BPMN_SERVICE_TASK_MATERIAL,
  ...BPMN_GATEWAY_MATERIALS,
  AGENT_INPUT_MATERIAL,
  AGENT_OUTPUT_MATERIAL,
  AGENT_LLM_MATERIAL,
  AGENT_TOOL_CALL_MATERIAL,
  AGENT_KNOWLEDGE_MATERIAL,
  AGENT_CONDITION_MATERIAL,
  AGENT_LOOP_MATERIAL,
  AGENT_SUBFLOW_MATERIAL,
  AGENT_HUMAN_MATERIAL,
  AGENT_CODE_MATERIAL,
] satisfies FlowNodeMaterial[];

// 占位导出，避免 tree-shaking 误删
export const __FLOW_PALETTE_CATEGORY_REF: FlowPaletteCategory[] = [];
