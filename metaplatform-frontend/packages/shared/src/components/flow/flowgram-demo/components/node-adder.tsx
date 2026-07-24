/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 连线上的「+」按钮。
 *
 * 关键：hover 状态必须在外层一个容器内同时包含 trigger 和 menu，
 * 否则鼠标从 trigger 移向 menu 会触发外层 onMouseLeave → setOpen(false)
 * → 菜单被卸载 → 内部 onClick 永远不响应。
 *
 * 当前节点整体放进一个 wrapper，wrapper 同时是 trigger 区域。
 */
import {
  FlowNodeEntity,
  useClientContext,
  usePlayground,
} from '@flowgram.ai/fixed-layout-editor';
import { PlusCircle } from 'lucide-react';
import { useRef, useState } from 'react';
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
  const closeTimer = useRef<number | null>(null);

  if (playground.config.readonlyOrDisabled) return null;

  const handleEnter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    // 用 setTimeout 让用户有时间把鼠标从圆形按钮移到菜单上，
    // 菜单本身也是同一个 wrapper 子元素，所以这条路不进；
    // 但 Line adder 的 hover 区域会被 FlowGram 内部遮罩/层拦截，延迟 80ms 可以容错。
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
    }
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
    }, 80);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        data-testid="flowgram-line-adder-trigger"
        style={{
          width: hoverActivated ? 28 : 18,
          height: hoverActivated ? 28 : 18,
          backgroundColor: hoverActivated ? '#6366f1' : 'rgba(255,255,255,0.2)',
          border: hoverActivated ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.18)',
          color: '#fff',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .15s',
          boxShadow: hoverActivated ? '0 2px 8px rgba(99,102,241,0.6)' : 'none',
        }}
      >
        {hoverActivated ? (
          <PlusCircle size={16} style={{ color: '#fff' }} />
        ) : (
          <span style={{ fontSize: 14, lineHeight: 1, color: 'rgba(255,255,255,0.7)' }}>+</span>
        )}
      </div>

      {open ? (
        <div
          data-testid="flowgram-line-adder-menu"
          style={{
            position: 'absolute',
            top: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(15, 15, 20, 0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            minWidth: 180,
            maxHeight: 320,
            overflowY: 'auto',
            color: '#fff',
            padding: 4,
            boxShadow: '0 8px 18px rgba(0,0,0,0.4)',
          }}
          // 注意：这里是同一个 React 子树，鼠标移入到 menu 不会触发外层 onMouseLeave
        >
          {nodeRegistries.map((registry) => (
            <div
              key={registry.type}
              onClick={(e) => {
                // 阻止冒泡，避免触发外层 wrapper 的 leave
                e.stopPropagation();
                const item = registry?.onAdd(context, from);
                handleAdd(item, from);
                setOpen(false);
              }}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
                borderRadius: 4,
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.25)';
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
