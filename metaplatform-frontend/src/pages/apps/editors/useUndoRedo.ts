/**
 * useUndoRedo — AC-201.6 表单编辑器撤销/重做 hook
 *
 * 委托给 HistoryStack 纯函数实现, 这里只负责把 React state 接入算法.
 * 详见 historyStack.ts.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { HistoryStack, type HistoryOptions } from "./historyStack";

export interface UseUndoRedoResult<T> {
  state: T;
  /** 直接更新当前值, 不入栈 (用于 undo/redo 内部或纯 UI 临时态). */
  setState: (value: T) => void;
  /**
   * 提交新值并入栈. 同一 coalesceKey 连续提交会与栈顶合并 (替换值),
   * 时间间隔 > mergeWindowMs 时即使 key 相同也创建新 entry.
   */
  commit: (value: T, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pastDepth: number;
  futureDepth: number;
  /** 清空历史 (例如外部 props 重新加载时). */
  reset: (initial: T) => void;
}

const DEFAULT_CAPACITY = 20;
const DEFAULT_MERGE_WINDOW_MS = 500;

export function useUndoRedo<T>(
  initial: T,
  options?: HistoryOptions,
): UseUndoRedoResult<T> {
  const capacity = options?.capacity ?? DEFAULT_CAPACITY;
  const mergeWindowMs = options?.mergeWindowMs ?? DEFAULT_MERGE_WINDOW_MS;
  const equals = options?.equals ?? Object.is;

  // stackRef 跨 render 复用同一个 HistoryStack 实例
  const stackRef = useRef<HistoryStack<T> | null>(null);
  if (stackRef.current === null) {
    stackRef.current = new HistoryStack<T>(initial, {
      capacity,
      mergeWindowMs,
      equals,
    });
  }

  const [state, setStateInternal] = useState<T>(initial);
  // 触发 re-render 的最小化计数器
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((n) => n + 1), []);

  const setState = useCallback((value: T) => {
    stackRef.current!.setState(value);
    setStateInternal(value);
    forceUpdate();
  }, [forceUpdate]);

  const commit = useCallback(
    (value: T, coalesceKey?: string) => {
      const stack = stackRef.current!;
      stack.commit(value, coalesceKey);
      setStateInternal(stack.getState());
      forceUpdate();
    },
    [forceUpdate],
  );

  const undo = useCallback(() => {
    const stack = stackRef.current!;
    if (!stack.undo()) return;
    setStateInternal(stack.getState());
    forceUpdate();
  }, [forceUpdate]);

  const redo = useCallback(() => {
    const stack = stackRef.current!;
    if (!stack.redo()) return;
    setStateInternal(stack.getState());
    forceUpdate();
  }, [forceUpdate]);

  const reset = useCallback(
    (next: T) => {
      stackRef.current!.reset(next);
      setStateInternal(next);
      forceUpdate();
    },
    [forceUpdate],
  );

  // 用 tick 触发组件重渲染, 让 canUndo/canRedo 等元数据可见
  void tick;

  return useMemo(
    () => ({
      state,
      setState,
      commit,
      undo,
      redo,
      canUndo: stackRef.current!.canUndo(),
      canRedo: stackRef.current!.canRedo(),
      pastDepth: stackRef.current!.pastDepth(),
      futureDepth: stackRef.current!.futureDepth(),
      reset,
    }),
    [state, setState, commit, undo, redo, reset, tick],
  );
}