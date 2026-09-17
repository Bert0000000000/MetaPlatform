import { describe, expect, it } from 'vitest';
import { computeWaves, countStubFallbacks, isStubFallback, subtaskState } from './agentTeamRunView';
import type { SubTask, SubTaskResult } from '@/api/agentTeam';

function task(task_id: string, depends_on: string[] = []): SubTask {
  return { task_id, profile_id: `EMP-${task_id}`, instruction: `do ${task_id}`, depends_on };
}

function result(status: SubTaskResult['status'], output = ''): SubTaskResult {
  return {
    task_id: 't1',
    team_task_id: 'tt1',
    profile_id: 'EMP-t1',
    status,
    output,
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

describe('isStubFallback', () => {
  it('认出 llmgw 的回显正文', () => {
    expect(isStubFallback('[stub-fallback] OpenAI unavailable. Echo: 查一下订单')).toBe(true);
  });

  it('真实答复不算回显', () => {
    expect(isStubFallback('本月共 128 笔订单，其中异常 7 笔。')).toBe(false);
  });

  it('空产出与空值不算回显', () => {
    expect(isStubFallback('')).toBe(false);
    expect(isStubFallback(null)).toBe(false);
    expect(isStubFallback(undefined)).toBe(false);
  });
});

describe('countStubFallbacks', () => {
  it('只数回显的那几个，status=ok 也照数', () => {
    // 关键：回显的产出**状态仍是 ok** —— 光看 status 会被骗，所以要单独计数
    const results = [
      result('ok', '真实答复一'),
      result('ok', '[stub-fallback] OpenAI unavailable. Echo: 指令'),
      result('error', ''),
      result('ok', '[stub-fallback] OpenAI unavailable. Echo: 指令'),
    ];
    expect(countStubFallbacks(results)).toBe(2);
  });

  it('没有回显时是 0', () => {
    expect(countStubFallbacks([result('ok', '正常产出')])).toBe(0);
  });
});
