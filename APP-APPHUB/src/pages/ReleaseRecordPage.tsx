import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Select,
  Slider,
  Space,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { RadioChangeEvent } from 'antd';
import {
  type ReleaseRecord,
  type ReleaseLog,
  type ReleaseTask,
  type CreateReleaseRequest,
  listReleases,
  createRelease,
  getReleaseLogs,
  getReleaseTasks,
  completeReleaseTask,
} from '@/api/release';
import type { PageResponse } from '@/types';

interface ReleaseRecordPageProps {
  appId: string;
}

const STRATEGY_LABELS: Record<string, string> = {
  FULL: '全量',
  GRAYSCALE: '灰度',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: '审批中', color: 'processing' },
  PUBLISHED: { label: '已发布', color: 'success' },
  REJECTED: { label: '已驳回', color: 'error' },
};

const APPROVAL_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '审批中', color: 'processing' },
  APPROVED: { label: '已通过', color: 'success' },
  REJECTED: { label: '已驳回', color: 'error' },
};

const STEP_TITLES = ['提交申请', '技术负责人审批', '运维审批', '发布完成'];

const GRAY_MARKS: Record<number, string> = {
  0: '0%',
  10: '10%',
  25: '25%',
  50: '50%',
  100: '100%',
};

export default function ReleaseRecordPage({ appId }: ReleaseRecordPageProps) {
  const [releases, setReleases] = useState<PageResponse<ReleaseRecord> | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'approval' | 'logs'>('approval');
  const [logs, setLogs] = useState<ReleaseLog[]>([]);
  const [tasks, setTasks] = useState<ReleaseTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [form] = Form.useForm<CreateReleaseRequest>();
  const [strategy, setStrategy] = useState<'FULL' | 'GRAYSCALE'>('FULL');

  const loadReleases = async () => {
    setLoading(true);
    try {
      const data = await listReleases(appId);
      setReleases(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReleases();
  }, [appId]);

  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      strategy: 'FULL',
      grayPercent: 0,
      techLeadId: 'tech-lead',
      opsOwnerId: 'ops-owner',
    });
    setStrategy('FULL');
    setModalOpen(true);
  };

  const handleStrategyChange = (e: RadioChangeEvent) => {
    const value = e.target.value as 'FULL' | 'GRAYSCALE';
    setStrategy(value);
    form.setFieldsValue({ grayPercent: value === 'FULL' ? 0 : 10 });
  };

  const handleCreate = async (values: CreateReleaseRequest) => {
    setSubmitting(true);
    try {
      await createRelease(appId, values);
      message.success('发布申请已提交，等待审批');
      setModalOpen(false);
      loadReleases();
    } finally {
      setSubmitting(false);
    }
  };

  const openDrawer = async (release: ReleaseRecord, tab: 'approval' | 'logs') => {
    setSelectedRelease(release);
    setDrawerTab(tab);
    setDrawerOpen(true);
    setTasksLoading(true);
    try {
      const [logData, taskData] = await Promise.all([
        getReleaseLogs(release.releaseId),
        release.processInstanceId ? getReleaseTasks(release.processInstanceId) : Promise.resolve([]),
      ]);
      setLogs(logData);
      setTasks(taskData);
    } finally {
      setTasksLoading(false);
    }
  };

  const refreshDrawer = async () => {
    if (!selectedRelease) return;
    openDrawer(selectedRelease, drawerTab);
    const data = await listReleases(appId);
    setReleases(data);
  };

  const handleCompleteTask = async (task: ReleaseTask, approved: boolean, comment: string) => {
    if (!selectedRelease?.processInstanceId) return;
    try {
      await completeReleaseTask(selectedRelease.processInstanceId, task.id, { approved, comment });
      message.success(approved ? '审批已通过' : '已驳回');
      refreshDrawer();
    } catch {
      // message already shown by api client
    }
  };

  const formatTime = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const computeCurrentStep = (release: ReleaseRecord, taskList: ReleaseTask[]) => {
    if (release.status === 'PUBLISHED') return 3;
    if (release.status === 'REJECTED') return 3;
    const completedCount = taskList.filter((t) => t.status === 'COMPLETED').length;
    return Math.min(completedCount + 1, 3);
  };

  const columns = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
    },
    {
      title: '发布策略',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (value: string) => <Tag>{STRATEGY_LABELS[value] ?? value}</Tag>,
    },
    {
      title: '灰度比例',
      dataIndex: 'grayPercent',
      key: 'grayPercent',
      render: (value: number, record: ReleaseRecord) =>
        record.strategy === 'GRAYSCALE' ? (
          <Progress percent={value} size="small" style={{ width: 120 }} />
        ) : (
          '-'
        ),
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => {
        const item = STATUS_LABELS[value] ?? { label: value, color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      render: (value: string) => {
        const item = APPROVAL_LABELS[value] ?? { label: value, color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatTime(value),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ReleaseRecord) => (
        <Space>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => openDrawer(record, 'logs')}>
            日志
          </Button>
          {record.status === 'PENDING_APPROVAL' && (
            <Button type="link" onClick={() => openDrawer(record, 'approval')}>
              审批
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const renderApprovalContent = () => {
    if (!selectedRelease) return null;
    const currentStep = computeCurrentStep(selectedRelease, tasks);
    const activeTasks = tasks.filter((t) => t.status === 'ACTIVE');
    return (
      <div>
        <Steps
          current={currentStep}
          status={selectedRelease.status === 'REJECTED' ? 'error' : 'process'}
          items={STEP_TITLES.map((title) => ({ key: title, title }))}
        />
        <Typography.Title level={5} style={{ marginTop: 24 }}>
          待处理任务
        </Typography.Title>
        {tasksLoading ? (
          <div>加载中...</div>
        ) : activeTasks.length === 0 ? (
          <Empty description="暂无待处理审批任务" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {activeTasks.map((task) => (
              <TaskApprovalCard
                key={task.id}
                task={task}
                onComplete={handleCompleteTask}
              />
            ))}
          </Space>
        )}
      </div>
    );
  };

  const renderLogsContent = () => (
    <Timeline mode="left">
      {logs.map((log) => (
        <Timeline.Item key={log.logId} label={formatTime(log.createdAt)}>
          <Typography.Text strong>{log.action}</Typography.Text>
          <div>
            <Typography.Text type="secondary">
              {log.operator ? `操作人: ${log.operator}` : '系统'}
              {log.remark ? ` | 备注: ${log.remark}` : ''}
            </Typography.Text>
          </div>
        </Timeline.Item>
      ))}
    </Timeline>
  );

  return (
    <div>
      <Card loading={loading}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建发布
          </Button>
        </Space>
        <Table
          rowKey="releaseId"
          columns={columns}
          dataSource={releases?.items ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无发布记录" /> }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="创建发布"
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="例如 v1.0.0" />
          </Form.Item>
          <Form.Item name="releaseNotes" label="发布说明">
            <Input.TextArea rows={3} placeholder="描述本次发布内容" />
          </Form.Item>
          <Form.Item
            name="strategy"
            label="发布策略"
            rules={[{ required: true, message: '请选择发布策略' }]}
          >
            <Radio.Group onChange={handleStrategyChange}>
              <Radio.Button value="FULL">全量</Radio.Button>
              <Radio.Button value="GRAYSCALE">灰度</Radio.Button>
            </Radio.Group>
          </Form.Item>
          {strategy === 'GRAYSCALE' && (
            <Form.Item
              name="grayPercent"
              label="灰度比例"
              rules={[{ required: true, message: '请选择灰度比例' }]}
            >
              <Slider marks={GRAY_MARKS} step={null} min={0} max={100} />
            </Form.Item>
          )}
          {strategy === 'GRAYSCALE' && (
            <Form.Item name="grayUsers" label="灰度用户">
              <Select
                mode="tags"
                placeholder="输入用户 ID 后回车"
                tokenSeparators={[',']}
                allowClear
              />
            </Form.Item>
          )}
          {strategy === 'GRAYSCALE' && (
            <Form.Item name="grayDepts" label="灰度部门">
              <Select
                mode="tags"
                placeholder="输入部门 ID 后回车"
                tokenSeparators={[',']}
                allowClear
              />
            </Form.Item>
          )}
          <Form.Item
            name="techLeadId"
            label="技术负责人"
            rules={[{ required: true, message: '请输入技术负责人 ID' }]}
          >
            <Input placeholder="tech-lead" />
          </Form.Item>
          <Form.Item
            name="opsOwnerId"
            label="运维审批人"
            rules={[{ required: true, message: '请输入运维审批人 ID' }]}
          >
            <Input placeholder="ops-owner" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={
          <Space>
            <span>发布详情</span>
            <Tag>{selectedRelease?.version}</Tag>
          </Space>
        }
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button type={drawerTab === 'approval' ? 'primary' : 'default'} onClick={() => setDrawerTab('approval')}>
            审批进度
          </Button>
          <Button type={drawerTab === 'logs' ? 'primary' : 'default'} onClick={() => setDrawerTab('logs')}>
            发布日志
          </Button>
        </Space>
        {drawerTab === 'approval' ? renderApprovalContent() : renderLogsContent()}
      </Drawer>
    </div>
  );
}

interface TaskApprovalCardProps {
  task: ReleaseTask;
  onComplete: (task: ReleaseTask, approved: boolean, comment: string) => void;
}

function TaskApprovalCard({ task, onComplete }: TaskApprovalCardProps) {
  const [comment, setComment] = useState('');
  return (
    <Card size="small" title={task.name} extra={<Tag color="processing">待审批</Tag>}>
      <Typography.Text type="secondary">处理人: {task.assignee ?? '-'}</Typography.Text>
      <Input.TextArea
        rows={2}
        placeholder="审批意见（可选）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginTop: 12, marginBottom: 12 }}
      />
      <Space>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => onComplete(task, true, comment)}
        >
          通过
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          onClick={() => onComplete(task, false, comment)}
        >
          驳回
        </Button>
      </Space>
    </Card>
  );
}
