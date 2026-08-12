import { Card, Empty, Progress, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import type { CollaborationTask } from '@/api/dw/collaborations';

interface ParallelProgressProps {
  task: CollaborationTask;
}

const STATUS_COLOR: Record<string, TagColor> = {
  pending: 'grey',
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
      <Space vertical style={{ width: '100%' }}>
        {task.subtasks.map((st) => (
          <Card key={st.id} title={st.title}>
            <Space vertical style={{ width: '100%' }}>
              <Space>
                <Tag color="blue">{st.employeeId}</Tag>
                <Tag color={STATUS_COLOR[st.status]}>{st.status}</Tag>
              </Space>
              <Progress percent={st.progress} size="small" />
              {st.result && (
                <Typography.Paragraph type="tertiary" style={{ fontSize: 12 }}>
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
