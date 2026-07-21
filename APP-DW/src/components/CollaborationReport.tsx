import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { getCollaborationReport } from '@/api/collaborations';
import type { CollaborationReport, Contribution } from '@/api/collaborations';

interface CollaborationReportProps {
  collaborationId: string;
}

function formatSeconds(s?: number | null): string {
  if (!s || s <= 0) return '-';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

export default function CollaborationReport({
  collaborationId,
}: CollaborationReportProps) {
  const [report, setReport] = useState<CollaborationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getCollaborationReport(collaborationId);
      setReport(r);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载报告失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaborationId]);

  const handleDownload = () => {
    if (!report?.finalReport) return;
    const blob = new Blob([report.finalReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaboration_${collaborationId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已下载 Markdown 报告');
  };

  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert
          type="warning"
          showIcon
          message="协作报告暂不可用"
          description={
            <Space direction="vertical">
              <Typography.Text type="secondary">{error}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                请先执行协作任务后再查看报告。
              </Typography.Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={load}>
                重试
              </Button>
            </Space>
          }
        />
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <Empty description="暂无报告" />
      </Card>
    );
  }

  const contributionColumns: ColumnsType<Contribution> = [
    {
      title: '员工 ID',
      dataIndex: 'employeeId',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '子任务数',
      dataIndex: 'subtaskCount',
      align: 'right' as const,
    },
    {
      title: '已完成',
      dataIndex: 'completedCount',
      align: 'right' as const,
      render: (v: number) => <Typography.Text type="success">{v}</Typography.Text>,
    },
    {
      title: '失败',
      dataIndex: 'failedCount',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : v,
    },
    {
      title: '累计耗时',
      dataIndex: 'totalSeconds',
      align: 'right' as const,
      render: (v: number) => formatSeconds(v),
    },
  ];

  const efficiencyPositive = report.efficiencyImprovementPct >= 30;

  return (
    <Card
      title="协作报告"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!report.finalReport}
          >
            下载 Markdown
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card type="inner" title="基础信息">
          <Space size="large" wrap>
            <Statistic title="协作任务" value={report.title} />
            <Statistic
              title="状态"
              value={report.status}
              valueStyle={{ textTransform: 'capitalize' }}
            />
            <Statistic
              title="子任务总数"
              value={report.totalSubtasks}
              suffix="个"
            />
            <Statistic
              title="已完成"
              value={report.completedSubtasks}
              valueStyle={{ color: '#3f8600' }}
            />
            {report.failedSubtasks > 0 && (
              <Statistic
                title="失败"
                value={report.failedSubtasks}
                valueStyle={{ color: '#cf1322' }}
              />
            )}
          </Space>
          <Typography.Paragraph style={{ marginTop: 12 }}>
            <Typography.Text strong>目标：</Typography.Text>
            {report.goal}
          </Typography.Paragraph>
        </Card>

        <Card type="inner" title="效率提升分析">
          <Space size="large" wrap>
            <Statistic
              title="实际总耗时（并行执行）"
              value={formatSeconds(report.parallelDurationSeconds)}
            />
            <Statistic
              title="顺序执行预估耗时"
              value={formatSeconds(report.sequentialDurationSeconds)}
            />
            <Statistic
              title="效率提升"
              value={report.efficiencyImprovementPct}
              suffix="%"
              valueStyle={{
                color: efficiencyPositive ? '#3f8600' : '#cf1322',
              }}
            />
          </Space>
          {report.efficiencyImprovementPct >= 30 ? (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              showIcon
              message={`协作效率提升 ${report.efficiencyImprovementPct.toFixed(
                1,
              )}%，达到 V15-04 验收标准（≥30%）`}
            />
          ) : report.efficiencyImprovementPct > 0 ? (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message={`协作效率提升 ${report.efficiencyImprovementPct.toFixed(
                1,
              )}%，未达 V15-04 验收标准（≥30%）`}
            />
          ) : (
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="本次任务为顺序执行，无并行效率提升"
            />
          )}
        </Card>

        <Card type="inner" title="各员工贡献">
          <Table
            rowKey="employeeId"
            dataSource={report.contributions ?? []}
            columns={contributionColumns}
            pagination={false}
            size="middle" scroll={{ x: 'max-content' }} />
        </Card>

        {report.finalReport && (
          <Card type="inner" title="完整报告（Markdown）">
            <pre
              style={{
                background: '#fafafa',
                padding: 12,
                borderRadius: 4,
                fontFamily: 'Menlo, Consolas, monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                maxHeight: 480,
                overflow: 'auto',
                margin: 0,
              }}
            >
              {report.finalReport}
            </pre>
          </Card>
        )}
      </Space>
    </Card>
  );
}
