import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Descriptions,
  Divider,
  Progress,
  Spin,
  Steps,
  Tabs,
  Tag,
  Timeline,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { ArrowLeft, Play, RefreshCw } from 'lucide-react';
import { executeCollaboration, getCollaboration } from '@/api/dw/collaborations';
import type {
  CollaborationTask,
  CollabStatus,
  SplitStrategy,
  SubTask,
  SubTaskStatus,
} from '@/api/dw/collaborations';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import CollaborationReportView from './components/CollaborationReport';
import './agents.css';

type TagColorName = 'grey' | 'blue' | 'green' | 'red';

const STATUS_META: Record<CollabStatus, { label: string; color: TagColorName }> = {
  pending: { label: '待执行', color: 'grey' },
  running: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const SUB_STATUS_META: Record<SubTaskStatus, { label: string; color: TagColorName }> = {
  pending: { label: '待执行', color: 'grey' },
  running: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

/** Semi Timeline.Item 的 color 直接作为圆点背景色，这里取状态语义 token。 */
const TIMELINE_DOT_COLOR: Record<SubTaskStatus, string> = {
  pending: 'var(--semi-color-text-3)',
  running: 'var(--semi-color-primary)',
  completed: 'var(--semi-color-success)',
  failed: 'var(--semi-color-danger)',
};

const SPLIT_LABEL: Record<SplitStrategy, string> = {
  sequential: '顺序执行',
  parallel: '并行执行',
  hybrid: '混合',
};

function formatSeconds(s?: number | null): string {
  if (!s || s <= 0) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function formatTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

/** 子任务进度条语义色：完成绿 / 失败红，进行中走主题色。 */
function progressStroke(status: SubTaskStatus): string | undefined {
  if (status === 'failed') return 'var(--semi-color-danger)';
  if (status === 'completed') return 'var(--semi-color-success)';
  return undefined;
}

function stepStatus(status: SubTaskStatus): 'finish' | 'process' | 'error' | 'wait' {
  if (status === 'completed') return 'finish';
  if (status === 'running') return 'process';
  if (status === 'failed') return 'error';
  return 'wait';
}

/**
 * 协作监控（DESIGN-SPEC §5 版式 D：页头 + 状态条 + 步骤时间线 + 子任务进度 + 报告）。
 *
 * 数据面沿用 src/api/dw/collaborations（getCollaboration / executeCollaboration），
 * 进度/步骤/时间线一律用 Semi 官方组件，不自绘。
 */
export default function CollaborationMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<CollaborationTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setTask(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const t = await getCollaboration(id);
      setTask(t);
    } catch (e) {
      setTask(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExecute = useCallback(async () => {
    if (!id) return;
    setExecuting(true);
    try {
      const t = await executeCollaboration(id);
      setTask(t);
      Toast.success('协作执行完成');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  }, [id]);

  const subtasks = useMemo(() => task?.subtasks ?? [], [task]);

  const columns = useMemo(
    () => [
      {
        title: '#',
        dataIndex: '__index__',
        width: 56,
        render: (_: unknown, __: SubTask, index: number) => index + 1,
      },
      {
        title: '子任务',
        dataIndex: 'title',
        width: 280,
        ellipsis: true,
        render: (_: unknown, row: SubTask) => (
          <span>
            <span className="mp-agent-name">{row.title}</span>
            {row.description ? <span className="mp-agent-sub-role"> · {row.description}</span> : null}
          </span>
        ),
      },
      {
        title: '技能标签',
        dataIndex: 'skillTags',
        width: 200,
        render: (tags: string[]) => (
          <span className="mp-agent-chips">
            {(tags ?? []).length === 0 ? (
              <span className="mp-agent-line-label">—</span>
            ) : (
              (tags ?? []).map((tag) => (
                <Tag key={tag} size="small" type="light">
                  {tag}
                </Tag>
              ))
            )}
          </span>
        ),
      },
      {
        title: '负责员工',
        dataIndex: 'employeeId',
        width: 150,
        render: (v: string) => <Tag size="small" type="light">{v}</Tag>,
      },
      {
        title: '依赖',
        dataIndex: 'dependsOn',
        width: 200,
        render: (deps: string[], row: SubTask) =>
          deps && deps.length > 0 ? (
            <span className="mp-agent-chips">
              {deps.map((d) => (
                <Tag key={d} size="small" color="amber" type="light">
                  {subtasks.find((x) => x.id === d)?.title ?? d}
                </Tag>
              ))}
            </span>
          ) : (
            <span className="mp-agent-line-label">无</span>
          ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (v: SubTaskStatus) => (
          <Tag size="small" color={SUB_STATUS_META[v]?.color ?? 'grey'} type="light">
            {SUB_STATUS_META[v]?.label ?? v}
          </Tag>
        ),
      },
      {
        title: '进度',
        dataIndex: 'progress',
        width: 150,
        render: (v: number, row: SubTask) => (
          <Progress percent={Math.round(v || 0)} size="small" stroke={progressStroke(row.status)} />
        ),
      },
      {
        title: '预估',
        dataIndex: 'estimatedSeconds',
        width: 100,
        render: (v: number) => formatSeconds(v),
      },
      {
        title: '实际',
        dataIndex: 'actualSeconds',
        width: 100,
        render: (v: number) => formatSeconds(v),
      },
      {
        title: '结果',
        dataIndex: 'result',
        ellipsis: true,
        render: (v?: string | null) => <span className="mp-agent-line-label">{v || '—'}</span>,
      },
    ],
    [subtasks],
  );

  if (loading && !task) {
    return (
      <div className="mp-agent-loading">
        <Spin size="middle" />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="协作监控"
          actions={<Button onClick={() => navigate('/agents/collab')}>返回协作列表</Button>}
        />
        <EmptyState
          illustration="failure"
          title="协作任务加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      </>
    );
  }

  if (!task) {
    return (
      <>
        <PageHeader
          title="协作监控"
          actions={<Button onClick={() => navigate('/agents/collab')}>返回协作列表</Button>}
        />
        <EmptyState
          illustration="no-result"
          title="未找到该协作任务"
          desc={`协作任务 ${id ?? ''} 不在当前租户的记录里。`}
          actions={
            <Button theme="solid" type="primary" onClick={() => navigate('/agents/collab')}>
              返回协作列表
            </Button>
          }
        />
      </>
    );
  }

  const hasSubtasks = Array.isArray(task.subtasks);
  const totalProgress = hasSubtasks
    ? Math.round(subtasks.reduce((s, st) => s + (st.progress || 0), 0) / Math.max(1, subtasks.length))
    : 0;
  const completedSubs = subtasks.filter((s) => s.status === 'completed').length;
  const failedSubs = subtasks.filter((s) => s.status === 'failed').length;
  const meta = STATUS_META[task.status] ?? { label: task.status, color: 'grey' as const };

  const overallStroke =
    task.status === 'completed'
      ? 'var(--semi-color-success)'
      : task.status === 'failed'
        ? 'var(--semi-color-danger)'
        : undefined;

  const subtasksEmpty = (
    <EmptyState
      illustration="no-content"
      title="没有子任务"
      desc="系统按员工能力生成子任务后，会显示在这里。"
    />
  );

  return (
    <>
      <PageHeader
        title={task.title || task.collaborationId}
        desc={task.goal || '协作任务执行监控与报告'}
        actions={
          <>
            <Tag color={meta.color} type="light">
              {meta.label}
            </Tag>
            <Tag type="light">{SPLIT_LABEL[task.splitStrategy] ?? task.splitStrategy}</Tag>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            {task.status === 'pending' ? (
              <Button
                theme="solid"
                type="primary"
                icon={<Play size={15} strokeWidth={1.5} />}
                loading={executing}
                onClick={() => void handleExecute()}
              >
                执行协作
              </Button>
            ) : null}
            <Button icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={() => navigate('/agents/collab')}>
              返回
            </Button>
          </>
        }
      />

      <Card title="任务概览">
        <Descriptions
          row
          data={[
            { key: '协作 ID', value: task.collaborationId },
            { key: '状态', value: meta.label },
            { key: '拆分策略', value: SPLIT_LABEL[task.splitStrategy] ?? task.splitStrategy },
            { key: '子任务', value: hasSubtasks ? `${subtasks.length} 个` : '—' },
            { key: '已完成', value: hasSubtasks ? `${completedSubs} / ${subtasks.length}` : '—' },
            { key: '失败', value: hasSubtasks ? `${failedSubs} 个` : '—' },
            { key: '创建时间', value: formatTime(task.createdAt) },
            { key: '开始时间', value: formatTime(task.startedAt) },
            { key: '完成时间', value: formatTime(task.completedAt) },
          ]}
        />
        <div>
          <Typography.Text>整体进度：{totalProgress}%</Typography.Text>
        </div>
        <Progress percent={totalProgress} stroke={overallStroke} />
        {task.status === 'pending' ? (
          <Banner
            type="info"
            title="任务待执行"
            description="系统已根据员工能力自动分工并生成子任务依赖关系，点击右上角「执行协作」启动。"
          />
        ) : null}
      </Card>

      <Tabs>
          <Tabs.TabPane itemKey="subtasks" tab={`子任务 (${subtasks.length})`}>
            <Card>
              <DataTablePro<SubTask>
                columns={columns}
                dataSource={subtasks}
                rowKey="id"
                columnSettings={false}
                empty={subtasksEmpty}
              />
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane itemKey="timeline" tab="执行时间线">
            <Card title="依赖与执行轨迹">
              {subtasks.length === 0 ? (
                subtasksEmpty
              ) : (
                <>
                  <Typography.Title heading={6}>依赖关系（Steps）</Typography.Title>
                  <Steps size="small" direction="vertical" type="basic">
                    {subtasks.map((st, idx) => (
                      <Steps.Step
                        key={st.id}
                        title={`#${idx + 1} ${st.title}`}
                        status={stepStatus(st.status)}
                        description={
                          <div>
                            <div>
                              <Typography.Text type="tertiary">{st.employeeId}</Typography.Text>
                            </div>
                            {st.dependsOn && st.dependsOn.length > 0 ? (
                              <div>
                                <Typography.Text type="tertiary">
                                  依赖 #
                                  {st.dependsOn
                                    .map((d) => subtasks.findIndex((x) => x.id === d) + 1)
                                    .filter((n) => n > 0)
                                    .join(', ')}
                                </Typography.Text>
                              </div>
                            ) : null}
                          </div>
                        }
                      />
                    ))}
                  </Steps>

                  <Divider />

                  <Typography.Title heading={6}>执行时间线（Timeline）</Typography.Title>
                  <Timeline>
                    {subtasks.map((st, idx) => (
                      <Timeline.Item key={st.id} color={TIMELINE_DOT_COLOR[st.status]}>
                        <div className="mp-agent-line">
                          <span>
                            <span className="mp-agent-name">
                              #{idx + 1} {st.title}
                            </span>{' '}
                            <Tag color={SUB_STATUS_META[st.status]?.color ?? 'grey'} type="light">
                              {SUB_STATUS_META[st.status]?.label ?? st.status}
                            </Tag>{' '}
                            <Tag type="light">{st.employeeId}</Tag>
                          </span>
                          <span className="mp-agent-line-label">{formatSeconds(st.actualSeconds)}</span>
                        </div>
                        <Progress
                          percent={Math.round(st.progress || 0)}
                          size="small"
                          stroke={progressStroke(st.status)}
                        />
                        {st.result ? (
                          <div className="mp-agent-line">
                            <span className="mp-agent-line-label">结果</span>
                            <span>{st.result}</span>
                          </div>
                        ) : null}
                        {st.errorMessage ? (
                          <div className="mp-agent-line">
                            <span className="mp-agent-line-label">错误</span>
                            <span>{st.errorMessage}</span>
                          </div>
                        ) : null}
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </>
              )}
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane itemKey="report" tab="协作报告">
            <CollaborationReportView collaborationId={task.collaborationId} />
          </Tabs.TabPane>
        </Tabs>
    </>
  );
}
