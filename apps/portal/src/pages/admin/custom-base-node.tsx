/**
 * Mate: portal/admin 使用的自定义 BaseNode。
 * 与官方 base-node 同样的拖动 / hover / 删除交互逻辑，
 * 但内容直接使用 formMeta.render 输出的内容（即各 type 的专属卡片）。
 */
import {
  useNodeRender,
  useClientContext,
} from '@flowgram.ai/fixed-layout-editor';
import { Trash2 } from 'lucide-react';
import React, { type ReactNode } from 'react';

export const CustomBaseNode: React.FC<{ node: any }> = (): ReactNode => {
  const ctx = useClientContext();
  const nodeRender = useNodeRender();
  const form = nodeRender.form;
  if (!form) return null;
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
        cursor: nodeRender.dragging ? 'grabbing' : 'grab',
      }}
    >
      {!nodeRender.readonly && (
        <Trash2
          size={14}
          style={{ position: 'absolute', right: 4, top: 4, cursor: 'pointer', opacity: 0.6, zIndex: 10 }}
          onClick={(e) => {
            e.stopPropagation();
            ctx.operation.deleteNode(nodeRender.node);
          }}
        />
      )}
      {form.render()}
    </div>
  );
};

export default CustomBaseNode;
