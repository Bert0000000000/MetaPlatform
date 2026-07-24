/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 连线上的「+」按钮。
 *
 * 关键：
 * 1. hover 状态必须在外层一个容器内同时包含 trigger 和 menu，
 *    否则鼠标从 trigger 移向 menu 会触发外层 onMouseLeave → setOpen(false)
 *    → 菜单被卸载 → 内部 onClick 永远不响应。
 *
 * 2. menu 会向**上方**展开（bottom: '100%'），
 *    避免被下方连线的下一个节点遮住。
 *
 * 3. menu 使用 React Portal 挂到 document.body，z-index 拉到 9999，
 *    避开 FlowGram 内部 gedit-* 节点 / 边的 layer 叠加顺序。
 */
import {
  FlowNodeEntity,
  useClientContext,
  usePlayground,
} from '@flowgram.ai/fixed-layout-editor';
import { PlusCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nodeRegistries } from '../node-registries';
import { useAddNode } from '../hooks/use-add-node';
import { getNodeTypeLabel } from '../../node-label-zh';

const MENU_PORTAL_Z = 9999;

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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; arrowSide: 'top' | 'bottom' } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  if (playground.config.readonlyOrDisabled) return null;

  const recalcPosition = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    // 默认向上展开，菜单不会被下方节点遮挡；
    // 顶部空间不够时再翻下。
    const winH = window.innerHeight;
    const MENU_APPROX_HEIGHT = 320;
    const upward = r.top - MENU_APPROX_HEIGHT - 12 > 0 || r.top > winH / 2;
    if (upward) {
      // 菜单顶端 = r.top - 8（用 transform translateY(-100%) 翻上去）
      setMenuPos({
        top: r.top - 8,
        left: cx,
        arrowSide: 'bottom', // 菜单底部对齐 trigger 顶部
      });
    } else {
      setMenuPos({
        top: r.bottom + 8,
        left: cx,
        arrowSide: 'top', // 菜单顶部对齐 trigger 底部
      });
    }
  };

  const openMenu = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    recalcPosition();
    setOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
    }
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
    }, 80);
  };

  useEffect(() => {
    if (!open) return;
    const onResize = () => recalcPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const top = menuPos?.top ?? -9999;
  const left = menuPos?.left ?? -9999;
  const arrowSide = menuPos?.arrowSide ?? 'bottom';

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
      }}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <div
        ref={triggerRef}
        data-testid="flowgram-line-adder-trigger"
        style={{
          width: hoverActivated ? 28 : 18,
          height: hoverActivated ? 28 : 18,
          backgroundColor: hoverActivated ? '#6366f1' : 'rgba(255,255,255,0.2)',
          border: hoverActivated
            ? '1px solid rgba(255,255,255,0.5)'
            : '1px solid rgba(255,255,255,0.18)',
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

      {open && menuPos
        ? createPortal(
            <div
              data-testid="flowgram-line-adder-menu"
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
              style={{
                position: 'fixed',
                top,
                left,
                // 向上展开时 translateY(-100%) 翻上去，使菜单底部对齐 trigger 顶部；
                // 向下展开时 translateY(0)。
                transform:
                  arrowSide === 'bottom'
                    ? 'translate(-50%, -100%)'
                    : 'translate(-50%, 0)',
                zIndex: MENU_PORTAL_Z,
                background: 'rgba(15, 15, 20, 0.97)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 10,
                minWidth: 200,
                maxHeight: 360,
                overflowY: 'auto',
                overflowX: 'hidden',
                color: '#fff',
                padding: 6,
                boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'auto',
              }}
            >
              {nodeRegistries.map((registry) => (
                <div
                  key={registry.type}
                  onClick={(e) => {
                    e.stopPropagation();
                    const item = registry?.onAdd(context, from);
                    handleAdd(item, from);
                    setOpen(false);
                  }}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderRadius: 6,
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
