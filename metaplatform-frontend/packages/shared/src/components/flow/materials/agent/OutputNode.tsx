/**
 * Agent 输出节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function AgentOutputNode({ node, selected }: Props) {
  const name = node.name ?? '输出';
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 130, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>OUTPUT</div>
      <div className="flow-node__title">{name}</div>
    </div>
  );
}

export const AGENT_OUTPUT_MATERIAL: FlowNodeMaterial = {
  type: 'agent.output',
  name: '输出',
  category: 'agent.io',
  defaultWidth: 130,
  defaultHeight: 56,
  component: AgentOutputNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'outputTemplate', label: '输出模板', type: 'textarea' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
};
