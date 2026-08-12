import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Empty,
  Progress,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Tabs,
  Timeline,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { executeCollaboration, getCollaboration } from '@/api/dw/collaborations';
import type {
  CollaborationTask,
  CollabStatus,
  SplitStrategy,
  SubTask,
  SubTaskStatus,
} from '@/api/dw/collaborations';
import CollaborationReportView from './components/CollaborationReport';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

const STATUS_COLOR: Record<CollabStatus, TagColor> = {
  pending: 'grey',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

const STATUS_LABEL: Record<CollabStatus, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const SUB_STATUS_COLOR: Record<SubTaskStatus, TagColor> = {
  pending: 'grey',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

const SUB_STATUS_LABEL: Record<SubTaskStatus, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const TIMELINE_DOT_COLOR: Record<SubTaskStatus, string> = {
  pending: 'var(--semi-color-tertiary)',
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
  if (!s || s <= 0) return '-';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function Stat({
  title,
  value,
  suffix,
  valueStyle,
}: {
  title: string;
  value: ReactNode;
  suffix?: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1, ...valueStyle }}>
        {value}
        {suffix && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--muted-foreground)',
              marginLeft: 4,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function progressStroke(status: SubTaskStatus): string | undefined {
  if (status === 'failed') return 'var(--destructive)';
  if (status === 'completed') return 'var(--success)';
  return undefined;
}

export default function CollaborationMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<CollaborationTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const t = await getCollaboration(id);
      setTask(t);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExecute = async () => {
    if (!id) return;
    setExecuting(true);
    try {
      const t = await executeCollaboration(id);
      setTask(t);
      Toast.success('协作执行完成');
    } finally {
      setExecuting(false);
    }
  };

  if (loading || !task) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const totalProgress = Math.round(
    task.subtasks.reduce((s, st) => s + (st.progress || 0), 0) /
      Math.max(1, task.subtasks.length),
  );

  const completedSubs = task.subtasks.filter((s) => s.status === 'completed').length;
  const failedSubs = task.subtasks.filter((s) => s.status === 'failed').length;

  const columns: SemiColumns<SubTask> = [
    {
      title: '#',
      key: 'idx',
      width: 48,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '子任务',
      key: 'title',
      render: (_, st) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>{st.title}</Typography.Text>
          {st.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {st.description}
            </Typography.Text>
          )}
          {st.skillTags && st.skillTags.length > 0 && (
            <Space spacing={4} wrap>
              {st.skillTags.map((tag) => (
                <Tag key={tag} style={{ fontSize: 11 }}>
                  {tag}
                </Tag>
              ))}
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: '负责员工',
      dataIndex: 'employeeId',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '依赖',
      key: 'dependsOn',
      render: (_, st) =>
        st.dependsOn && st.dependsOn.length > 0 ? (
          <Space spacing={4} wrap>
            {st.dependsOn.map((d) => (
              <Tag key={d} color="orange">
                {task.subtasks.find((x) => x.id === d)?.title ?? d}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">无</Typography.Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: SubTaskStatus) => (
        <Tag color={SUB_STATUS_COLOR[v]}>{SUB_STATUS_LABEL[v]}</Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 160,
      render: (v: number, st) => (
        <Progress percent={v || 0} size="small" stroke={progressStroke(st.status)} />
      ),
    },
    {
      title: '预估',
      dataIndex: 'estimatedSeconds',
      render: (v: number) => formatSeconds(v),
    },
    {
      title: '实际',
      dataIndex: 'actualSeconds',
      render: (v: number) => formatSeconds(v),
    },
    {
      title: '结果',
      dataIndex: 'result',
      ellipsis: true,
      render: (v?: string | null) =>
        v ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {v}
          </Typography.Text>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw/collaborations')}>
          返回
        </Button>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {task.title}
        </Typography.Title>
        <Tag color={STATUS_COLOR[task.status]}>{STATUS_LABEL[task.status]}</Tag>
        <Tag>{SPLIT_LABEL[task.splitStrategy] ?? task.splitStrategy}</Tag>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
        {task.status === 'pending' && (
          <Button
            theme="solid"
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={executing}
            onClick={handleExecute}
          >
            执行协作
          </Button>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Typography.Paragraph>
          <Typography.Text strong>目标：</Typography.Text>
          {task.goal}
        </Typography.Paragraph>
        {task.description && (
          <Typography.Paragraph type="secondary">{task.description}</Typography.Paragraph>
        )}
        <Space spacing="loose" wrap>
          <Stat title="子任务" value={task.subtasks.length} suffix="个" />
          <Stat title="已完成" value={completedSubs} suffix={`/ ${task.subtasks.length}`} />
          {failedSubs > 0 && (
            <Stat title="失败" value={failedSubs} valueStyle={{ color: 'var(--semi-color-danger)' }} />
          )}
          {task.completedAt && task.startedAt && (
            <Stat
              title="总耗时"
              value={formatSeconds(
                Math.round(
                  (new Date(task.completedAt).getTime() -
                    new Date(task.startedAt).getTime()) /
                    1000,
                ),
              )}
            />
          )}
        </Space>
        <div style={{ marginTop: 12 }}>
          <Typography.Text>整体进度：{totalProgress}%</Typography.Text>
          <Progress
            percent={totalProgress}
            stroke={
              task.status === 'completed'
                ? 'var(--success)'
                : task.status === 'failed'
                  ? 'var(--destructive)'
                  : undefined
            }
          />
        </div>
      </Card>

      {task.status === 'pending' && (
        <Banner
          style={{ marginBottom: 16 }}
          type="info"
          title="任务待执行"
          description="系统已根据员工能力自动分工并生成子任务依赖关系，点击「执行协作」按钮启动协作执行。"
        />
      )}

      <Tabs>
        <Tabs.TabPane itemKey="subtasks" tab={`子任务 (${task.subtasks.length})`}>
          <Card>
            {task.subtasks.length === 0 ? (
              <Empty description="没有子任务" />
            ) : (
              <Table
                rowKey="id"
                dataSource={task.subtasks}
                columns={columns}
                pagination={false}
                size="middle" scroll={{ x: 'max-content' }} />
            )}
          </Card>
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="timeline" tab="执行时间线">
          <Card>
            {task.subtasks.length === 0 ? (
              <Empty description="没有子任务" />
            ) : (
              <>
                <Typography.Title heading={5}>依赖关系（Steps 视图）</Typography.Title>
                <Steps size="small" direction="vertical" style={{ marginBottom: 24 }}>
                  {task.subtasks.map((st, idx) => (
                    <Steps.Step
                      key={st.id}
                      title={`#${idx + 1} ${st.title}`}
                      description={
                        <Space vertical spacing={0}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {st.employeeId}
                          </Typography.Text>
                          {st.dependsOn && st.dependsOn.length > 0 && (
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                              依赖 #{st.dependsOn
                                .map((d) => task.subtasks.findIndex((x) => x.id === d) + 1)
                                .filter((n) => n > 0)
                                .join(', ')}
                            </Typography.Text>
                          )}
                        </Space>
                      }
                      status={
                        st.status === 'completed'
                          ? 'finish'
                          : st.status === 'running'
                            ? 'process'
                            : st.status === 'failed'
                              ? 'error'
                              : 'wait'
                      }
                    />
                  ))}
                </Steps>
                <Typography.Title heading={5}>执行时间线（Timeline 视图）</Typography.Title>
                <Timeline>
                  {task.subtasks.map((st, idx) => (
                    <Timeline.Item key={st.id} color={TIMELINE_DOT_COLOR[st.status]}>
                      <Space vertical spacing={2} style={{ width: '100%' }}>
                        <Space>
                          <Typography.Text strong>
                            #{idx + 1} {st.title}
                          </Typography.Text>
                          <Tag color={SUB_STATUS_COLOR[st.status]}>{SUB_STATUS_LABEL[st.status]}</Tag>
                          <Tag color="blue">{st.employeeId}</Tag>
                        </Space>
                        {st.dependsOn && st.dependsOn.length > 0 && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            依赖：{st.dependsOn
                              .map((d) => task.subtasks.find((x) => x.id === d)?.title ?? d)
                              .join('、')}
                          </Typography.Text>
                        )}
                        <Progress
                          percent={st.progress || 0}
                          size="small"
                          stroke={progressStroke(st.status)}
                        />
                        {st.result && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            结果：{st.result}
                          </Typography.Text>
                        )}
                        {st.errorMessage && (
                          <Typography.Text type="danger" style={{ fontSize: 12 }}>
                            错误：{st.errorMessage}
                          </Typography.Text>
                        )}
                      </Space>
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
    </div>
  );
}
