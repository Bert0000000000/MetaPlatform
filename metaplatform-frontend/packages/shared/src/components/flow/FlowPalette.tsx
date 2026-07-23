/**
 * FlowPalette
 * --------------------------------------------------
 * 左侧组件面板，列出可添加到画布的节点模板。
 *
 * 添加方式：
 * 1) 点击节点 → 通过 CustomEvent('m8:flow-palette-add') 派发 type
 *    到 window。FlowSurface 监听该事件，从当前 PlayGround 视口中拿到
 *    中心点位置后插入新节点。
 * 2) 原生 HTML5 dragstart（仍保留 'application/x-flow-node-type' 的 mime，
 *    兼容后续接入 FlowGram 自带 drag-and-drop 协议）。
 */
import { useState, type DragEvent } from 'react';
import { Search } from 'lucide-react';
import { useFlowEditorMeta } from './FlowContext';
import type { FlowNodeMaterial } from './flow-types';

export const PALETTE_DRAG_MIME = 'application/x-flow-node-type';
export const PALETTE_ADD_EVENT = 'm8:flow-palette-add';

export interface PaletteAddDetail {
  type: string;
  /** 触发时间戳，用作回放去重（可选） */
  ts?: number;
}

function dispatchPaletteAdd(detail: PaletteAddDetail): void {
  window.dispatchEvent(new CustomEvent<PaletteAddDetail>(PALETTE_ADD_EVENT, { detail }));
}

export function FlowPalette() {
  const { categories: paletteCategories } = useFlowEditorMeta();
  const [search, setSearch] = useState('');

  const handleDragStart = (event: DragEvent<HTMLDivElement>, material: FlowNodeMaterial) => {
    event.dataTransfer.setData(PALETTE_DRAG_MIME, JSON.stringify({ type: material.type }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleClickAdd = (material: FlowNodeMaterial) => {
    dispatchPaletteAdd({ type: material.type, ts: Date.now() });
  };

  const matched = paletteCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        search ? item.name.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <div className="flow-canvas__palette">
      <div
        style={{
          padding: '12px 14px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--flow-node-subtext)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: '1px solid var(--flow-node-border)',
        }}
      >
        组件面板
      </div>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--flow-node-border)',
          position: 'relative',
        }}
      >
        <Search
          style={{
            position: 'absolute',
            left: 22,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 14,
            height: 14,
            color: 'var(--flow-node-subtext)',
          }}
        />
        <input
          type="text"
          placeholder="搜索组件..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            height: 30,
            background: 'var(--flow-bg-elevated)',
            border: '1px solid var(--flow-node-border)',
            borderRadius: 4,
            padding: '0 10px 0 32px',
            fontSize: 12,
            color: 'var(--flow-node-text)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ padding: '6px 8px' }}>
        {matched.map((category) => (
          <div key={category.key} style={{ marginBottom: 4 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--flow-node-subtext)',
                padding: '6px 8px 4px',
              }}
            >
              {category.label}
            </div>
            {category.items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => handleClickAdd(item)}
                title={`点击添加到画布：${item.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 4,
                  cursor: 'grab',
                  fontSize: 13,
                  color: 'var(--flow-node-text)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--flow-bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: '1px solid var(--flow-node-border)',
                    background: 'var(--flow-bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--flow-node-text)' }}>
                    {item.name.charAt(0)}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
