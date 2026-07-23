/**
 * BPMN 服务任务节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function BpmnServiceTaskNode({ node, selected }: Props) {
  const name = node.name ?? '服务任务';
  const endpoint = (node.data as { endpoint?: string } | undefined)?.endpoint;
  return (
    <div
      className="flow-node flow-node--bpmn-serviceTask"
      data-selected={selected}
      style={{ width: 140, padding: '10px 12px', borderRadius: 6 }}
    >
      <div className="flow-node__title">{name}</div>
      <div className="flow-node__subtitle">{endpoint ? `调用：${endpoint}` : '服务任务'}</div>
    </div>
  );
}

export const BPMN_SERVICE_TASK_MATERIAL: FlowNodeMaterial = {
  type: 'bpmn.serviceTask',
  name: '服务任务',
  category: 'bpmn.task',
  defaultWidth: 140,
  defaultHeight: 64,
  component: BpmnServiceTaskNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'endpoint', label: '调用接口', type: 'text' },
    { key: 'retryTimes', label: '重试次数', type: 'number' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { retryTimes: 3 },
};
