import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, Card, Empty, Form, Input, Space, Typography, message } from 'antd';
import { ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';
import { aggregateResult } from '@/api/collaborations';
import type { CollaborationTask } from '@/api/collaborations';

interface ResultAggregatorProps {
  task: CollaborationTask;
}

export default function ResultAggregator({ task }: ResultAggregatorProps) {
  const [aggregated, setAggregated] = useState<string>(task.finalReport || '');
  const [loading, setLoading] = useState(false);

  const handleAggregate = async () => {
    setLoading(true);
    try {
      const res = await aggregateResult(task.collaborationId);
      if (res.success) {
        setAggregated(res.report);
        message.success('已聚合');
      }
    } finally {
      setLoading(false);
    }
  };

  if (task.subtasks.length === 0) {
    return <Empty description="没有子任务，无法聚合" />;
  }

  const completed = task.subtasks.filter((s) => s.status === 'completed').length;

  return (
    <Card title="结果汇聚">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          子任务完成情况：{completed} / {task.subtasks.length}
        </Typography.Text>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={handleAggregate}
          disabled={completed < task.subtasks.length}
        >
          汇聚结果
        </Button>

        {aggregated && (
          <Card type="inner" size="small" title={<><FileTextOutlined /> 汇聚结果</>}>
            <pre style={codeStyle}>
              {aggregated}
            </pre>
          </Card>
        )}
      </Space>
    </Card>
  );
}

const codeStyle: CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 360,
  overflow: 'auto',
  margin: 0,
  whiteSpace: 'pre-wrap',
};
