/**
 * Agent 控制流节点：条件 / 循环 / 子流程 / 人工确认 / 代码
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';

interface BaseProps {
  node: FlowNode;
  selected: boolean;
}

function labelOf(node: FlowNode, fallback: string) {
  return node.name ?? fallback;
}

export function AgentConditionNode({ node, selected }: BaseProps) {
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 110, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>IF</div>
      <div className="flow-node__title">{labelOf(node, '条件')}</div>
    </div>
  );
}

export function AgentLoopNode({ node, selected }: BaseProps) {
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 130, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>LOOP</div>
      <div className="flow-node__title">{labelOf(node, '循环')}</div>
    </div>
  );
}

export function AgentSubFlowNode({ node, selected }: BaseProps) {
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 150, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>SUB-FLOW</div>
      <div className="flow-node__title">{labelOf(node, '子流程')}</div>
    </div>
  );
}

export function AgentHumanConfirmNode({ node, selected }: BaseProps) {
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 150, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>HUMAN</div>
      <div className="flow-node__title">{labelOf(node, '人工确认')}</div>
    </div>
  );
}

export function AgentCodeNode({ node, selected }: BaseProps) {
  return (
    <div
      className="flow-node"
      data-selected={selected}
      style={{ width: 130, padding: '10px 12px', borderRadius: 6 }}
    >
      <div style={{ fontSize: 11, color: 'var(--flow-node-subtext)' }}>CODE</div>
      <div className="flow-node__title">{labelOf(node, '代码')}</div>
    </div>
  );
}

export const AGENT_CONDITION_MATERIAL: FlowNodeMaterial = {
  type: 'agent.condition',
  name: '条件',
  category: 'agent.control',
  defaultWidth: 110,
  defaultHeight: 60,
  component: AgentConditionNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'expr', label: '条件表达式', type: 'condition' },
    { key: 'defaultBranch', label: '默认分支', type: 'text' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
};

export const AGENT_LOOP_MATERIAL: FlowNodeMaterial = {
  type: 'agent.loop',
  name: '循环',
  category: 'agent.control',
  defaultWidth: 130,
  defaultHeight: 60,
  component: AgentLoopNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'loopExpr', label: '循环条件', type: 'condition' },
    { key: 'maxIterations', label: '最大迭代次数', type: 'number' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { maxIterations: 10 },
};

export const AGENT_SUBFLOW_MATERIAL: FlowNodeMaterial = {
  type: 'agent.subFlow',
  name: '子流程',
  category: 'agent.control',
  defaultWidth: 150,
  defaultHeight: 64,
  component: AgentSubFlowNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'subFlowId', label: '子流程 ID', type: 'text' },
    { key: 'inputMapping', label: '输入参数映射', type: 'json' },
    { key: 'outputMapping', label: '输出参数映射', type: 'json' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
};

export const AGENT_HUMAN_MATERIAL: FlowNodeMaterial = {
  type: 'agent.humanConfirm',
  name: '人工确认',
  category: 'agent.control',
  defaultWidth: 150,
  defaultHeight: 60,
  component: AgentHumanConfirmNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    { key: 'approver', label: '确认人', type: 'text' },
    { key: 'channel', label: '渠道', type: 'select', options: [
      { label: '站内信', value: 'inbox' },
      { label: '邮件', value: 'email' },
      { label: 'IM', value: 'im' },
    ] },
    { key: 'timeoutMs', label: '超时（毫秒）', type: 'number' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { channel: 'inbox', timeoutMs: 30 * 60 * 1000 },
};

export const AGENT_CODE_MATERIAL: FlowNodeMaterial = {
  type: 'agent.code',
  name: '代码',
  category: 'agent.control',
  defaultWidth: 130,
  defaultHeight: 60,
  component: AgentCodeNode,
  fields: [
    { key: 'title', label: '名称', type: 'text', required: true },
    {
      key: 'language',
      label: '语言',
      type: 'select',
      options: [
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
        { label: 'TypeScript', value: 'typescript' },
      ],
    },
    { key: 'source', label: '代码', type: 'textarea' },
  ] satisfies import('../../flow-types').FlowNodeFormField[],
  defaultData: { language: 'javascript' },
};
