import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Download } from 'lucide-react';
import {
  getArtifact,
  listRunArtifacts,
  type Artifact,
  type ArtifactContent,
  type RunState,
  type SubTask,
  type SubTaskResult,
} from '@/api/agentTeam';
import { SheetDetail } from '@/components/skeleton';
import {
  STATUS_TAG,
  computeWaves,
  countStubFallbacks,
  formatBytes,
  formatDeadline,
  isStubFallback,
  subtaskState,
  toolCallLabel,
} from '../agentTeamRunView';
import EvidenceRenderer from './EvidenceRenderer';

/**
 * 一轮 agent-team run 的**调度可视化**——任务图 / 员工状态 / 波次 / 终态 /
 * 证据 / 交付物。工作台（`AgentTeamRunPage`）与会话页（`ChatPage`）用的是**同一个**
 * 组件：同一轮运行在两个页面上只有一种样子。
 *
 * 这里**只渲染后端给的 run 状态**，不拼装、不伪造。证据沿用 SuperAI 那一个
 * `EvidenceRenderer`（1.6 定的），交付物正文按 id 现取。
 *
 * 状态文案 / 波次划分 / 格式化这些**不依赖组件库**的纯逻辑在 `../agentTeamRunView`。
 */

export interface AgentTeamScheduleProps {
  run: RunState | null;
  runId: string;
  /** 事件流连着没有——UI 上要说实话，别让人以为"不动"就是"没在跑"。 */
  live?: boolean;
  /** 控制面调用进行中（确认 / 驳回 / 取消）。 */
  busy?: boolean;
  onApprove?: (approved: boolean) => void;
  onCancel?: () => void;
}

export default function AgentTeamSchedule({
  run,
  runId,
  live = false,
  busy = false,
  onApprove,
  onCancel,
}: AgentTeamScheduleProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactContent | null>(null);
  const [loadingArtifactId, setLoadingArtifactId] = useState('');

  const status = run ? STATUS_TAG[run.status] : null;
  const results = useMemo(() => Object.values(run?.results ?? {}), [run]);
  const evidenceCount = results.reduce((sum, r) => sum + (r.evidence?.length ?? 0), 0);
  const fallbackCount = countStubFallbacks(results);
  const waves = useMemo(() => computeWaves(run?.subtasks ?? []), [run]);
  const waveCount = useMemo(
    () => (run?.subtasks.length ? Math.max(...run.subtasks.map((s) => waves[s.task_id])) + 1 : 0),
    [run, waves],
  );

  // 交付物清单随 run 状态刷新一起拉：证据/交付物与任务图必须是**同一时刻**的快照，
  // 分两次取会拼出一个从未存在过的中间态。
  useEffect(() => {
    if (!runId) {
      setArtifacts([]);
      return;
    }
    let cancelled = false;
    listRunArtifacts(runId)
      .then((items) => {
        if (!cancelled) setArtifacts(items);
      })
      .catch(() => {
        if (!cancelled) setArtifacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, run?.status, results.length]);

  // 交付物详情按 id 现取：列表里只有元数据，正文不跟着列表一起拖过来。
  const openArtifact = useCallback(async (artifactId: string) => {
    setLoadingArtifactId(artifactId);
    try {
      setActiveArtifact(await getArtifact(artifactId));
    } catch (e) {
      Toast.error(`取回交付物失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingArtifactId('');
    }
  }, []);

  const subtaskColumns: ColumnProps<SubTask>[] = [
    { title: '子任务', dataIndex: 'task_id', width: 90 },
    {
      title: '波次',
      width: 80,
      render: (_: unknown, subtask: SubTask) => (
        <Tag color="blue" type="light" data-wave={waves[subtask.task_id] + 1}>
          第 {waves[subtask.task_id] + 1} 波
        </Tag>
      ),
    },
    {
      title: '承接员工',
      dataIndex: 'profile_id',
      width: 170,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '依赖',
      dataIndex: 'depends_on',
      width: 110,
      render: (deps: string[]) =>
        deps.length === 0 ? (
          <Typography.Text type="tertiary">第一波</Typography.Text>
        ) : (
          <span className="mp-team-chips">
            {deps.map((dep) => (
              <Tag key={dep} size="small" type="light">
                {dep}
              </Tag>
            ))}
          </span>
        ),
    },
    {
      title: '终态',
      width: 110,
      render: (_: unknown, subtask: SubTask) => {
        const state = subtaskState(subtask, run?.results ?? {});
        return (
          <Tag color={state.color} type="light" data-done={state.done}>
            {state.label}
          </Tag>
        );
      },
    },
    { title: '指令', dataIndex: 'instruction' },
  ];

  const employeeColumns: ColumnProps<SubTaskResult>[] = [
    {
      title: '数字员工',
      dataIndex: 'profile_id',
      width: 170,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '子任务',
      dataIndex: 'task_id',
      width: 110,
      render: (value: string) => (
        <Typography.Text type="tertiary" data-task-id={value}>
          {value}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: SubTaskResult['status'], record: SubTaskResult) => (
        <span className="mp-team-chips">
          <Tag
            color={value === 'ok' ? 'green' : value === 'rejected' ? 'amber' : 'red'}
            type="light"
          >
            {value === 'ok' ? '已完成' : value === 'rejected' ? '转待授权' : '失败'}
          </Tag>
          {isStubFallback(record.output) ? (
            <Tag color="amber" type="light" size="small" data-stub-fallback>
              回显
            </Tag>
          ) : null}
        </span>
      ),
    },
    {
      title: '模型调用',
      dataIndex: 'llm_calls',
      width: 100,
      render: (value: number) => <Typography.Text type="tertiary">{value} 次</Typography.Text>,
    },
    {
      title: '运行时调用',
      dataIndex: 'attempts',
      width: 110,
      render: (value: number) => <Typography.Text type="tertiary">{value} 次</Typography.Text>,
    },
    {
      title: '失败类别',
      dataIndex: 'error_code',
      width: 140,
      render: (value: string) =>
        value ? (
          <Tag color="amber" type="light">
            {value}
          </Tag>
        ) : (
          <Typography.Text type="tertiary">—</Typography.Text>
        ),
    },
  ];

  const artifactColumns: ColumnProps<Artifact>[] = [
    {
      title: '交付物',
      dataIndex: 'artifact_id',
      render: (value: string) => (
        <button
          type="button"
          className="mp-proposal-btn mp-proposal-btn"
          disabled={loadingArtifactId === value}
          onClick={() => void openArtifact(value)}
          data-artifact-id={value}
        >
          <Download size={14} />
          {value}
        </button>
      ),
    },
    {
      title: '员工',
      dataIndex: 'profile_id',
      width: 170,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    { title: '种类', dataIndex: 'kind', width: 100 },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (value: number) => <Typography.Text type="tertiary">{formatBytes(value)}</Typography.Text>,
    },
    {
      title: '落库时刻',
      dataIndex: 'created_at',
      width: 200,
      render: (value: string) => <Typography.Text type="tertiary">{value}</Typography.Text>,
    },
  ];

  return (
    <>
      {run?.error ? (
        <Banner type="danger" description={run.error} closeIcon={null} className="mp-team-gap" />
      ) : null}

      {!run ? null : (
        <>
          <div className="mp-exec-kpis" data-testid="agent-team-overview">
            <div className="mp-exec-kpi">
              <span className="mp-exec-kpi-label">终态</span>
              <span className="mp-exec-kpi-value" data-testid="agent-team-status">
                <span className={`mp-exec-dot${run.status === 'running' ? ' is-running' : ''}`} />
                {status?.label}
              </span>
            </div>
            <div className="mp-exec-kpi">
              <span className="mp-exec-kpi-label">数字员工</span>
              <span className="mp-exec-kpi-value">
                {results.length} / {run.subtasks.length}
              </span>
            </div>
            <div className="mp-exec-kpi">
              <span className="mp-exec-kpi-label">波次</span>
              <span className="mp-exec-kpi-value" data-testid="agent-team-wave-count">
                {waveCount}
              </span>
            </div>
            <div className="mp-exec-kpi">
              <span className="mp-exec-kpi-label">证据</span>
              <span className="mp-exec-kpi-value" data-testid="agent-team-evidence-count">
                {evidenceCount}
              </span>
            </div>
            <div className="mp-exec-kpi">
              <span className="mp-exec-kpi-label">交付物</span>
              <span className="mp-exec-kpi-value" data-testid="agent-team-artifact-count">
                {artifacts.length}
              </span>
            </div>
            {fallbackCount > 0 ? (
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">回显</span>
                <span className="mp-exec-kpi-value" data-testid="agent-team-fallback-count">
                  {fallbackCount} / {results.length}
                </span>
              </div>
            ) : null}
          </div>

          <span className="mp-team-meta">
            {live ? (
              <Tag color="blue" type="light" data-testid="agent-team-live">
                实时
              </Tag>
            ) : null}
            {status ? (
              <Tag color={status.color} type="light">
                {status.label}
              </Tag>
            ) : null}
            <Typography.Text type="tertiary">run_id：{run.run_id}</Typography.Text>
            <Typography.Text type="tertiary">租户：{run.tenant_id}</Typography.Text>
            <Typography.Text type="tertiary">
              运行级超时：{run.timeout_seconds > 0 ? `${run.timeout_seconds}s` : '不限'} · 截止：
              {formatDeadline(run.deadline_at)}
            </Typography.Text>
          </span>

          {run.hitl_reason ? (
            <Typography.Paragraph type="tertiary" className="mp-team-gap-sm">
              {run.hitl_reason}
            </Typography.Paragraph>
          ) : null}

          <div className="mp-team-subsection" data-testid="agent-team-graph">
            <div className="mp-evidence-section-title">任务图 · {run.subtasks.length} 个子任务</div>
            <Table
              pagination={false}
              size="small"
              rowKey="task_id"
              dataSource={run.subtasks}
              columns={subtaskColumns}
            />
          </div>

          {results.length > 0 ? (
            <div className="mp-team-subsection" data-testid="agent-team-employees">
              <div className="mp-evidence-section-title">员工状态 · {results.length} 名</div>
              <Table
                pagination={false}
                size="small"
                rowKey="task_id"
                dataSource={results}
                columns={employeeColumns}
              />
            </div>
          ) : null}

          {run.status === 'awaiting_approval' ? (
            <div className="mp-team-subsection" data-testid="agent-team-hitl">
              <div className="mp-evidence-section-title">人工确认闸门</div>
              <Banner
                type="warning"
                description={run.hitl_reason || '员工已产出，等待人工确认后汇总'}
                closeIcon={null}
              />
              <div className="mp-team-actions">
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
              </div>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="mp-team-subsection" data-testid="agent-team-results">
              <div className="mp-evidence-section-title">产出 · 证据 · 交付物</div>
              {results.map((result) => (
                <div key={result.task_id} className="mp-team-employee" data-testid={`agent-team-result-${result.task_id}`}>
                  <span className="mp-team-chips">
                    <Tag color="blue">{result.profile_id}</Tag>
                    <Tag color={result.status === 'ok' ? 'green' : 'red'} type="light">
                      {result.status}
                    </Tag>
                    <Typography.Text type="tertiary">
                      模型调用 {result.llm_calls} 次 · 来源 {result.source} · 调用 {result.attempts} 次
                    </Typography.Text>
                    {result.error_code ? (
                      <Tag color="amber" type="light">
                        {result.error_code}
                      </Tag>
                    ) : null}
                  </span>

                  {result.tool_calls.length > 0 ? (
                    <span className="mp-team-chips">
                      {result.tool_calls.map((call, index) => {
                        const label = toolCallLabel(call);
                        return (
                          <Tag
                            key={index}
                            size="small"
                            color={label.color}
                            type="light"
                            data-tool={String(call.name ?? '')}
                          >
                            {label.text}
                          </Tag>
                        );
                      })}
                    </span>
                  ) : null}

                  {isStubFallback(result.output) ? (
                    <Banner
                      type="warning"
                      closeIcon={null}
                      data-testid={`agent-team-fallback-${result.task_id}`}
                      description="这条产出是 llmgw 的 stub-fallback **回显**——它把指令原样抄了回来，不是模型答复。员工状态仍是 ok，但这段文字不能当结论看。"
                    />
                  ) : null}

                  <Typography.Paragraph className="mp-team-output">
                    {result.output || result.error || '（无产出）'}
                  </Typography.Paragraph>

                  <div className="mp-team-subsection" data-testid={`agent-team-evidence-${result.task_id}`}>
                    <div className="mp-evidence-section-title">
                      证据 {result.evidence?.length ? `· ${result.evidence.length} 条` : ''}
                    </div>
                    {result.evidence?.length ? (
                      <EvidenceRenderer evidenceList={result.evidence} />
                    ) : (
                      <Typography.Text type="tertiary">
                        这名员工没有产出可取证的结果（工具没调，或调了但结果里没有可指认的字段）。
                      </Typography.Text>
                    )}
                  </div>

                  <div className="mp-team-subsection" data-testid={`agent-team-artifacts-${result.task_id}`}>
                    <div className="mp-evidence-section-title">
                      交付物 {result.artifacts?.length ? `· ${result.artifacts.length} 件` : ''}
                    </div>
                    {result.artifacts?.length ? (
                      <span className="mp-team-chips">
                        {result.artifacts.map((artifact) => (
                          <button
                            key={artifact.artifact_id}
                            type="button"
                            className="mp-proposal-btn mp-proposal-btn"
                            disabled={loadingArtifactId === artifact.artifact_id}
                            onClick={() => void openArtifact(artifact.artifact_id)}
                            data-artifact-id={artifact.artifact_id}
                          >
                            <Download size={12} />
                            {artifact.title || artifact.artifact_id}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <Typography.Text type="tertiary">这名员工没有产出交付物。</Typography.Text>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {artifacts.length > 0 ? (
            <div className="mp-team-subsection" data-testid="agent-team-artifact-table">
              <div className="mp-evidence-section-title">本轮交付物 · {artifacts.length} 件</div>
              <Table
                pagination={false}
                size="small"
                rowKey="artifact_id"
                dataSource={artifacts}
                columns={artifactColumns}
              />
            </div>
          ) : null}

          {run.summary ? (
            <div className="mp-team-subsection" data-testid="agent-team-summary">
              <div className="mp-evidence-section-title">汇总</div>
              <Typography.Paragraph className="mp-team-output">{run.summary}</Typography.Paragraph>
            </div>
          ) : null}

          {onCancel && run.status !== 'completed' && run.status !== 'failed' && run.status !== 'cancelled' && run.status !== 'timeout' ? (
            <div className="mp-team-actions" data-testid="agent-team-cancel-row">
              <button
                type="button"
                className="mp-proposal-btn"
                disabled={busy}
                onClick={() => onCancel()}
                data-testid="agent-team-cancel"
              >
                取消这一轮
              </button>
            </div>
          ) : null}
        </>
      )}

      <SheetDetail
        title={activeArtifact ? `交付物 · ${activeArtifact.artifact_id}` : '交付物'}
        open={activeArtifact !== null}
        onClose={() => setActiveArtifact(null)}
        footer={<Typography.Text type="tertiary">交付物落库后只读；正文按 id 取回</Typography.Text>}
      >
        {activeArtifact ? (
          <div className="mp-evidence-sheet">
            <div>
              <div className="mp-evidence-field-label">员工</div>
              <Tag color="blue">{activeArtifact.profile_id}</Tag>
            </div>
            <div>
              <div className="mp-evidence-field-label">种类 / 媒体类型</div>
              <span className="mp-team-chips">
                <Tag color="grey" type="light">
                  {activeArtifact.kind}
                </Tag>
                <Tag color="grey" type="light">
                  {activeArtifact.content_type}
                </Tag>
                <Tag color="grey" type="light">
                  {formatBytes(activeArtifact.size)}
                </Tag>
              </span>
            </div>
            <div>
              <div className="mp-evidence-field-label">落库时刻</div>
              <Typography.Text>{activeArtifact.created_at}</Typography.Text>
            </div>
            <div>
              <div className="mp-evidence-field-label">正文</div>
              <Typography.Paragraph copyable className="mp-evidence-fragment-box mp-team-artifact-body">
                {activeArtifact.content}
              </Typography.Paragraph>
            </div>
          </div>
        ) : null}
      </SheetDetail>
    </>
  );
}
