import { useEffect, useState } from 'react';
import { Card, Tag, Typography, Space, Empty, Button, Badge } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { CheckOutlined, CloseOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { getPendingTasks, completeTask } from '@/api/dashboard/approvals';
import type { ApprovalTask } from '@/api/dashboard/types';

const { Text } = Typography;

const PRIORITY_COLOR: Record<string, TagColor> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export default function ApprovalCard() {
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPendingTasks();
      setTasks(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async (task: ApprovalTask, action: 'approve' | 'reject') => {
    await completeTask(task.taskId, action, action === 'approve' ? '同意' : '驳回');
    load();
  };

  const handleJumpToAppHub = () => {
    window.open('http://localhost:9201/apps', '_blank');
  };

  return (
    <Card
      title="待办审批"
      headerExtraContent={
        <Badge count={tasks.length}>
          <Button theme="borderless" icon={<ArrowRightOutlined />} onClick={handleJumpToAppHub} />
        </Badge>
      }
      loading={loading}
    >
      {tasks.length === 0 ? (
        <Empty description="暂无待办审批" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.slice(0, 5).map((task) => (
            <div
              key={task.taskId}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  <Space spacing={8}>
                    <Text strong>{task.title}</Text>
                    <Tag color={PRIORITY_COLOR[task.priority]}>{PRIORITY_LABEL[task.priority]}</Tag>
                  </Space>
                </div>
                <div style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    申请人：{task.applicant} · 流程：{task.flowName} · {new Date(task.createdAt).toLocaleString('zh-CN')}
                  </Text>
                </div>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
                <Button
                  theme="solid"
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleAction(task, 'approve')}
                >
                  同意
                </Button>
                <Button
                  type="danger"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleAction(task, 'reject')}
                >
                  驳回
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
