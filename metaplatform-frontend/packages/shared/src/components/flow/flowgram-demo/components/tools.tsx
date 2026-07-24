/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 用 lucide-react 替代 @douyinfe/semi-ui 渲染 Tools。
 */
import { useEffect, useState, useCallback } from 'react';
import {
  usePlaygroundTools,
  useClientContext,
  useRefresh,
} from '@flowgram.ai/fixed-layout-editor';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Maximize as FitIcon,
  History as UndoIcon,
  CornerDownRight as UndoArrow,
  CornerDownLeft as RedoIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
} from 'lucide-react';

const toolButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background .15s, border-color .15s',
};

export function Tools() {
  const { history, playground } = useClientContext();
  const tools = usePlaygroundTools();
  const refresh = useRefresh();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const toggleReadonly = useCallback(() => {
    playground.config.readonly = !playground.config.readonly;
  }, [playground]);

  useEffect(() => {
    const disposable = history.undoRedoService.onChange(() => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
    });
    return () => disposable.dispose();
  }, [history]);

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => refresh());
    return () => disposable.dispose();
  }, [playground, refresh]);

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 10,
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: 'rgba(15, 15, 20, 0.7)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <button
        onClick={() => tools.zoomin()}
        aria-label="zoom-in"
        style={toolButtonStyle}
        title="放大"
      >
        <ZoomInIcon size={14} />
      </button>
      <button
        onClick={() => tools.zoomout()}
        aria-label="zoom-out"
        style={toolButtonStyle}
        title="缩小"
      >
        <ZoomOutIcon size={14} />
      </button>
      <button
        onClick={() => tools.fitView()}
        aria-label="fit-view"
        style={toolButtonStyle}
        title="适应屏幕"
      >
        <FitIcon size={14} />
      </button>
      <button
        onClick={() => tools.changeLayout()}
        aria-label="change-layout"
        style={toolButtonStyle}
        title="切换横/竖布局"
      >
        <UndoArrow size={14} />
      </button>
      <button
        onClick={() => history.undo()}
        disabled={!canUndo}
        aria-label="undo"
        style={{ ...toolButtonStyle, opacity: canUndo ? 1 : 0.4 }}
        title="撤销 (Ctrl+Z)"
      >
        <UndoIcon size={14} />
      </button>
      <button
        onClick={() => history.redo()}
        disabled={!canRedo}
        aria-label="redo"
        style={{ ...toolButtonStyle, opacity: canRedo ? 1 : 0.4 }}
        title="重做 (Ctrl+Shift+Z)"
      >
        <RedoIcon size={14} />
      </button>
      <button
        onClick={toggleReadonly}
        aria-label="toggle-readonly"
        style={toolButtonStyle}
        title="只读切换"
      >
        {playground.config.readonly ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
      </button>
      <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
        {Math.floor(tools.zoom * 100)}%
      </span>
    </div>
  );
}
