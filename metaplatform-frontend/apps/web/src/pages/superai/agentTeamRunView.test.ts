import { describe, expect, it } from 'vitest';
import { computeWaves, subtaskState } from './agentTeamRunView';
import type { SubTask, SubTaskResult } from '@/api/agentTeam';

function task(task_id: string, depends_on: string[] = []): SubTask {
  return { task_id, profile_id: `EMP-${task_id}`, instruction: `do ${task_id}`, depends_on };
}

function result(status: SubTaskResult['status']): SubTaskResult {
  return {
    task_id: 't1',
    team_task_id: 'tt1',
    profile_id: 'EMP-t1',
    status,
    output: '',
    tool_calls: [],
    llm_calls: 1,
    source: 'llm',
    error: '',
    error_code: '',
    proposal: {},
    attempts: 1,
    evidence: [],
    artifacts: [],
  };
}

describe('computeWaves', () => {
  it('无依赖的都是第 1 波', () => {
    const waves = computeWaves([task('t1'), task('t2'), task('t3')]);
    expect(waves).toEqual({ t1: 0, t2: 0, t3: 0 });
  });

  it('链式依赖按最长路径分波', () => {
    const waves = computeWaves([task('t1'), task('t2', ['t1']), task('t3', ['t2'])]);
    expect(waves).toEqual({ t1: 0, t2: 1, t3: 2 });
  });

  it('菱形依赖取最长的那条路径，不是最短', () => {
    // t1 → t2 → t4 与 t1 → t4：t4 必须在第 3 波，不能因为能直接依赖 t1 就提前
    const waves = computeWaves([
      task('t1'),
      task('t2', ['t1']),
      task('t3', ['t1']),
      task('t4', ['t2', 't3']),
    ]);
    expect(waves).toEqual({ t1: 0, t2: 1, t3: 1, t4: 2 });
  });

  it('成环不死循环（计划期本该被后端判失败）', () => {
    const waves = computeWaves([task('t1', ['t2']), task('t2', ['t1'])]);
    expect(Object.keys(waves).sort()).toEqual(['t1', 't2']);
  });

  it('悬空依赖不会把整张图带崩', () => {
    const waves = computeWaves([task('t1', ['不存在']), task('t2')]);
    expect(waves.t2).toBe(0);
  });
});

describe('subtaskState', () => {
  it('没有回执 = 未派发', () => {
    expect(subtaskState(task('t1'), {}).label).toBe('未派发');
  });

  it('越权转待授权与失败要分得开', () => {
    expect(subtaskState(task('t1'), { t1: result('rejected') })).toMatchObject({
      label: '转待授权',
      done: true,
    });
    expect(subtaskState(task('t1'), { t1: result('error') })).toMatchObject({
      label: '失败',
      done: true,
    });
    expect(subtaskState(task('t1'), { t1: result('ok') })).toMatchObject({
      label: '已完成',
      done: true,
    });
  });
});
