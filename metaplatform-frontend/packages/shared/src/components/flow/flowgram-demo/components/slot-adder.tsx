/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 用 lucide 替换 Semi Button。
 */
import { nanoid } from 'nanoid';
import {
  type FlowNodeEntity,
  FlowNodeRenderData,
  FlowDocument,
  useService,
} from '@flowgram.ai/fixed-layout-editor';
import { Plus } from 'lucide-react';

interface PropsType {
  node: FlowNodeEntity;
}

export function SlotAdder(props: PropsType) {
  const { node } = props;
  const nodeData = node.firstChild?.getData<FlowNodeRenderData>(FlowNodeRenderData);
  const document = useService(FlowDocument) as FlowDocument;
  async function addPort() {
    document.addNode({
      id: nanoid(5),
      type: 'custom',
      parent: node,
      data: { title: 'Custom', content: 'custom content' },
    });
  }
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--semi-color-bg-0)',
      }}
      onMouseEnter={() => nodeData?.toggleMouseEnter()}
      onMouseLeave={() => nodeData?.toggleMouseLeave()}
    >
      <button
        onClick={() => {
          void addPort();
        }}
        aria-label="add-port"
        style={{
          background: 'transparent',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: '#333',
        }}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
