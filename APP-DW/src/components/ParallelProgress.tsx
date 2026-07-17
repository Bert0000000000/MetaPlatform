import { Card, Empty, Progress, Space, Tag, Typography } from 'antd';
import type { CollaborationTask } from '@/api/collaborations';

interface ParallelProgressProps {
  task: CollaborationTask;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

export default function ParallelProgress({ task }: ParallelProgressProps) {
  if (task.subtasks.length === 0) {
    return <Empty description="没有子任务" />;
  }

  return (
    <Card title="并行子任务进度">
      <Space direction="vertical" style={{ width: '100%' }}>
        {task.subtasks.map((st) => (
          <Card key={st.id} type="inner" size="small" title={st.title}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Tag color="blue">{st.employeeId}</Tag>
                <Tag color={STATUS_COLOR[st.status]}>{st.status}</Tag>
              </Space>
              <Progress percent={st.progress} size="small" />
              {st.result && (
                <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                  结果：{st.result}
                </Typography.Paragraph>
              )}
            </Space>
          </Card>
        ))}
      </Space>
    </Card>
  );
}
