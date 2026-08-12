import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, Card, Empty, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';
import { aggregateReport } from '@/api/dw/evaluations';
import type { CollaborationTask } from '@/api/dw/collaborations';

interface ResultAggregatorProps {
  task: CollaborationTask;
}

export default function ResultAggregator({ task }: ResultAggregatorProps) {
  const [aggregated, setAggregated] = useState<string>(task.finalReport || '');
  const [metrics, setMetrics] = useState<{
    totalEmployees: number;
    totalConversations: number;
    avgQualityScore: number;
    successRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // 收集协作子任务中的所有员工 ID（去重、过滤空值）。
  const employeeIds = useMemo(
    () =>
      Array.from(
        new Set(
          task.subtasks
            .map((s) => s.employeeId)
            .filter((id): id is string => !!id),
        ),
      ),
    [task.subtasks],
  );

  const handleAggregate = async () => {
    if (employeeIds.length === 0) {
      Toast.warning('子任务未关联任何员工，无法聚合');
      return;
    }
    setLoading(true);
    try {
      const resp = await aggregateReport({
        collaborationId: task.collaborationId,
        employeeIds,
      });
      setAggregated(resp.report);
      setMetrics({
        totalEmployees: resp.totalEmployees,
        totalConversations: resp.totalConversations,
        avgQualityScore: resp.avgQualityScore,
        successRate: resp.successRate,
      });
      Toast.success('已聚合');
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
      <Space vertical style={{ width: '100%' }}>
        <Typography.Text type="tertiary">
          子任务完成情况：{completed} / {task.subtasks.length}
        </Typography.Text>
        <Typography.Text type="tertiary">
          参与员工：{employeeIds.length > 0 ? employeeIds.map((id) => (
            <Tag key={id} color="blue" style={{ marginRight: 4 }}>
              {id}
            </Tag>
          )) : '（无）'}
        </Typography.Text>
        <Button
          theme="solid"
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={handleAggregate}
          disabled={completed < task.subtasks.length || employeeIds.length === 0}
        >
          汇聚结果
        </Button>

        {metrics && (
          <Card title="聚合指标">
            <Space spacing="loose" wrap>
              <Typography.Text>
                员工数：<strong>{metrics.totalEmployees}</strong>
              </Typography.Text>
              <Typography.Text>
                对话数：<strong>{metrics.totalConversations}</strong>
              </Typography.Text>
              <Typography.Text>
                平均分：<strong>{metrics.avgQualityScore.toFixed(2)}</strong>
              </Typography.Text>
              <Typography.Text>
                成功率：
                <strong>{(metrics.successRate * 100).toFixed(1)}%</strong>
              </Typography.Text>
            </Space>
          </Card>
        )}

        {aggregated && (
          <Card title={<><FileTextOutlined /> 汇聚结果</>}>
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
  background: 'var(--semi-color-fill-0)',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 360,
  overflow: 'auto',
  margin: 0,
  whiteSpace: 'pre-wrap',
};
