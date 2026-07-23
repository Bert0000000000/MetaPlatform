/**
 * Agent 知识检索节点（RAG）
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface Props {
  node: FlowNode;
  selected: boolean;
}

export function AgentKnowledgeRetrievalNode({ node, selected }: Props) {
  const name = node.name ?? '知识检索';
  const kb = (node.data as { kb?: string } | undefined)?.kb ?? 'default';
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 150, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>RAG · {kb}</div>
      <div className="flow-node__title">{name}</div>
    </div>
  );
}

export const AGENT_KNOWLEDGE_MATERIAL: FlowNodeMaterial = {
  type: 'agent.knowledgeRetrieval',
  name: '知识检索',
  category: 'agent.reasoning',
  defaultWidth: 150,
  defaultHeight: 70,
  component: AgentKnowledgeRetrievalNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'kb', label: '知识库', type: 'text' },
    { key: 'topK', label: 'TopK', type: 'number' },
    { key: 'threshold', label: '相似度阈值', type: 'number' },
    { key: 'filterExpr', label: '过滤条件', type: 'condition' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { topK: 5, threshold: 0.6 },
};
