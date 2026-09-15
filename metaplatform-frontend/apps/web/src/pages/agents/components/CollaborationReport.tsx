import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Skeleton,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Download, RefreshCw } from 'lucide-react';
import { getCollaborationReport } from '@/api/dw/collaborations';
import type { CollaborationReport, Contribution } from '@/api/dw/collaborations';
import { DataTablePro, EmptyState } from '@/components/skeleton';

interface CollaborationReportProps {
  collaborationId: string;
}

function formatSeconds(s?: number | null): string {
  if (!s || s <= 0) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

/**
 * 协作报告：单个 Card 内的顺序小节（DESIGN-SPEC §5：结果用 Descriptions / 官方表格呈现，
 * 不再自绘 KPI 数字块）。数据面沿用 getCollaborationReport，加载态用 Skeleton，
 * 失败态用 EmptyState(failure)，下载动作走 Toast 反馈。
 */
export default function CollaborationReport({ collaborationId }: CollaborationReportProps) {
  const [report, setReport] = useState<CollaborationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getCollaborationReport(collaborationId);
      setReport(r);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : '加载报告失败');
    } finally {
      setLoading(false);
    }
  }, [collaborationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = () => {
    if (!report?.finalReport) return;
    const blob = new Blob([report.finalReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaboration_${collaborationId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('已下载 Markdown 报告');
  };

  const columns = useMemo(
    () => [
      {
        title: '员工',
        dataIndex: 'employeeId',
        width: 220,
        render: (v: string) => <Tag size="small" type="light">{v}</Tag>,
      },
      { title: '子任务数', dataIndex: 'subtaskCount', width: 110, align: 'right' as const },
      { title: '已完成', dataIndex: 'completedCount', width: 100, align: 'right' as const },
      { title: '失败', dataIndex: 'failedCount', width: 90, align: 'right' as const },
      {
        title: '累计耗时',
        dataIndex: 'totalSeconds',
        width: 120,
        align: 'right' as const,
        render: (v: number) => formatSeconds(v),
      },
    ],
    [],
  );

  const verdict =
    report === null
      ? null
      : report.efficiencyImprovementPct >= 30
        ? {
            color: 'green' as const,
            text: `效率提升 ${report.efficiencyImprovementPct.toFixed(1)}%，达到验收标准（≥30%）`,
          }
        : report.efficiencyImprovementPct > 0
          ? {
              color: 'amber' as const,
              text: `效率提升 ${report.efficiencyImprovementPct.toFixed(1)}%，未达验收标准（≥30%）`,
            }
          : { color: 'grey' as const, text: '本次任务为顺序执行，无并行效率提升' };

  return (
    <Card
      title="协作报告"
      headerExtraContent={
        <Space>
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
          <Button
            icon={<Download size={15} strokeWidth={1.5} />}
            onClick={handleDownload}
            disabled={!report?.finalReport}
          >
            下载 Markdown
          </Button>
        </Space>
      }
    >
      {loading ? (
        <Skeleton placeholder={<Skeleton.Paragraph rows={6} />} loading />
      ) : error ? (
        <EmptyState
          illustration="failure"
          title="协作报告暂不可用"
          desc={`${error}（请先执行协作任务后再查看报告）`}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : !report ? (
        <EmptyState illustration="no-content" title="暂无报告" desc="执行协作任务后会生成协作报告。" />
      ) : (
        <>
          <Typography.Title heading={6}>基础信息</Typography.Title>
          <Descriptions
            row
            data={[
              { key: '协作任务', value: report.title || '—' },
              { key: '状态', value: report.status },
              { key: '子任务总数', value: `${report.totalSubtasks} 个` },
              { key: '已完成', value: `${report.completedSubtasks} 个` },
              { key: '失败', value: `${report.failedSubtasks} 个` },
              { key: '目标', value: report.goal || '—' },
            ]}
          />

          <Divider />

          <Typography.Title heading={6}>效率提升分析</Typography.Title>
          <Descriptions
            row
            data={[
              { key: '实际总耗时（并行执行）', value: formatSeconds(report.parallelDurationSeconds) },
              { key: '顺序执行预估耗时', value: formatSeconds(report.sequentialDurationSeconds) },
              { key: '效率提升', value: `${report.efficiencyImprovementPct.toFixed(1)}%` },
            ]}
          />
          {verdict ? (
            <Tag color={verdict.color} type="light">
              {verdict.text}
            </Tag>
          ) : null}

          <Divider />

          <Typography.Title heading={6}>各员工贡献</Typography.Title>
          <DataTablePro<Contribution>
            columns={columns}
            dataSource={report.contributions ?? []}
            rowKey="employeeId"
            columnSettings={false}
            empty={<EmptyState illustration="no-content" title="没有贡献记录" />}
          />

          {report.finalReport ? (
            <>
              <Divider />
              <Typography.Title heading={6}>完整报告（Markdown）</Typography.Title>
              <pre>{report.finalReport}</pre>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
