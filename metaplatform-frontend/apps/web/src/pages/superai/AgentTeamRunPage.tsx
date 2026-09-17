import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Input,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { CheckCircle2, Download, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  approveRun,
  getArtifact,
  getRun,
  listRunArtifacts,
  startRun,
  type Artifact,
  type ArtifactContent,
  type RunState,
  type RunStatus,
  type SubTask,
  type SubTaskResult,
} from '@/api/agentTeam';
import { EmptyState, PageHeader, SheetDetail } from '@/components/skeleton';
import EvidenceRenderer from '@/pages/superai/components/EvidenceRenderer';
import './superai.css';

/**
 * SuperAI · Agent 产品层**工作台**（超级大脑 + 数字员工）。
 *
 * 一条主链：一句话 → 任务图 → 并行派给多个数字员工 → 真实执行 → 停在人工
 * 确认闸门 → 确认后汇总。这个页面把这整条链**摊开来看**：
 *
 *   ① 一句话入口
 *   ② 运行总览（终态 / 逾期 / 汇总）
 *   ③ 任务图（子任务、承接员工、依赖、各自终态）
 *   ④ 人工确认闸门
 *   ⑤ 每个员工的产出 / 证据 / 交付物
 *   ⑥ 本轮全部交付物（按 id 取回正文）
 *
 * 只做读：所有状态都来自后端 run 状态，前端不拼装、不伪造产出。证据直接用
 * SuperAI 那一个 `EvidenceRenderer`——agent-team 产出的是同一种形状的条目，
 * 所以同一平台里的"证据"在 UI 上也只有一种样子。
 */

const STATUS_TAG: Record<RunStatus, { color: 'grey' | 'blue' | 'amber' | 'green' | 'red'; label: string }> = {
  planning: { color: 'grey', label: '拆解中' },
  running: { color: 'blue', label: '执行中' },
  awaiting_approval: { color: 'amber', label: '等待人工确认' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
  cancelled: { color: 'grey', label: '已取消' },
  timeout: { color: 'red', label: '已超时' },
};

/** 子任务在任务图上的状态：还没回执 = 未派发。 */
function subtaskState(subtask: SubTask, results: Record<string, SubTaskResult>) {
  const result = results[subtask.task_id];
  if (!result) return { color: 'grey' as const, label: '未派发', done: false };
  if (result.status === 'ok') return { color: 'green' as const, label: '已完成', done: true };
  if (result.status === 'rejected') return { color: 'amber' as const, label: '转待授权', done: true };
  return { color: 'red' as const, label: '失败', done: true };
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

function formatDeadline(epochSeconds: number): string {
  if (!epochSeconds) return '不限时';
  return new Date(epochSeconds * 1000).toLocaleString('zh-CN');
}

/** 工具调用标签的文案：拒绝 / 出错 / 正常三种要分得开。 */
function toolCallLabel(call: Record<string, unknown>): { text: string; color: 'grey' | 'red' | 'amber' } {
  const name = String(call.name ?? '?');
  if (call.allowed === false) return { text: `${name}（拒绝：${String(call.rejected)}）`, color: 'red' };
  if (call.error) return { text: `${name}（出错）`, color: 'amber' };
  return { text: name, color: 'grey' };
}

export default function AgentTeamRunPage() {
  const [goal, setGoal] = useState('把本月的异常订单找出来，逐个分析原因，给我一份汇总');
  const [run, setRun] = useState<RunState | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactContent | null>(null);
  const [loadingArtifactId, setLoadingArtifactId] = useState('');
  const [busy, setBusy] = useState(false);

  const status = run ? STATUS_TAG[run.status] : null;

  const results = useMemo(() => Object.values(run?.results ?? {}), [run]);
  const evidenceCount = results.reduce((sum, r) => sum + (r.evidence?.length ?? 0), 0);
  const receiptArtifacts = results.flatMap((r) => r.artifacts ?? []);

  /** 拉一次 run 状态；顺带把交付物清单一起取回来。 */
  const refresh = useCallback(async (runId: string) => {
    const next = await getRun(runId);
    setRun(next);
    setArtifacts(await listRunArtifacts(runId).catch(() => []));
    return next;
  }, []);

  const call = useCallback(
    async (fn: () => Promise<RunState>, failMsg: string) => {
      setBusy(true);
      try {
        const next = await fn();
        await refresh(next.run_id);
      } catch (e) {
        Toast.error(`${failMsg}：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

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

  // 停在闸门之前时自动跟一下：执行中的 run 是异步推进的，不刷新就看不到新步骤。
  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'planning')) return;
    const timer = window.setTimeout(() => {
      void refresh(run.run_id).catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [run, refresh]);

  const subtaskColumns: ColumnProps<SubTask>[] = [
    { title: '子任务', dataIndex: 'task_id', width: 90 },
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

  const artifactColumns: ColumnProps<Artifact>[] = [
    {
      title: '交付物',
      dataIndex: 'artifact_id',
      render: (value: string) => (
        <Button
          theme="borderless"
          icon={<Download size={14} />}
          loading={loadingArtifactId === value}
          onClick={() => void openArtifact(value)}
          data-artifact-id={value}
        >
          {value}
        </Button>
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
      <PageHeader
        title="Agent 产品层 · 工作台"
        desc="超级大脑拆任务图 → 并行派给数字员工 → 真实执行 → 人工确认 → 汇总交付"
      />

      <Card title="① 一句话">
        <div className="mp-team-input">
          <Input value={goal} onChange={setGoal} placeholder="要做什么？" />
          <Button
            theme="solid"
            icon={<Play size={14} />}
            loading={busy}
            disabled={!goal.trim()}
            onClick={() => void call(() => startRun(goal.trim()), '提交失败')}
            data-testid="agent-team-start"
          >
            拆解并派活
          </Button>
          {run ? (
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => void refresh(run.run_id).catch(() => undefined)}
              data-testid="agent-team-refresh"
            >
              刷新
            </Button>
          ) : null}
        </div>
      </Card>

      {run?.error ? (
        <Banner type="danger" description={run.error} closeIcon={null} className="mp-team-gap" />
      ) : null}

      {run ? (
        <>
          <Card
            className="mp-team-gap"
            title="② 运行总览"
            headerExtraContent={status ? <Tag color={status.color} type="light">{status.label}</Tag> : null}
          >
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
                <span className="mp-exec-kpi-value">{results.length} / {run.subtasks.length}</span>
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
            </div>
            <span className="mp-team-meta">
              <Typography.Text type="tertiary">run_id：{run.run_id}</Typography.Text>
              <Typography.Text type="tertiary">租户：{run.tenant_id}</Typography.Text>
              <Typography.Text type="tertiary">
                运行级超时：{run.timeout_seconds > 0 ? `${run.timeout_seconds}s` : '不限'} · 截止：{formatDeadline(run.deadline_at)}
              </Typography.Text>
            </span>
            {run.hitl_reason ? (
              <Typography.Paragraph type="tertiary" className="mp-team-gap-sm">
                {run.hitl_reason}
              </Typography.Paragraph>
            ) : null}
          </Card>

          <Card className="mp-team-gap" title="③ 任务图">
            <div data-testid="agent-team-graph">
              <Table
                pagination={false}
                size="small"
                rowKey="task_id"
                dataSource={run.subtasks}
                columns={subtaskColumns}
              />
            </div>
          </Card>

          {run.status === 'awaiting_approval' ? (
            <Card className="mp-team-gap" title="④ 人工确认">
              <Banner
                type="warning"
                icon={<ShieldCheck size={16} />}
                description={run.hitl_reason || '员工已产出，等待人工确认后汇总'}
                closeIcon={null}
              />
              <div className="mp-team-actions">
                <Button
                  theme="solid"
                  icon={<CheckCircle2 size={14} />}
                  loading={busy}
                  onClick={() => void call(() => approveRun(run.run_id, true), '确认失败')}
                  data-testid="agent-team-approve"
                >
                  确认并继续
                </Button>
                <Button
                  type="danger"
                  loading={busy}
                  onClick={() => void call(() => approveRun(run.run_id, false), '驳回失败')}
                  data-testid="agent-team-reject"
                >
                  驳回
                </Button>
              </div>
            </Card>
          ) : null}

          {results.length > 0 ? (
            <Card className="mp-team-gap" title="⑤ 员工状态 · 产出 · 证据 · 交付物">
              {results.map((result) => (
                <Card
                  key={result.task_id}
                  className="mp-team-employee"
                  title={
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
                  }
                >
                  <div data-testid={`agent-team-result-${result.task_id}`}>
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
                          <Button
                            key={artifact.artifact_id}
                            size="small"
                            icon={<Download size={12} />}
                            loading={loadingArtifactId === artifact.artifact_id}
                            onClick={() => void openArtifact(artifact.artifact_id)}
                            data-artifact-id={artifact.artifact_id}
                          >
                            {artifact.title || artifact.artifact_id}
                          </Button>
                        ))}
                      </span>
                    ) : (
                      <Typography.Text type="tertiary">这名员工没有产出交付物。</Typography.Text>
                    )}
                  </div>
                  </div>
                </Card>
              ))}
            </Card>
          ) : null}

          {artifacts.length > 0 ? (
            <Card className="mp-team-gap" title="⑥ 本轮交付物">
              <div data-testid="agent-team-artifact-table">
                <Table
                  pagination={false}
                  size="small"
                  rowKey="artifact_id"
                  dataSource={artifacts}
                  columns={artifactColumns}
                />
              </div>
            </Card>
          ) : null}

          {run.summary ? (
            <Card className="mp-team-gap" title="⑦ 汇总">
              <Typography.Paragraph className="mp-team-output">{run.summary}</Typography.Paragraph>
            </Card>
          ) : null}
        </>
      ) : null}

      {!run ? (
        <EmptyState
          title="还没有运行"
          desc="在上面输入一句话，点「拆解并派活」即可看到任务图、各员工证据与交付物。"
        />
      ) : null}

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
