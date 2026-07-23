/**
 * FlowToolbar
 * --------------------------------------------------
 * 撤销/重做 / 缩放 / 适应屏幕 / 预览/保存/发布按钮。
 */
import { Eye, Maximize2, Minus, Play, Plus, Redo2, Save, Undo2, Upload } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FlowToolbarProps {
  title?: ReactNode;
  version?: ReactNode;
  extraLeft?: ReactNode;
  extraRight?: ReactNode;
  onSave?: () => void;
  onPublish?: () => void;
  onPreview?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  zoomPercent?: number;
}

export function FlowToolbar({
  title,
  extraLeft,
  extraRight,
  onSave,
  onPublish,
  onPreview,
  onZoomIn,
  onZoomOut,
  onFitView,
  onUndo,
  onRedo,
  zoomPercent = 100,
}: FlowToolbarProps) {
  return (
    <div className="flow-canvas__toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--flow-node-text)' }}>
          {title ?? '流程设计器'}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--flow-node-subtext)',
            background: 'var(--flow-node-bg-hover)',
            border: '1px solid var(--flow-node-border)',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          v2.1
        </span>
        <div style={{ width: 1, height: 20, background: 'var(--flow-node-border)' }} />
        <button className="v-btn" style={{ height: 28, fontSize: 11, padding: '0 8px' }} onClick={onUndo}>
          <Undo2 style={{ width: 14, height: 14 }} /> 撤销
        </button>
        <button className="v-btn" style={{ height: 28, fontSize: 11, padding: '0 8px' }} onClick={onRedo}>
          <Redo2 style={{ width: 14, height: 14 }} /> 重做
        </button>
        {extraLeft}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {extraRight}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'var(--flow-bg-elevated)',
            border: '1px solid var(--flow-node-border)',
            borderRadius: 4,
            padding: 2,
          }}
        >
          <button
            className="v-btn-ghost"
            onClick={onZoomOut}
            aria-label="缩小"
            style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
          >
            <Minus style={{ width: 14, height: 14 }} />
          </button>
          <span
            style={{ fontSize: 11, color: 'var(--flow-node-subtext)', padding: '0 6px', minWidth: 36, textAlign: 'center' }}
          >
            {Math.round(zoomPercent)}%
          </span>
          <button
            className="v-btn-ghost"
            onClick={onZoomIn}
            aria-label="放大"
            style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
          >
            <Plus style={{ width: 14, height: 14 }} />
          </button>
          <button
            className="v-btn-ghost"
            onClick={onFitView}
            aria-label="适应屏幕"
            style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
          >
            <Maximize2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <button className="v-btn" onClick={onPreview}>
          <Eye style={{ width: 14, height: 14 }} /> 预览
        </button>
        <button className="v-btn">
          <Play style={{ width: 14, height: 14 }} /> 模拟运行
        </button>
        <button className="v-btn-primary" onClick={onPublish}>
          <Upload style={{ width: 14, height: 14 }} /> 发布
        </button>
        <button className="v-btn-primary" onClick={onSave}>
          <Save style={{ width: 14, height: 14 }} /> 保存
        </button>
      </div>
    </div>
  );
}
