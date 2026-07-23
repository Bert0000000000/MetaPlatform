/**
 * Agent LLM 节点
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function AgentLlmNode({ node, selected }: Props) {
  const name = node.name ?? '大模型';
  const model = (node.data as { model?: string } | undefined)?.model ?? 'doubao';
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 150, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>LLM · {model}</div>
      <div className="flow-node__title">{name}</div>
    </div>
  );
}

export const AGENT_LLM_MATERIAL: FlowNodeMaterial = {
  type: 'agent.llm',
  name: 'LLM',
  category: 'agent.reasoning',
  defaultWidth: 150,
  defaultHeight: 70,
  component: AgentLlmNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    {
      key: 'model',
      label: '模型',
      type: 'select',
      options: [
        { label: 'doubao-pro', value: 'doubao-pro' },
        { label: 'doubao-lite', value: 'doubao-lite' },
        { label: 'gpt-4o', value: 'gpt-4o' },
        { label: 'claude-sonnet-4', value: 'claude-sonnet-4' },
      ],
    },
    { key: 'temperature', label: '温度', type: 'number' },
    { key: 'systemPrompt', label: '系统提示词', type: 'textarea' },
    {
      key: 'outputFormat',
      label: '输出格式',
      type: 'select',
      options: [
        { label: '文本', value: 'text' },
        { label: 'JSON', value: 'json' },
        { label: 'Markdown', value: 'markdown' },
      ],
    },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { model: 'doubao-pro', temperature: 0.7, outputFormat: 'text' },
};
