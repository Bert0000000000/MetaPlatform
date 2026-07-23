/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: Semi Dropdown 简化，点击 +/- 唤出原生 menu；
 * 当前 mate 简化版仅保留"+鼠标 hover 时插入新节点"行为。
 */
import {
  FlowNodeEntity,
  useClientContext,
  usePlayground,
} from '@flowgram.ai/fixed-layout-editor';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { nodeRegistries } from '../node-registries';
import { useAddNode } from '../hooks/use-add-node';
import { getNodeTypeLabel } from '../../node-label-zh';

export const NodeAdder = (props: {
  from: FlowNodeEntity;
  to?: FlowNodeEntity;
  hoverActivated: boolean;
}) => {
  const { from, hoverActivated } = props;
  const playground = usePlayground();
  const context = useClientContext();
  const { handleAdd } = useAddNode();
  const [open, setOpen] = useState(false);

  if (playground.config.readonlyOrDisabled) return null;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        style={{
          width: hoverActivated ? 15 : 6,
          height: hoverActivated ? 15 : 6,
          backgroundColor: 'rgb(143, 149, 158)',
          color: '#fff',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hoverActivated ? (
          <PlusCircle size={15} style={{ color: '#3370ff', backgroundColor: '#fff', borderRadius: 15 }} />
        ) : null}
      </div>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 100,
            background: 'rgba(15, 15, 20, 0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            minWidth: 140,
            color: '#fff',
            padding: 4,
            boxShadow: '0 8px 18px rgba(0,0,0,0.4)',
          }}
        >
          {nodeRegistries.map((registry) => (
            <div
              key={registry.type}
              onClick={() => {
                const item = registry?.onAdd(context, from);
                handleAdd(item, from);
                setOpen(false);
              }}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {getNodeTypeLabel(registry.type)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
