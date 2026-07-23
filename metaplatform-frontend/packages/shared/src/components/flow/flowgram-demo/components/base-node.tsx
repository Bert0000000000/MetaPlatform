/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 替换 Semi Icon 为 lucide-react Trash2。
 */
import {
  FlowNodeEntity,
  useNodeRender,
  useClientContext,
} from '@flowgram.ai/fixed-layout-editor';
import { Trash2 } from 'lucide-react';

export const BaseNode = ({ node }: { node: FlowNodeEntity }) => {
  const ctx = useClientContext();
  const nodeRender = useNodeRender();
  const form = nodeRender.form;
  return (
    <div
      className="demo-fixed-node"
      onMouseEnter={nodeRender.onMouseEnter}
      onMouseLeave={nodeRender.onMouseLeave}
      onMouseDown={(e) => {
        nodeRender.startDrag(e);
        e.stopPropagation();
      }}
      style={{
        opacity: nodeRender.dragging ? 0.3 : 1,
        ...(nodeRender.isBlockOrderIcon || nodeRender.isBlockIcon ? { width: 260 } : {}),
      }}
    >
      {!nodeRender.readonly && (
        <Trash2
          size={14}
          style={{ position: 'absolute', right: 4, top: 4, cursor: 'pointer', opacity: 0.6 }}
          onClick={() => ctx.operation.deleteNode(nodeRender.node)}
        />
      )}
      {form?.render()}
    </div>
  );
};
