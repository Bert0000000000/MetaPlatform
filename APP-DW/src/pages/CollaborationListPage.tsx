import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { listCollaborations } from '@/api/collaborations';
import type { CollaborationTask } from '@/api/collaborations';

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

export default function CollaborationListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CollaborationTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listCollaborations().then((t) => {
      setTasks(t);
      setLoading(false);
    });
  }, []);

  const columns: ColumnsType<CollaborationTask> = [
    {
      title: '协作任务',
      key: 'title',
      render: (_, t) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{t.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t.description}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '拆分策略',
      dataIndex: 'splitStrategy',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '子任务',
      dataIndex: 'subtasks',
      render: (v) => <Tag color="blue">{v.length} 个</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
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
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/dw/collaborations/${t.collaborationId}`)}>
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dw/collaborations/new')}>
          创建协作
        </Button>
      </div>

      <Card>
        {tasks.length === 0 && !loading ? (
          <Empty description="还没有协作任务" />
        ) : (
          <Table rowKey="collaborationId" dataSource={tasks} columns={columns} loading={loading} />
        )}
      </Card>
    </div>
  );
}
