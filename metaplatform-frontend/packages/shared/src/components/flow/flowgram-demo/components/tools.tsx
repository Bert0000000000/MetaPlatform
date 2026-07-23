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
        bottom: 16,
        left: 16,
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
      <button onClick={() => tools.zoomin()} aria-label="zoom-in">
        <ZoomInIcon size={16} />
      </button>
      <button onClick={() => tools.zoomout()} aria-label="zoom-out">
        <ZoomOutIcon size={16} />
      </button>
      <button onClick={() => tools.fitView()} aria-label="fit-view">
        <FitIcon size={16} />
      </button>
      <button onClick={() => tools.changeLayout()} aria-label="change-layout" title="切换横/竖布局">
        <UndoArrow size={16} />
      </button>
      <button onClick={() => history.undo()} disabled={!canUndo} aria-label="undo">
        <UndoIcon size={16} />
      </button>
      <button onClick={() => history.redo()} disabled={!canRedo} aria-label="redo">
        <RedoIcon size={16} />
      </button>
      <button onClick={toggleReadonly} aria-label="toggle-readonly">
        {playground.config.readonly ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
      </button>
      <span style={{ marginLeft: 6 }}>{Math.floor(tools.zoom * 100)}%</span>
    </div>
  );
}
