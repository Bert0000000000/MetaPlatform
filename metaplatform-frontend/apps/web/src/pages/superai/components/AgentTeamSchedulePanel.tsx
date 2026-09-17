import { useMemo, useState } from 'react';
import { Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { RunState } from '@/api/agentTeam';
import { SheetDetail } from '@/components/skeleton';
import AgentTeamSchedule from './AgentTeamSchedule';
import { STATUS_TAG, computeWaves, countStubFallbacks, subtaskState } from '../agentTeamRunView';

/**
 * 调度任务 · **紧凑面板**（会话页右上角，会话历史栏里「新建会话」之上）。
 *
 * 为什么是紧凑版而不是直接放 `AgentTeamSchedule`：那一份是给工作台整页用的
 * 六列表格，塞进 200~360px 的侧栏只会横向溢出。这里按同一份 run 状态**收成竖排**
 * ——波次 / 员工 / 终态三样，点「详情」才用 `SheetDetail` 打开完整视图。
 *
 * **数据只有一个来源**：两处都读同一个 `RunState`，紧凑面板不另算、不缓存。
 */

export interface AgentTeamSchedulePanelProps {
  run: RunState | null;
  runId: string;
  live?: boolean;
  busy?: boolean;
  onApprove?: (approved: boolean) => void;
  onCancel?: () => void;
}

export default function AgentTeamSchedulePanel({
  run,
  runId,
  live = false,
  busy = false,
  onApprove,
  onCancel,
}: AgentTeamSchedulePanelProps) {
  const [open, setOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  const results = useMemo(() => Object.values(run?.results ?? {}), [run]);
  const waves = useMemo(() => computeWaves(run?.subtasks ?? []), [run]);
  const evidenceCount = results.reduce((sum, r) => sum + (r.evidence?.length ?? 0), 0);
  const artifactCount = results.reduce((sum, r) => sum + (r.artifacts?.length ?? 0), 0);
  const fallbackCount = countStubFallbacks(results);
  const status = run ? STATUS_TAG[run.status] : null;
  const canCancel =
    !!onCancel &&
    !!run &&
    !['completed', 'failed', 'cancelled', 'timeout'].includes(run.status);

  return (
    <div className="mp-schedpanel" data-testid="chat-schedule-panel">
      <div className="mp-schedpanel-head">
        <span className="mp-schedpanel-title">调度任务</span>
        <span className="mp-team-chips">
          {status ? (
            <Tag color={status.color} type="light" size="small" data-testid="chat-schedule-status">
              {status.label}
            </Tag>
          ) : null}
          {live ? (
            <Tag color="blue" type="light" size="small" data-testid="chat-schedule-live">
              实时
            </Tag>
          ) : null}
        </span>
      </div>

      {!run && !runId ? (
        <Typography.Text type="tertiary" size="small" data-testid="chat-schedule-empty">
          打开输入框上的「Agent 产品层」后发一句话，这里显示任务图与员工状态。
        </Typography.Text>
      ) : null}

      {runId && !run ? (
        <Typography.Text type="tertiary" size="small">已受理，正在取回这一轮的状态…</Typography.Text>
      ) : null}

      {run ? (
        <>
          <div className="mp-schedpanel-actions">
            <button
              type="button"
              className="mp-proposal-btn"
              onClick={() => setOpen((v) => !v)}
              data-testid="chat-schedule-toggle"
            >
              {open ? '收起' : '展开'}
            </button>
            <button
              type="button"
              className="mp-proposal-btn"
              onClick={() => setDetailOpen(true)}
              data-testid="chat-schedule-detail"
            >
              详情
            </button>
          </div>

          {open ? (
            <>
              <div className="mp-schedpanel-kpis">
                <span className="mp-schedpanel-kpi" data-testid="chat-schedule-employees">
                  员工 {results.length} / {run.subtasks.length}
                </span>
                <span className="mp-schedpanel-kpi">波次 {run.subtasks.length ? Math.max(...run.subtasks.map((s) => waves[s.task_id])) + 1 : 0}</span>
                <span className="mp-schedpanel-kpi">证据 {evidenceCount}</span>
                <span className="mp-schedpanel-kpi">交付物 {artifactCount}</span>
                {fallbackCount > 0 ? (
                  <span className="mp-schedpanel-kpi mp-schedpanel-kpi--warn" data-testid="chat-schedule-fallback">
                    回显 {fallbackCount}/{results.length}
                  </span>
                ) : null}
              </div>

              <div className="mp-schedpanel-section" data-testid="chat-schedule-graph">
                <div className="mp-schedpanel-label">任务图</div>
                {run.subtasks.length === 0 ? (
                  <Typography.Text type="tertiary" size="small">拆解中…</Typography.Text>
                ) : (
                  <ul className="mp-schedpanel-list">
                    {run.subtasks.map((subtask) => {
                      const state = subtaskState(subtask, run.results ?? {});
                      return (
                        <li key={subtask.task_id} className="mp-schedpanel-row">
                          <Tag size="small" type="light" color="blue">
                            第 {waves[subtask.task_id] + 1} 波
                          </Tag>
                          <Typography.Text size="small" ellipsis={{ showTooltip: true }} className="mp-schedpanel-name">
                            {subtask.profile_id}
                          </Typography.Text>
                          <Tag size="small" type="light" color={state.color}>
                            {state.label}
                          </Tag>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {run.status === 'awaiting_approval' ? (
                <div className="mp-schedpanel-gate" data-testid="chat-schedule-gate">
                  <Typography.Text size="small" type="tertiary">
                    {run.hitl_reason || '等待人工确认'}
                  </Typography.Text>
                  <Space spacing={6}>
                    <button
                      type="button"
                      className="mp-proposal-btn mp-proposal-btn--primary"
                      disabled={busy}
                      onClick={() => onApprove?.(true)}
                      data-testid="agent-team-approve"
                    >
                      确认并继续
                    </button>
                    <button
                      type="button"
                      className="mp-proposal-btn mp-proposal-btn--danger"
                      disabled={busy}
                      onClick={() => onApprove?.(false)}
                      data-testid="agent-team-reject"
                    >
                      驳回
                    </button>
                  </Space>
                </div>
              ) : null}

              {canCancel ? (
                <button
                  type="button"
                  className="mp-proposal-btn"
                  disabled={busy}
                  onClick={() => onCancel?.()}
                  data-testid="agent-team-cancel"
                >
                  取消这一轮
                </button>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* 详情：完整视图（任务图六列表格 / 员工状态表 / 证据 / 交付物 / 汇总）。
          与工作台用的是同一个 AgentTeamSchedule，所以不会出现两套说法。 */}
      <SheetDetail
        title="调度详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        footer={
          <Typography.Text type="tertiary">
            run_id：{runId || '—'} · 任务图 / 员工状态 / 证据 / 交付物均来自本轮 run 状态
          </Typography.Text>
        }
      >
        <div data-testid="chat-schedule-detail-body">
          <AgentTeamSchedule
            run={run}
            runId={runId}
            live={live}
            busy={busy}
            onApprove={onApprove}
            onCancel={onCancel}
          />
        </div>
      </SheetDetail>
    </div>
  );
}
