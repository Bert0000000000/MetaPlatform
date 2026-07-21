import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { listCollaborations } from '@/api/collaborations';
import type { CollaborationTask, CollabStatus, SplitStrategy } from '@/api/collaborations';

const STATUS_COLOR: Record<CollabStatus, string> = {
  pending: 'default',
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

const SPLIT_LABEL: Record<SplitStrategy, string> = {
  sequential: '顺序执行',
  parallel: '并行执行',
  hybrid: '混合',
};

export default function CollaborationListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CollaborationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CollabStatus | undefined>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listCollaborations({ status });
      setTasks(res.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const columns: ColumnsType<CollaborationTask> = [
    {
      title: '协作任务',
      key: 'title',
      render: (_, t) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{t.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t.goal}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '拆分策略',
      dataIndex: 'splitStrategy',
      render: (v: SplitStrategy) => <Tag>{SPLIT_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '子任务',
      key: 'subtasks',
      render: (_, t) => <Tag color="blue">{t.subtasks?.length ?? 0} 个</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: CollabStatus) => (
        <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, t) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/dw/collaborations/${t.collaborationId}`)}
        >
          监控
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          多员工协作
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dw/collaborations/new')}
        >
          创建协作
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 160 }}
          value={status}
          onChange={(v) => setStatus(v)}
          options={[
            { label: '待执行', value: 'pending' },
            { label: '执行中', value: 'running' },
            { label: '已完成', value: 'completed' },
            { label: '失败', value: 'failed' },
          ]}
        />
      </Space>

      <Card>
        {tasks.length === 0 && !loading ? (
          <Empty description="还没有协作任务" />
        ) : (
          <Table
            rowKey="collaborationId"
            dataSource={tasks}
            columns={columns}
            loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>
    </div>
  );
}
