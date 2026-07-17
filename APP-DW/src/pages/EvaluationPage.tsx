import { useEffect, useState } from 'react';
import {
  Card,
  Empty,
  Select,
  Space,
  Typography,
  Tabs,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { listEmployees } from '@/api/employees';
import { getQualityTrend, listReports } from '@/api/evaluations';
import ConversationList from '@/components/ConversationList';
import ReplayPanel from '@/components/ReplayPanel';
import QualityScoreForm from '@/components/QualityScoreForm';
import EvaluationReportCard from '@/components/EvaluationReport';
import TrendChart from '@/components/TrendChart';
import type { Employee } from '@/types';
import type { ConversationRecord, EvaluationReport } from '@/api/evaluations';

export default function EvaluationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>();
  const [selected, setSelected] = useState<ConversationRecord | null>(null);
  const [trend, setTrend] = useState<Array<{ date: string; score: number }>>([]);
  const [reports, setReports] = useState<EvaluationReport[]>([]);

  useEffect(() => {
    listEmployees({}).then((r) => {
      setEmployees(r.items);
      if (r.items.length > 0) setEmployeeId(r.items[0]!.employeeId);
    });
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    getQualityTrend(employeeId).then(setTrend);
    listReports(employeeId).then(setReports);
  }, [employeeId]);

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
            label: '对话记录 + 回放',
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
            key: 'score',
            label: '质量评分',
            children: <QualityScoreForm employeeId={employeeId} />,
          },
          {
            key: 'reports',
            label: '评估报告',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <TrendChart data={trend} />
                <Card title="历史报告">
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
                    />
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
