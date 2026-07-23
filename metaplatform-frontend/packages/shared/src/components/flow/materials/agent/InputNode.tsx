/**
 * Agent 输入节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function AgentInputNode({ node, selected }: Props) {
  const name = node.name ?? '用户输入';
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 130, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>INPUT</div>
      <div className="flow-node__title">{name}</div>
    </div>
  );
}

export const AGENT_INPUT_MATERIAL: FlowNodeMaterial = {
  type: 'agent.input',
  name: '输入',
  category: 'agent.io',
  defaultWidth: 130,
  defaultHeight: 56,
  component: AgentInputNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'inputSchema', label: '输入 Schema', type: 'json' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
};
