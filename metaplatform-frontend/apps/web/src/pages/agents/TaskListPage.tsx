import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EyeOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { listTasks, getTaskStats } from '@/api/dw/tasks';
import { listEmployees } from '@/api/dw/employees';
import { recordFeedback } from '@/api/dw/learning';
import TaskAssignment from './components/TaskAssignment';
import TaskFeedbackModal from './components/TaskFeedbackModal';
import type { Employee, EmployeeTask, ExecutionResult, FeedbackType } from '@/api/dw/types';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

const STATUS_MAP: Record<string, { label: string; color: TagColor }> = {
  pending: { label: '待处理', color: 'grey' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
  in_progress: { label: '运行中', color: 'blue' },
  done: { label: '已完成', color: 'green' },
  error: { label: '失败', color: 'red' },
};

export default function TaskListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [status, setStatus] = useState<string>();
  const [employeeId, setEmployeeId] = useState<string>();
  const [feedbackTask, setFeedbackTask] = useState<EmployeeTask | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listEmployees({});
      setEmployees(list.items);
      if (list.items.length > 0) {
        const id = employeeId || list.items[0]!.employeeId;
        const t = await listTasks(id);
        setTasks(t);
        const stats = await getTaskStats(id);
        console.info('stats', stats);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [employeeId]);

  const columns: SemiColumns<EmployeeTask> = [
    {
      title: '任务',
      key: 'title',
      render: (_, t) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>{t.title}</Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
            {t.description}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => {
        const s = STATUS_MAP[v as string] ?? { label: v, color: 'grey' as TagColor };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      render: (v) => (
        <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'grey'}>{v}</Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      render: (v?: number) => (v !== undefined ? `${v}%` : '-'),
    },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, t) => (
        <Space>
          <Button theme="borderless" icon={<EyeOutlined />} onClick={() => navigate(`/agents/tasks/${t.id}`)}>
            详情
          </Button>
          <Button
            theme="borderless"
            icon={<MessageOutlined />}
            onClick={() => setFeedbackTask(t)}
          >
            反馈
          </Button>
        </Space>
      ),
    },
  ];

  const filtered = tasks.filter((t) => {
    const matchK = !keyword || t.title.toLowerCase().includes(keyword.toLowerCase());
    const matchS = !status || t.status === status;
    return matchK && matchS;
  });

  const handleFeedbackSubmit = async (values: {
    executionResult: ExecutionResult;
    feedbackType: FeedbackType;
    suggestion: string;
    tags: string[];
  }) => {
    if (!feedbackTask) return;
    setFeedbackLoading(true);
    try {
      await recordFeedback({
        employeeId: feedbackTask.employeeId,
        taskId: feedbackTask.id,
        taskTitle: feedbackTask.title,
        executionResult: values.executionResult,
        feedbackType: values.feedbackType,
        suggestion: values.suggestion,
        tags: values.tags,
      });
      setFeedbackTask(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          任务列表
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/tasks/create')}>
          创建任务
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择数字员工"
          style={{ width: 200 }}
          value={employeeId}
          onChange={(v) => setEmployeeId(v as string | undefined)}
          optionList={employees.map((e) => ({ label: e.name, value: e.employeeId }))}
        />
        <Input
          showClear
          placeholder="搜索任务"
          value={keywordInput}
          onChange={(v: string) => setKeywordInput(v)}
          onEnterPress={() => setKeyword(keywordInput)}
          suffix={
            <Button
              theme="borderless"
              size="small"
              icon={<SearchOutlined />}
              onClick={() => setKeyword(keywordInput)}
            />
          }
          style={{ width: 240 }}
        />
        <Select
          placeholder="状态"
          showClear
          style={{ width: 140 }}
          value={status}
          onChange={(v) => setStatus(v as string | undefined)}
          optionList={[
            { label: '待处理', value: 'pending' },
            { label: '运行中', value: 'running' },
            { label: '已完成', value: 'completed' },
            { label: '失败', value: 'failed' },
          ]}
        />
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <Card>
          {filtered.length === 0 && !loading ? (
            <Empty description="还没有任务" />
          ) : (
            <Table rowKey="id" dataSource={filtered} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
          )}
        </Card>

        <Card title="分配任务">
          <TaskAssignment employees={employees} onAssigned={load} />
        </Card>
      </div>

      <TaskFeedbackModal
        open={!!feedbackTask}
        task={feedbackTask}
        onCancel={() => setFeedbackTask(null)}
        onSubmit={handleFeedbackSubmit}
        loading={feedbackLoading}
      />
    </div>
  );
}
