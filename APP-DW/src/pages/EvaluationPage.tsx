import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Typography,
  Tabs,
  Table,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileTextOutlined } from '@ant-design/icons';
import { listEmployees } from '@/api/employees';
import { generateReport, getQualityTrend, listReports } from '@/api/evaluations';
import ConversationList from '@/components/ConversationList';
import ReplayPanel from '@/components/ReplayPanel';
import QualityScoreForm from '@/components/QualityScoreForm';
import EvaluationReportCard from '@/components/EvaluationReport';
import TrendChart from '@/components/TrendChart';
import AutoScorePanel from '@/components/AutoScorePanel';
import OptimizationSuggestionsCard from '@/components/OptimizationSuggestionsCard';
import type { Employee } from '@/types';
import type { ConversationRecord, EvaluationReport } from '@/api/evaluations';

const REPORT_PERIOD_OPTIONS = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '近 90 天', value: '90d' },
];

export default function EvaluationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>();
  const [selected, setSelected] = useState<ConversationRecord | null>(null);
  const [trend, setTrend] = useState<Array<{ date: string; score: number }>>([]);
  const [reports, setReports] = useState<EvaluationReport[]>([]);
  const [reportPeriod, setReportPeriod] = useState<string>('30d');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listEmployees({}).then((r) => {
      setEmployees(r.items);
      if (r.items.length > 0) setEmployeeId(r.items[0]!.employeeId);
    });
  }, []);

  // 切换员工时刷新所有 Tab 依赖的数据
  useEffect(() => {
    if (!employeeId) return;
    getQualityTrend(employeeId).then(setTrend);
    listReports(employeeId).then(setReports);
  }, [employeeId]);

  const handleGenerateReport = async () => {
    if (!employeeId) {
      message.warning('请先选择数字员工');
      return;
    }
    setGenerating(true);
    try {
      await generateReport(employeeId, reportPeriod);
      message.success('报告已生成');
      const fresh = await listReports(employeeId);
      setReports(fresh);
    } finally {
      setGenerating(false);
    }
  };

  const columns: ColumnsType<EvaluationReport> = [
    { title: '周期', dataIndex: 'period' },
    {
      title: '平均分',
      dataIndex: 'avgQualityScore',
      render: (v) => v.toFixed(2),
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      render: (v) => `${(v * 100).toFixed(1)}%`,
    },
    { title: '任务数', dataIndex: 'totalTasks' },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>效果评估</Typography.Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="选择数字员工"
          style={{ width: 240 }}
          value={employeeId}
          onChange={setEmployeeId}
          options={employees.map((e) => ({ label: e.name, value: e.employeeId }))}
        />
      </Space>

      <Tabs
        items={[
          {
            key: 'conversations',
            label: '对话回放',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ConversationList
                  employeeId={employeeId}
                  onSelect={setSelected}
                />
                {selected ? (
                  <ReplayPanel conversation={selected} />
                ) : (
                  <Card>
                    <Empty description="选择左侧对话进行回放" />
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'autoScore',
            label: '自动评分',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <AutoScorePanel
                  employeeId={employeeId}
                  conversationId={selected?.conversationId}
                />
                <QualityScoreForm employeeId={employeeId} />
              </Space>
            ),
          },
          {
            key: 'suggestions',
            label: '优化建议',
            children: employeeId ? (
              <OptimizationSuggestionsCard employeeId={employeeId} />
            ) : (
              <Card>
                <Empty description="请先选择数字员工" />
              </Card>
            ),
          },
          {
            key: 'reports',
            label: '评估报告',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <TrendChart data={trend} />
                <Card
                  title="历史报告"
                  extra={
                    <Space>
                      <Select
                        size="small"
                        value={reportPeriod}
                        onChange={setReportPeriod}
                        options={REPORT_PERIOD_OPTIONS}
                        style={{ width: 110 }}
                      />
                      <Button
                        type="primary"
                        size="small"
                        icon={<FileTextOutlined />}
                        loading={generating}
                        onClick={handleGenerateReport}
                        disabled={!employeeId}
                      >
                        一键生成报告
                      </Button>
                    </Space>
                  }
                >
                  {reports.length === 0 ? (
                    <Empty description="还没有生成的报告" />
                  ) : (
                    <Table
                      rowKey="reportId"
                      dataSource={reports}
                      columns={columns}
                      expandable={{
                        expandedRowRender: (r) => <EvaluationReportCard report={r} />,
                      }}
                      pagination={{ pageSize: 10 }}
                     scroll={{ x: 'max-content' }}/>
                  )}
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
