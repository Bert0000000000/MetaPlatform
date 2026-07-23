/**
 * BPMN 结束事件节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function BpmnEndNode({ node, selected }: Props) {
  const name = node.name ?? '结束';
  return (
    <div className="flow-node flow-node--bpmn-end" data-selected={selected} style={{ padding: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg viewBox="0 0 40 40" width={40} height={40} aria-label="BPMN End">
          <circle cx="20" cy="20" r="18" fill="var(--flow-node-bg)" stroke="var(--flow-node-border-selected)" strokeWidth="3" />
        </svg>
        <div>
          <div className="flow-node__title">{name}</div>
          <div className="flow-node__subtitle">结束事件</div>
        </div>
      </div>
    </div>
  );
}

export const BPMN_END_MATERIAL: FlowNodeMaterial = {
  type: 'bpmn.end',
  name: '结束事件',
  category: 'bpmn.event',
  defaultWidth: 120,
  defaultHeight: 40,
  component: BpmnEndNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    {
      key: 'terminateType',
      label: '终止类型',
      type: 'select',
      options: [
        { label: '正常结束', value: 'normal' },
        { label: '强制终止', value: 'terminate' },
      ],
    },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
};
