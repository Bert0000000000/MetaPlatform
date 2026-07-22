import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ExecutionProgress from '@/components/ExecutionProgress';
import ExecutionTimeline from '@/components/ExecutionTimeline';
import ReplayPanel from '@/components/ReplayPanel';
import TaskControls from '@/components/TaskControls';
import TraceLinkViewer from '@/components/TraceLinkViewer';
import type { EmployeeTask } from '@/types';

const STATUS_MAP: Record<EmployeeTask['status'], { label: string; color: string }> = {
  pending: { label: '待处理', color: 'default' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
};

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<EmployeeTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setTask({
        id: taskId || '',
        employeeId: 'emp-1',
        title: '示例任务',
        description: '展示任务详情',
        status: 'running',
        priority: 'high',
        progress: 60,
        createdAt: new Date().toISOString(),
        startedAt: new Date(Date.now() - 60000).toISOString(),
      });
      setLoading(false);
    }, 500);
  }, [taskId]);

  if (loading || !task) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dw/tasks')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {task.title}
        </Typography.Title>
        <Tag color={STATUS_MAP[task.status].color}>{STATUS_MAP[task.status].label}</Tag>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="任务 ID">{task.id}</Descriptions.Item>
          <Descriptions.Item label="员工">{task.employeeId}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{task.description}</Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={task.priority === 'high' ? 'red' : 'orange'}>{task.priority}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="进度">{task.progress}%</Descriptions.Item>
          <Descriptions.Item label="创建">{new Date(task.createdAt).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="开始">{task.startedAt ? new Date(task.startedAt).toLocaleString() : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs
        items={[
          { key: 'progress', label: '实时进度', children: <ExecutionProgress task={task} /> },
          { key: 'timeline', label: '执行轨迹', children: <ExecutionTimeline task={task} /> },
          { key: 'replay', label: '执行回放', children: <ReplayPanel traceId={task.id} /> },
          { key: 'controls', label: '任务干预', children: <TaskControls task={task} onChange={setTask} /> },
          { key: 'trace', label: 'Trace 链路', children: <TraceLinkViewer traceId={task.id} /> },
        ]}
      />
    </div>
  );
}
