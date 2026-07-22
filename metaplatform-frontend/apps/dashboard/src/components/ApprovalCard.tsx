import { useEffect, useState } from 'react';
import { Card, List, Tag, Typography, Space, Empty, Button, Badge } from 'antd';
import { CheckOutlined, CloseOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { getPendingTasks, completeTask } from '@/api/approvals';
import type { ApprovalTask } from '@/types';

const PRIORITY_COLOR: Record<string, string> = {
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
      extra={
        <Badge count={tasks.length} offset={[6, 0]}>
          <Button type="text" icon={<ArrowRightOutlined />} onClick={handleJumpToAppHub} />
        </Badge>
      }
      loading={loading}
    >
      {tasks.length === 0 ? (
        <Empty description="暂无待办审批" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={tasks.slice(0, 5)}
          renderItem={(task) => (
            <List.Item
              actions={[
                <Button
                  key="approve"
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleAction(task, 'approve')}
                >
                  同意
                </Button>,
                <Button
                  key="reject"
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleAction(task, 'reject')}
                >
                  驳回
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Typography.Text strong>{task.title}</Typography.Text>
                    <Tag color={PRIORITY_COLOR[task.priority]}>{PRIORITY_LABEL[task.priority]}</Tag>
                  </Space>
                }
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    申请人：{task.applicant} · 流程：{task.flowName} · {new Date(task.createdAt).toLocaleString('zh-CN')}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
