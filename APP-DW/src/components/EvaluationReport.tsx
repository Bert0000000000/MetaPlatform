import { Card, Descriptions, Tag, Typography, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { EvaluationReport } from '@/api/evaluations';

interface EvaluationReportCardProps {
  report: EvaluationReport;
}

export default function EvaluationReportCard({ report }: EvaluationReportCardProps) {
  return (
    <Card size="small" title={`评估报告 - ${report.period}`}>
      <Descriptions column={3} size="small">
        <Descriptions.Item label="任务总数">{report.totalTasks}</Descriptions.Item>
        <Descriptions.Item label="平均质量">{report.avgQualityScore.toFixed(2)}</Descriptions.Item>
        <Descriptions.Item label="成功率">{(report.successRate * 100).toFixed(1)}%</Descriptions.Item>
        <Descriptions.Item label="平均耗时">{report.avgDuration}s</Descriptions.Item>
      </Descriptions>
      <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
        <div>
          <Typography.Text strong>亮点：</Typography.Text>
          <ul style={{ marginTop: 4 }}>
            {report.highlights.map((h, i) => (
              <li key={i}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> {h}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Typography.Text strong>待改进：</Typography.Text>
          <ul>
            {report.issues.map((it, i) => (
              <li key={i}>
                <CloseCircleOutlined style={{ color: '#f5222d' }} /> {it}
              </li>
            ))}
          </ul>
        </div>
      </Space>
    </Card>
  );
}
