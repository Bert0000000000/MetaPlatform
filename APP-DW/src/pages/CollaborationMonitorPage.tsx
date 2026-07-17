import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Progress,
  Space,
  Spin,
  Tag,
  Tabs,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getCollaboration } from '@/api/collaborations';
import ParallelProgress from '@/components/ParallelProgress';
import ResultAggregator from '@/components/ResultAggregator';
import CollaborationReport from '@/components/CollaborationReport';
import type { CollaborationTask } from '@/api/collaborations';

export default function CollaborationMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<CollaborationTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getCollaboration(id).then((t) => {
      setTask(t);
      setLoading(false);
    });
  }, [id]);

  if (loading || !task) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const totalProgress = Math.round(
    task.subtasks.reduce((s, st) => s + st.progress, 0) / Math.max(1, task.subtasks.length),
  );

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw/collaborations')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {task.title}
        </Typography.Title>
        <Tag color="blue">{task.splitStrategy}</Tag>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>整体进度：{totalProgress}%</Typography.Text>
          <Progress percent={totalProgress} status={task.status === 'completed' ? 'success' : 'active'} />
        </Space>
      </Card>

      <Tabs
        items={[
          { key: 'progress', label: '并行进度', children: <ParallelProgress task={task} /> },
          { key: 'aggregate', label: '结果汇聚', children: <ResultAggregator task={task} /> },
          { key: 'report', label: '协作报告', children: <CollaborationReport task={task} /> },
        ]}
      />
    </div>
  );
}
