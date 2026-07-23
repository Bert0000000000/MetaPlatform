/**
 * BPMN 标准节点物料
 * --------------------------------------------------
 * 集合参考设计文档 4.3 节：开始、结束、用户任务、服务任务、排他/并行/包容网关。
 * 顺序流在 FlowGram 1.0.12 中由边承载，无需单独注册节点物料。
 */
import type { FlowNodeMaterial } from '../../flow-types';
import { BPMN_START_MATERIAL } from './StartNode';
import { BPMN_END_MATERIAL } from './EndNode';
import { BPMN_USER_TASK_MATERIAL } from './UserTaskNode';
import { BPMN_SERVICE_TASK_MATERIAL } from './ServiceTaskNode';
import { BPMN_GATEWAY_MATERIALS } from './GatewayNode';

export const BPMN_NODE_MATERIALS: FlowNodeMaterial[] = [
  BPMN_START_MATERIAL,
  BPMN_END_MATERIAL,
  BPMN_USER_TASK_MATERIAL,
  BPMN_SERVICE_TASK_MATERIAL,
  ...BPMN_GATEWAY_MATERIALS,
] as FlowNodeMaterial[];

export const BPMN_PALETTE_CATEGORIES = [
  { key: 'bpmn.event', label: '事件', items: [BPMN_START_MATERIAL, BPMN_END_MATERIAL] },
  {
    key: 'bpmn.task',
    label: '任务',
    items: [BPMN_USER_TASK_MATERIAL, BPMN_SERVICE_TASK_MATERIAL],
  },
  { key: 'bpmn.gateway', label: '网关', items: [...BPMN_GATEWAY_MATERIALS] },
];

export {
  BPMN_START_MATERIAL,
  BPMN_END_MATERIAL,
  BPMN_USER_TASK_MATERIAL,
  BPMN_SERVICE_TASK_MATERIAL,
  BPMN_GATEWAY_MATERIALS,
};
