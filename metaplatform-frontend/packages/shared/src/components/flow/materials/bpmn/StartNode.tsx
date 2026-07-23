/**
 * BPMN 开始事件节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function BpmnStartNode({ selected }: Props) {
  return (
    <div className="flow-node flow-node--bpmn-start" data-selected={selected}>
      <svg viewBox="0 0 40 40" width={40} height={40} aria-label="BPMN Start">
        <circle cx="20" cy="20" r="18" fill="var(--flow-node-bg)" stroke="var(--flow-node-border-selected)" strokeWidth="2" />
        <polygon points="14,20 26,12 26,28" fill="var(--flow-node-border-selected)" />
      </svg>
    </div>
  );
}

export const BPMN_START_MATERIAL = {
  type: 'bpmn.start',
  name: '开始事件',
  category: 'bpmn.event',
  defaultWidth: 40,
  defaultHeight: 40,
  component: BpmnStartNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
};
