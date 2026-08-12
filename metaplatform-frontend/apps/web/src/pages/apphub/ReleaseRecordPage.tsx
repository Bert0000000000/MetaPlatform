import { useParams } from "react-router-dom";
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  SideSheet,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Space,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  PlusOutlined,
} from '@ant-design/icons';
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
} from '@/api/apphub/release';
import type { PageResponse } from '@/api/apphub/types';

interface ReleaseRecordPageProps {
  appId?: string;
}

const STRATEGY_LABELS: Record<string, string> = {
  FULL: '全量',
  GRAYSCALE: '灰度',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: '审批中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
};

const APPROVAL_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '审批中', color: 'blue' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
};

const STEP_TITLES = ['提交申请', '技术负责人审批', '运维审批', '发布完成'];

const GRAY_MARKS: Record<number, string> = {
  0: '0%',
  10: '10%',
  25: '25%',
  50: '50%',
  100: '100%',
};

export default function ReleaseRecordPage({ appId: appIdProp }: ReleaseRecordPageProps) {
  const { appId: routeAppId } = useParams<"appId">();
  const appId = appIdProp ?? routeAppId ?? "";
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
    form.reset();
    form.setValues({
      strategy: 'FULL',
      grayPercent: 0,
      techLeadId: 'tech-lead',
      opsOwnerId: 'ops-owner',
    });
    setStrategy('FULL');
    setModalOpen(true);
  };

  // Semi Radio.Group onChange 第一参数为 RadioChangeEvent（含 target.value），保持原逻辑
  const handleStrategyChange = (e: { target: { value: string | number | boolean } }) => {
    const value = e.target.value as 'FULL' | 'GRAYSCALE';
    setStrategy(value);
    form.setValues({ grayPercent: value === 'FULL' ? 0 : 10 });
  };

  const handleCreate = async (values: CreateReleaseRequest) => {
    setSubmitting(true);
    try {
      await createRelease(appId, values);
      Toast.success('发布申请已提交，等待审批');
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
      Toast.success(approved ? '审批已通过' : '已驳回');
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
        const item = STATUS_LABELS[value] ?? { label: value, color: 'grey' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      render: (value: string) => {
        const item = APPROVAL_LABELS[value] ?? { label: value, color: 'grey' };
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
          <Button theme="borderless" type="primary" icon={<HistoryOutlined />} onClick={() => openDrawer(record, 'logs')}>
            日志
          </Button>
          {record.status === 'PENDING_APPROVAL' && (
            <Button theme="borderless" type="primary" onClick={() => openDrawer(record, 'approval')}>
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
        >
          {STEP_TITLES.map((title) => (
            <Steps.Step key={title} title={title} />
          ))}
        </Steps>
        <Typography.Title heading={5} style={{ marginTop: 24 }}>
          待处理任务
        </Typography.Title>
        {tasksLoading ? (
          <div>加载中...</div>
        ) : activeTasks.length === 0 ? (
          <Empty description="暂无待处理审批任务" />
        ) : (
          <Space vertical style={{ width: '100%' }}>
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
    <Timeline
      mode="left"
      dataSource={logs.map((log) => ({
        time: formatTime(log.createdAt),
        content: (
          <div>
            <Typography.Text strong>{log.action}</Typography.Text>
            <div>
              <Typography.Text type="tertiary">
                {log.operator ? `操作人: ${log.operator}` : '系统'}
                {log.remark ? ` | 备注: ${log.remark}` : ''}
              </Typography.Text>
            </div>
          </div>
        ),
      }))}
    />
  );

  return (
    <div>
      <Card loading={loading}>
        <Space style={{ marginBottom: 16 }}>
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建发布
          </Button>
        </Space>
        <Table
          rowKey="releaseId"
          columns={columns}
          dataSource={releases?.items ?? []}
          pagination={false}
          empty={<Empty description="暂无发布记录" />}
        />
      </Card>

      <Modal
        title="创建发布"
        visible={modalOpen}
        onOk={() => form.submitForm()}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} onSubmit={handleCreate}>
          <Form.Input
            field="version"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
            placeholder="例如 v1.0.0"
          />
          <Form.TextArea field="releaseNotes" label="发布说明" rows={3} placeholder="描述本次发布内容" />
          <Form.RadioGroup
            field="strategy"
            label="发布策略"
            rules={[{ required: true, message: '请选择发布策略' }]}
            type="button"
            onChange={handleStrategyChange}
          >
            <Radio type="button" value="FULL">全量</Radio>
            <Radio type="button" value="GRAYSCALE">灰度</Radio>
          </Form.RadioGroup>
          {strategy === 'GRAYSCALE' && (
            <Form.Slider
              field="grayPercent"
              label="灰度比例"
              rules={[{ required: true, message: '请选择灰度比例' }]}
              marks={GRAY_MARKS}
              min={0}
              max={100}
            />
          )}
          {strategy === 'GRAYSCALE' && (
            <Form.TagInput
              field="grayUsers"
              label="灰度用户"
              placeholder="输入用户 ID 后回车"
              separator=","
              showClear
            />
          )}
          {strategy === 'GRAYSCALE' && (
            <Form.TagInput
              field="grayDepts"
              label="灰度部门"
              placeholder="输入部门 ID 后回车"
              separator=","
              showClear
            />
          )}
          <Form.Input
            field="techLeadId"
            label="技术负责人"
            rules={[{ required: true, message: '请输入技术负责人 ID' }]}
            placeholder="tech-lead"
          />
          <Form.Input
            field="opsOwnerId"
            label="运维审批人"
            rules={[{ required: true, message: '请输入运维审批人 ID' }]}
            placeholder="ops-owner"
          />
        </Form>
      </Modal>

      <SideSheet
        title={
          <Space>
            <span>发布详情</span>
            <Tag>{selectedRelease?.version}</Tag>
          </Space>
        }
        width={720}
        visible={drawerOpen}
        onCancel={() => setDrawerOpen(false)}
      >
        <Space style={{ marginBottom: 16 }}>
          <Button
            theme={drawerTab === 'approval' ? 'solid' : 'light'}
            type="primary"
            onClick={() => setDrawerTab('approval')}
          >
            审批进度
          </Button>
          <Button
            theme={drawerTab === 'logs' ? 'solid' : 'light'}
            type="primary"
            onClick={() => setDrawerTab('logs')}
          >
            发布日志
          </Button>
        </Space>
        {drawerTab === 'approval' ? renderApprovalContent() : renderLogsContent()}
      </SideSheet>
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
    <Card title={task.name} headerExtraContent={<Tag color="blue">待审批</Tag>}>
      <Typography.Text type="tertiary">处理人: {task.assignee ?? '-'}</Typography.Text>
      <Input.TextArea
        rows={2}
        placeholder="审批意见（可选）"
        value={comment}
        onChange={(v) => setComment(v)}
        style={{ marginTop: 12, marginBottom: 12 }}
      />
      <Space>
        <Button
          theme="solid"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => onComplete(task, true, comment)}
        >
          通过
        </Button>
        <Button
          type="danger"
          icon={<CloseCircleOutlined />}
          onClick={() => onComplete(task, false, comment)}
        >
          驳回
        </Button>
      </Space>
    </Card>
  );
}
