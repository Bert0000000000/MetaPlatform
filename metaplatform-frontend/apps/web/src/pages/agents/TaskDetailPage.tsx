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
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ExecutionProgress from './components/ExecutionProgress';
import ExecutionTimeline from './components/ExecutionTimeline';
import ReplayPanel from './components/ReplayPanel';
import TaskControls from './components/TaskControls';
import TraceLinkViewer from './components/TraceLinkViewer';
import type { EmployeeTask } from '@/api/dw/types';

const STATUS_MAP: Record<EmployeeTask['status'], { label: string; color: TagColor }> = {
  pending: { label: '待处理', color: 'grey' },
  running: { label: '运行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
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
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {task.title}
        </Typography.Title>
        <Tag color={STATUS_MAP[task.status].color}>{STATUS_MAP[task.status].label}</Tag>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item itemKey="任务 ID">{task.id}</Descriptions.Item>
          <Descriptions.Item itemKey="员工">{task.employeeId}</Descriptions.Item>
          <Descriptions.Item itemKey="描述" span={2}>{task.description}</Descriptions.Item>
          <Descriptions.Item itemKey="优先级">
            <Tag color={task.priority === 'high' ? 'red' : 'orange'}>{task.priority}</Tag>
          </Descriptions.Item>
          <Descriptions.Item itemKey="进度">{task.progress}%</Descriptions.Item>
          <Descriptions.Item itemKey="创建">{new Date(task.createdAt).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item itemKey="开始">{task.startedAt ? new Date(task.startedAt).toLocaleString() : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs>
        <Tabs.TabPane itemKey="progress" tab="实时进度">
          <ExecutionProgress task={task} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="timeline" tab="执行轨迹">
          <ExecutionTimeline task={task} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="replay" tab="执行回放">
          <ReplayPanel traceId={task.id} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="controls" tab="任务干预">
          <TaskControls task={task} onChange={setTask} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="trace" tab="Trace 链路">
          <TraceLinkViewer traceId={task.id} />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
