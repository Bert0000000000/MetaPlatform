/**
 * useFlowHistory
 * --------------------------------------------------
 * 通用环形撤销/重做（ring buffer）。
 *  - 容量上限默认 200 步。
 *  - 通过 useReducer + lazy initializer，避免 StrictMode 双 mount 期间出现 state 缺失。
 *  - 稳定字符串比较去重（同值不入栈）。
 */
import { useCallback, useMemo, useReducer, useRef } from 'react';

export interface UseFlowHistoryOptions<T> {
  capacity?: number;
  /** 初始化时入栈一次，便于第一次编辑有可撤销基线 */
  withSeed?: boolean;
}

export interface UseFlowHistoryReturn<T> {
  state: T;
  push: (next: T) => void;
  replace: (next: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  reset: (initial: T) => void;
  canUndo: boolean;
  canRedo: boolean;
  past: number;
  future: number;
}

function safeInitial<T>(value: T, withSeed: boolean): { current: T; past: T[]; future: T[] } {
  // Ensure value is never undefined; default to null cast to T is unsafe,
  // better: keep value but guarantee reducer fallback.
  return {
    current: value,
    past: withSeed ? [value] : [],
    future: [] as T[],
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',')}}`;
}

interface HistoryState<T> {
  current: T;
  past: T[];
  future: T[];
}

type HistoryAction<T> =
  | { type: 'push'; next: T; capacity: number }
  | { type: 'replace'; next: T }
  | { type: 'undo'; capacity: number }
  | { type: 'redo'; capacity: number }
  | { type: 'reset'; value: T; capacity: number };

function reducer<T>(state: HistoryState<T> | undefined, action: HistoryAction<T>): HistoryState<T> {
  const safe: HistoryState<T> =
    state ??
    ({
      current: 'value' in action ? (action.value as T) : ((undefined as unknown) as T),
      past: [],
      future: [],
    });
  switch (action.type) {
    case 'push': {
      if (stableStringify(safe.current) === stableStringify(action.next)) return safe;
      const past = [...safe.past, safe.current];
      const future: T[] = [];
      if (past.length > action.capacity) past.shift();
      return { current: action.next, past, future };
    }
    case 'replace':
      if (stableStringify(safe.current) === stableStringify(action.next)) return safe;
      return { ...safe, current: action.next };
    case 'undo': {
      if (safe.past.length === 0) return safe;
      const past = safe.past.slice(0, -1);
      const previous = safe.past[safe.past.length - 1];
      const future = [...safe.future, safe.current];
      if (future.length > action.capacity) future.shift();
      return { current: previous, past, future };
    }
    case 'redo': {
      if (safe.future.length === 0) return safe;
      const future = safe.future.slice(0, -1);
      const next = safe.future[safe.future.length - 1];
      const past = [...safe.past, safe.current];
      if (past.length > action.capacity) past.shift();
      return { current: next, past, future };
    }
    case 'reset': {
      return { current: action.value, past: [], future: [] };
    }
  }
}

export function useFlowHistory<T>(
  initial: T,
  options: UseFlowHistoryOptions<T> = {},
): UseFlowHistoryReturn<T> {
  const { capacity = 200, withSeed = false } = options;
  const capacityRef = useRef(capacity);
  capacityRef.current = capacity;

  // Lazy initializer avoids the second-pass undefined issue.
  const [state, dispatch] = useReducer(
    reducer as unknown as (s: HistoryState<T> | undefined, a: HistoryAction<T>) => HistoryState<T>,
    (() => safeInitial(initial, withSeed)) as unknown as HistoryState<T>,
    () => safeInitial(initial, withSeed),
  );

  const push = useCallback((next: T) => {
    dispatch({ type: 'push', next, capacity: capacityRef.current });
  }, []);

  const replace = useCallback((next: T) => {
    dispatch({ type: 'replace', next });
  }, []);

  const undo = useCallback((): T | null => {
    if (state.past.length === 0) return null;
    const last = state.past[state.past.length - 1];
    dispatch({ type: 'undo', capacity: capacityRef.current });
    return last;
  }, [state.past]);

  const redo = useCallback((): T | null => {
    if (state.future.length === 0) return null;
    const next = state.future[state.future.length - 1];
    dispatch({ type: 'redo', capacity: capacityRef.current });
    return next;
  }, [state.future]);

  const reset = useCallback((value: T) => {
    dispatch({ type: 'reset', value, capacity: capacityRef.current });
  }, []);

  const safe = state ?? safeInitial(initial, withSeed);

  return useMemo(
    () => ({
      state: safe.current,
      push,
      replace,
      undo,
      redo,
      reset,
      canUndo: safe.past.length > 0,
      canRedo: safe.future.length > 0,
      past: safe.past.length,
      future: safe.future.length,
    }),
    [safe, push, replace, undo, redo, reset],
  );
}
