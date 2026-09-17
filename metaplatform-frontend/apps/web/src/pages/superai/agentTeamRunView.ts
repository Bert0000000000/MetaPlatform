import type { RunStatus, SubTask, SubTaskResult } from '@/api/agentTeam';

/**
 * 一轮 agent-team run 的**纯展示逻辑**：状态文案、波次划分、格式化。
 *
 * 与渲染分开放，一是它不依赖任何组件库（能在 node 环境下直接跑测试），二是
 * 波次划分是这里唯一一处**前端自己算**的东西——后端按 `depends_on` 分波执行，
 * 前端必须显示**同一个划分**，值得单独钉住。
 */

export const STATUS_TAG: Record<RunStatus, { color: 'grey' | 'blue' | 'amber' | 'green' | 'red'; label: string }> = {
  planning: { color: 'grey', label: '拆解中' },
  running: { color: 'blue', label: '执行中' },
  awaiting_approval: { color: 'amber', label: '等待人工确认' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
  cancelled: { color: 'grey', label: '已取消' },
  timeout: { color: 'red', label: '已超时' },
};

/** 子任务在任务图上的状态：还没回执 = 未派发。 */
export function subtaskState(subtask: SubTask, results: Record<string, SubTaskResult>) {
  const result = results[subtask.task_id];
  if (!result) return { color: 'grey' as const, label: '未派发', done: false };
  if (result.status === 'ok') return { color: 'green' as const, label: '已完成', done: true };
  if (result.status === 'rejected') return { color: 'amber' as const, label: '转待授权', done: true };
  return { color: 'red' as const, label: '失败', done: true };
}

/**
 * 波次 = 依赖图上的**最长路径深度**（返回值 0 基，显示时 +1）。无依赖为第 1 波。
 *
 * 成环与悬空依赖都返回 0 而不是抛错：计划期就该被后端判失败，前端不因此死循环、
 * 也不把整张图带崩。
 */
export function computeWaves(subtasks: SubTask[]): Record<string, number> {
  const byId = new Map(subtasks.map((s) => [s.task_id, s]));
  const cache = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);
    const task = byId.get(id);
    if (!task || task.depends_on.length === 0) {
      cache.set(id, 0);
      return 0;
    }
    const value = Math.max(...task.depends_on.map((dep) => depth(dep, seen))) + 1;
    cache.set(id, value);
    return value;
  };
  const waves: Record<string, number> = {};
  for (const task of subtasks) waves[task.task_id] = depth(task.task_id, new Set());
  return waves;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

export function formatDeadline(epochSeconds: number): string {
  if (!epochSeconds) return '不限时';
  return new Date(epochSeconds * 1000).toLocaleString('zh-CN');
}

/** 工具调用标签的文案：拒绝 / 出错 / 正常三种要分得开。 */
export function toolCallLabel(call: Record<string, unknown>): { text: string; color: 'grey' | 'red' | 'amber' } {
  const name = String(call.name ?? '?');
  if (call.allowed === false) return { text: `${name}（拒绝：${String(call.rejected)}）`, color: 'red' };
  if (call.error) return { text: `${name}（出错）`, color: 'amber' };
  return { text: name, color: 'grey' };
}
