/**
 * 纯函数 historyStack — useUndoRedo 的核心算法, 可在无 React 环境下测试.
 *
 * 维护 current + past[] + future[].
 *
 * commit(value):
 *   - if (current === value) skip
 *   - else push current → past (cap)
 *   - clear future
 *   - current = value
 *
 * undo():
 *   - if past empty → false
 *   - else push current → future, current = past.pop()
 *
 * redo():
 *   - if future empty → false
 *   - else push current → past, current = future.pop()
 *
 * coalesceKey: commit(value, key) 当 key 与 past 顶端相同且时间窗口 < mergeWindowMs,
 *   不创建新 entry, 而是替换 current 并保留栈深 (等同于 "视为同一动作的延续").
 *   这种场景 past 顶端保存的是 "本组动作开始前的状态".
 */

export interface StackEntry<T> {
  value: T;
  coalesceKey?: string;
  _ts: number;
}

export interface HistoryOptions {
  capacity?: number;
  mergeWindowMs?: number;
  equals?: (a: unknown, b: unknown) => boolean;
}

export class HistoryStack<T> {
  private past: StackEntry<T>[] = [];
  private future: StackEntry<T>[] = [];
  private current: T;
  private capacity: number;
  private mergeWindowMs: number;
  private equals: (a: unknown, b: unknown) => boolean;

  constructor(initial: T, options: HistoryOptions = {}) {
    this.current = initial;
    this.capacity = options.capacity ?? 20;
    this.mergeWindowMs = options.mergeWindowMs ?? 500;
    this.equals = options.equals ?? Object.is;
  }

  getState(): T {
    return this.current;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  pastDepth(): number {
    return this.past.length;
  }

  futureDepth(): number {
    return this.future.length;
  }

  /** 直接覆盖当前值不入栈 (用于外部 reset / 加载). */
  setState(value: T): void {
    this.current = value;
  }

  /**
   * 提交新值并入栈.
   * - 值未变 → 不入栈.
   * - coalesceKey 与 past 顶端相同且在 mergeWindow 内 → 跳过 push (视为连续动作的延续).
   * - 否则把 current 推入 past, 容量满了 shift, 清空 future, 更新 current.
   */
  commit(value: T, coalesceKey?: string, now: number = Date.now()): void {
    if (this.equals(this.current, value)) return;

    const last = this.past[this.past.length - 1];
    const canMerge =
      coalesceKey &&
      last &&
      last.coalesceKey === coalesceKey &&
      now - last._ts < this.mergeWindowMs;

    if (!canMerge) {
      this.past.push({
        value: this.current,
        coalesceKey,
        _ts: now,
      });
      if (this.past.length > this.capacity) {
        this.past.shift();
      }
    }
    // 注意: merge 时不更新 _ts, 因为合并后整体应保留首次时间.
    // 但 current 仍需更新, 因为状态确实变了.

    this.future = [];
    this.current = value;
  }

  undo(): boolean {
    if (this.past.length === 0) return false;
    const entry = this.past.pop()!;
    this.future.push({
      value: this.current,
      coalesceKey: entry.coalesceKey,
      _ts: Date.now(),
    });
    if (this.future.length > this.capacity) {
      this.future.shift();
    }
    this.current = entry.value;
    return true;
  }

  redo(): boolean {
    if (this.future.length === 0) return false;
    const entry = this.future.pop()!;
    this.past.push({
      value: this.current,
      coalesceKey: entry.coalesceKey,
      _ts: Date.now(),
    });
    if (this.past.length > this.capacity) {
      this.past.shift();
    }
    this.current = entry.value;
    return true;
  }

  reset(initial: T): void {
    this.past = [];
    this.future = [];
    this.current = initial;
  }
}