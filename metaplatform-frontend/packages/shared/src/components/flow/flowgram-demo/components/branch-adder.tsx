/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 去掉 Semi Button，改用 lucide-plus + 原生 button。
 */
import { nanoid } from 'nanoid';
import {
  type FlowNodeEntity,
  useClientContext,
} from '@flowgram.ai/fixed-layout-editor';
import { Plus } from 'lucide-react';

interface PropsType {
  activated?: boolean;
  node: FlowNodeEntity;
}

export function BranchAdder(props: PropsType) {
  const { activated, node } = props;
  const nodeData = node.firstChild?.renderData;
  const ctx = useClientContext();
  const { operation, playground } = ctx;
  const { isVertical } = node;
  function addBranch() {
    let block: FlowNodeEntity;
    if (node.flowNodeType === 'multiOutputs') {
      block = operation.addBlock(node, {
        id: `output_${nanoid(5)}`,
        type: 'output',
        data: { title: 'New Output' },
      });
    } else if (node.flowNodeType === 'multiInputs') {
      block = operation.addBlock(node, {
        id: `input_${nanoid(5)}`,
        type: 'input',
        data: { title: 'New Input' },
      });
    } else {
      block = operation.addBlock(node, {
        id: `branch_${nanoid(5)}`,
        type: 'block',
        data: { title: 'New Branch' },
      });
    }
    setTimeout(() => {
      playground.scrollToView({
        bounds: block.bounds,
        scrollToCenter: true,
      });
    }, 10);
  }
  if (playground.config.readonlyOrDisabled) return null;
  const className = [
    'demo-fixed-adder',
    isVertical ? '' : 'isHorizontal',
    activated ? 'activated' : '',
  ].join(' ');
  return (
    <div
      className={className}
      onMouseEnter={() => nodeData?.toggleMouseEnter()}
      onMouseLeave={() => nodeData?.toggleMouseLeave()}
    >
      <button
        onClick={() => addBranch()}
        aria-label="add-branch"
        style={{
          flexGrow: 1,
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
