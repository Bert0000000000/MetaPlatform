/**
 * FlowRunner 执行模拟 —— 类型定义
 * --------------------------------------------------
 * 纯前端流程执行状态机：自动节点延迟推进、审批节点暂停（模拟 Flowable）、
 * HITL 节点暂停（模拟自建 proposal/token 确认）。
 */
import type { ReactNode } from 'react';

/** 单个节点的执行状态 */
export type ExecState =
  | 'idle'
  | 'running'
  | 'completed'
  | 'hitl_waiting'
  | 'approval_waiting'
  | 'rejected'
  | 'failed';

/** 流程整体状态 */
export type RunnerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface RunnerLog {
  id: string;
  time: string;
  nodeId: string;
  nodeTitle: string;
  event: string;
  detail?: string;
}

export const EXEC_STATE_TEXT: Record<ExecState, string> = {
  idle: '待执行',
  running: '执行中',
  completed: '已完成',
  hitl_waiting: '待人工确认',
  approval_waiting: '待审批',
  rejected: '已驳回',
  failed: '失败',
};

export const EXEC_STATE_COLOR: Record<ExecState, string> = {
  idle: 'transparent',
  running: '#1677ff',
  completed: '#52c41a',
  hitl_waiting: '#fa8c16',
  approval_waiting: '#722ed1',
  rejected: '#ff4d4f',
  failed: '#ff4d4f',
};

export const RUNNER_STATUS_TEXT: Record<RunnerStatus, string> = {
  idle: '待执行',
  running: '执行中',
  paused: '已暂停',
  finished: '已完成',
};

export const LOG_EVENT_TEXT: Record<string, string> = {
  enter: '进入',
  complete: '完成',
  hitl: '待确认',
  approval: '待审批',
  branch: '分支',
  reject: '驳回',
  finish: '结束',
  pause: '暂停',
  resume: '继续',
  error: '错误',
};

export interface RunnerApi {
  stateMap: Record<string, ExecState>;
  logs: RunnerLog[];
  status: RunnerStatus;
  stepDelay: number;
  setStepDelay(delay: number): void;
  run(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  resolveHitl(nodeId: string, approved: boolean): void;
  resolveApproval(nodeId: string, approved: boolean): void;
}

export interface RunnerContextValue {
  api: RunnerApi;
  /** 当前处于待确认 / 待审批的节点 id（供弹层使用） */
  waitingHitlId: string | null;
  waitingApprovalId: string | null;
  getNodeData(nodeId: string): Record<string, unknown> | undefined;
}

export type { ReactNode };
