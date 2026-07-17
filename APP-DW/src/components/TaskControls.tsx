import { Button, Card, Modal, Space, Typography, message } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import type { EmployeeTask } from '@/types';

interface TaskControlsProps {
  task: EmployeeTask;
  onChange: (t: EmployeeTask) => void;
}

export default function TaskControls({ task, onChange }: TaskControlsProps) {
  const handlePause = () => {
    if (task.status !== 'running') {
      message.warning('仅运行中任务可暂停');
      return;
    }
    onChange({ ...task, status: 'pending' });
    message.success('已暂停');
  };

  const handleResume = () => {
    if (task.status !== 'pending') {
      message.warning('仅待处理任务可恢复');
      return;
    }
    onChange({ ...task, status: 'running' });
    message.success('已恢复');
  };

  const handleCancel = () => {
    Modal.confirm({
      title: '确认取消任务？',
      onOk: () => {
        onChange({ ...task, status: 'cancelled' });
        message.success('已取消');
      },
    });
  };

  const handleRetry = () => {
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      message.warning('仅失败/取消任务可重试');
      return;
    }
    onChange({ ...task, status: 'pending', progress: 0 });
    message.success('已重新加入队列');
  };

  return (
    <Card title="任务干预">
      <Space size="middle" wrap>
        <Button icon={<PauseCircleOutlined />} onClick={handlePause} disabled={task.status !== 'running'}>
          暂停
        </Button>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleResume} disabled={task.status !== 'pending'}>
          恢复
        </Button>
        <Button danger icon={<StopOutlined />} onClick={handleCancel} disabled={task.status === 'completed' || task.status === 'cancelled'}>
          取消
        </Button>
        <Button icon={<RedoOutlined />} onClick={handleRetry} disabled={task.status !== 'failed' && task.status !== 'cancelled'}>
          重试
        </Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        任务干预会立即生效，所有动作都会写入审计日志（Trace ID: <code>{task.id}</code>）
      </Typography.Paragraph>
    </Card>
  );
}
