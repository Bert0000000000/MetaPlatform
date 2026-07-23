/**
 * BPMN 网关节点（排他 / 并行 / 包容 / 事件）
 */
import type { FlowNode, FlowNodeMaterial } from '../../flow-types';
import type { ReactNode } from 'react';

interface Props {
  node: FlowNode;
  selected: boolean;
}

const ICON_BY_GATEWAY: Record<string, ReactNode> = {
  'bpmn.exclusiveGateway': (
    // X：排他
    <>
      <line x1="14" y1="14" x2="26" y2="26" stroke="var(--flow-node-text)" strokeWidth="2" />
      <line x1="26" y1="14" x2="14" y2="26" stroke="var(--flow-node-text)" strokeWidth="2" />
    </>
  ),
  'bpmn.parallelGateway': (
    // +：并行
    <>
      <line x1="20" y1="10" x2="20" y2="30" stroke="var(--flow-node-text)" strokeWidth="2" />
      <line x1="10" y1="20" x2="30" y2="20" stroke="var(--flow-node-text)" strokeWidth="2" />
    </>
  ),
  'bpmn.inclusiveGateway': (
    // O：包容
    <circle cx="20" cy="20" r="6" stroke="var(--flow-node-text)" strokeWidth="2" fill="none" />
  ),
  'bpmn.eventBasedGateway': (
    // 五边形：事件
    <circle cx="20" cy="20" r="4" fill="var(--flow-node-text)" />
  ),
};

export function BpmnGatewayNode({ node, selected }: Props) {
  return (
    <div className="flow-node flow-node--bpmn-gateway" data-selected={selected}>
      <svg viewBox="0 0 40 40" width={40} height={40}>
        <rect
          x="6"
          y="6"
          width="28"
          height="28"
          fill="var(--flow-node-bg)"
          stroke="var(--flow-node-border-selected)"
          strokeWidth="2"
          transform="rotate(45 20 20)"
        />
        {ICON_BY_GATEWAY[node.type]}
      </svg>
    </div>
  );
}

export const BPMN_GATEWAY_MATERIALS = [
  {
    type: 'bpmn.exclusiveGateway',
    name: '排他网关',
    category: 'bpmn.gateway',
    defaultWidth: 40,
    defaultHeight: 40,
    component: BpmnGatewayNode,
    fields: [
      { key: 'title', label: '名称', type: 'text', required: true },
      { key: 'defaultBranch', label: '默认分支', type: 'text' },
    ] satisfies import('../../flow-types').FlowNodeFormField[],
  },
  {
    type: 'bpmn.parallelGateway',
    name: '并行网关',
    category: 'bpmn.gateway',
    defaultWidth: 40,
    defaultHeight: 40,
    component: BpmnGatewayNode,
    fields: [{ key: 'title', label: '名称', type: 'text', required: true }] satisfies import('../../flow-types').FlowNodeFormField[],
  },
  {
    type: 'bpmn.inclusiveGateway',
    name: '包容网关',
    category: 'bpmn.gateway',
    defaultWidth: 40,
    defaultHeight: 40,
    component: BpmnGatewayNode,
    fields: [{ key: 'title', label: '名称', type: 'text', required: true }] satisfies import('../../flow-types').FlowNodeFormField[],
  },
];
