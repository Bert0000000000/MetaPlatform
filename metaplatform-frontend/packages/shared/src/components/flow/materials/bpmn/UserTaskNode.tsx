/**
 * BPMN 用户任务节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function BpmnUserTaskNode({ node, selected }: Props) {
  const name = node.name ?? '用户任务';
  const assignee = (node.data as { assignee?: string } | undefined)?.assignee;
  return (
    <div
      className="flow-node flow-node--bpmn-userTask"
      data-selected={selected}
      style={{
        width: 140,
        padding: '10px 12px',
        borderRadius: 6,
      }}
    >
      <div className="flow-node__title">{name}</div>
      <div className="flow-node__subtitle">{assignee ? `审批人：${assignee}` : '用户任务'}</div>
    </div>
  );
}

export const BPMN_USER_TASK_MATERIAL = {
  type: 'bpmn.userTask',
  name: '用户任务',
  category: 'bpmn.task',
  defaultWidth: 140,
  defaultHeight: 64,
  component: BpmnUserTaskNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'assignee', label: '审批人', type: 'text' },
    { key: 'candidateRoles', label: '候选角色', type: 'variable' },
    {
      key: 'multiInstance',
      label: '多实例',
      type: 'select',
      options: [
        { label: '无', value: 'none' },
        { label: '会签（全部通过）', value: 'all' },
        { label: '或签（任一通过）', value: 'any' },
      ],
    },
    { key: 'timeoutHours', label: '超时时长（小时）', type: 'number' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { assignee: '', multiInstance: 'none', timeoutHours: 24 },
};
