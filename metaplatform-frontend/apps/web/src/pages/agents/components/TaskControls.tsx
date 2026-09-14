import { Button, Card, Popconfirm, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { Pause, Play, RotateCw, Square } from 'lucide-react';
import type { EmployeeTask } from '@/api/dw/types';

interface TaskControlsProps {
  task: EmployeeTask;
  onChange: (t: EmployeeTask) => void;
}

/**
 * 任务干预（DESIGN-SPEC §6.3：需确认的动作走 Semi 的确认控件，不用裸 confirm）。
 * 行为与旧实现一致：状态迁移通过 onChange 回写父级任务对象，并逐条 Toast 反馈。
 */
export default function TaskControls({ task, onChange }: TaskControlsProps) {
  const handlePause = () => {
    if (task.status !== 'running') {
      Toast.warning('仅运行中任务可暂停');
      return;
    }
    onChange({ ...task, status: 'pending' });
    Toast.success('已暂停');
  };

  const handleResume = () => {
    if (task.status !== 'pending') {
      Toast.warning('仅待处理任务可恢复');
      return;
    }
    onChange({ ...task, status: 'running' });
    Toast.success('已恢复');
  };

  const handleCancel = () => {
    onChange({ ...task, status: 'cancelled' });
    Toast.success('已取消');
  };

  const handleRetry = () => {
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      Toast.warning('仅失败/取消任务可重试');
      return;
    }
    onChange({ ...task, status: 'pending', progress: 0 });
    Toast.success('已重新加入队列');
  };

  return (
    <Card title="任务干预">
      <Space spacing="medium" wrap>
        <Button
          icon={<Pause size={15} strokeWidth={1.5} />}
          onClick={handlePause}
          disabled={task.status !== 'running'}
        >
          暂停
        </Button>
        <Button
          theme="solid"
          type="primary"
          icon={<Play size={15} strokeWidth={1.5} />}
          onClick={handleResume}
          disabled={task.status !== 'pending'}
        >
          恢复
        </Button>
        <Popconfirm
          title="确认取消任务？"
          content="取消后任务不再继续执行，操作会写入审计日志。"
          onConfirm={handleCancel}
        >
          <Button
            type="danger"
            icon={<Square size={15} strokeWidth={1.5} />}
            disabled={task.status === 'completed' || task.status === 'cancelled'}
          >
            取消
          </Button>
        </Popconfirm>
        <Button
          icon={<RotateCw size={15} strokeWidth={1.5} />}
          onClick={handleRetry}
          disabled={task.status !== 'failed' && task.status !== 'cancelled'}
        >
          重试
        </Button>
      </Space>
      <div>
        <Typography.Text type="tertiary">
          任务干预会立即生效，所有动作都会写入审计日志（Trace ID:{' '}
          <Typography.Text code>{task.id}</Typography.Text>）
        </Typography.Text>
      </div>
    </Card>
  );
}
