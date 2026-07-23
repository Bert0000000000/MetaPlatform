/**
 * Agent 工具调用节点（对接 MCP / 自研工具）
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function AgentToolCallNode({ node, selected }: Props) {
  const name = node.name ?? '工具调用';
  const server = (node.data as { server?: string } | undefined)?.server ?? 'mcp';
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 150, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>TOOL · {server}</div>
      <div className="flow-node__title">{name}</div>
    </div>
  );
}

export const AGENT_TOOL_CALL_MATERIAL: FlowNodeMaterial = {
  type: 'agent.toolCall',
  name: '工具调用',
  category: 'agent.reasoning',
  defaultWidth: 150,
  defaultHeight: 70,
  component: AgentToolCallNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'server', label: 'MCP/工具 Server', type: 'text' },
    { key: 'toolName', label: '工具名', type: 'text' },
    { key: 'paramMapping', label: '参数映射', type: 'json' },
    { key: 'timeoutMs', label: '超时（毫秒）', type: 'number' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { timeoutMs: 5000 },
};
