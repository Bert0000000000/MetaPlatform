import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Spin,
  TabPane,
  Tabs,
  Toast,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { FileText, RefreshCw } from 'lucide-react';
import { listEmployees } from '@/api/dw/employees';
import { generateReport, getQualityTrend, listReports } from '@/api/dw/evaluations';
import type { Employee } from '@/api/dw/types';
import type { ConversationRecord, EvaluationReport } from '@/api/dw/evaluations';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import AutoScorePanel from './components/AutoScorePanel';
import ConversationList from './components/ConversationList';
import EvaluationReportCard from './components/EvaluationReport';
import OptimizationSuggestionsCard from './components/OptimizationSuggestionsCard';
import QualityScoreForm from './components/QualityScoreForm';
import ReplayPanel from './components/ReplayPanel';
import TrendChart from './components/TrendChart';
import './agents.css';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

const REPORT_PERIOD_OPTIONS = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '近 90 天', value: '90d' },
];

/**
 * 数字员工 · 效果评估（DESIGN-SPEC §5：页头 + 筛选栏 + Tabs 分节）。
 *
 * 数据面完全沿用 src/api/dw/{employees,evaluations}：
 *  - 员工列表决定评估范围（FilterBar 里的员工选择器）
 *  - 质量趋势 / 历史报告随员工切换刷新
 *  - 自动评分、优化建议、对话回放各自维持原有行为
 */
export default function EvaluationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState('');

  const [selected, setSelected] = useState<ConversationRecord | null>(null);

  const [trend, setTrend] = useState<Array<{ date: string; score: number }>>([]);
  const [reports, setReports] = useState<EvaluationReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportPeriod, setReportPeriod] = useState<string>('30d');
  const [generating, setGenerating] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reportPreview, setReportPreview] = useState<EvaluationReport | null>(null);

  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesError('');
    try {
      const r = await listEmployees({});
      setEmployees(r.items ?? []);
      setEmployeeId((prev) => prev ?? r.items[0]?.employeeId);
    } catch (e) {
      setEmployees([]);
      setEmployeesError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const loadReportData = useCallback(async (id: string) => {
    setReportsLoading(true);
    setReportsError('');
    const [trendRes, reportsRes] = await Promise.allSettled([
      getQualityTrend(id),
      listReports(id),
    ]);
    setTrend(trendRes.status === 'fulfilled' ? trendRes.value : []);
    if (reportsRes.status === 'fulfilled') {
      setReports(reportsRes.value);
    } else {
      setReports([]);
      setReportsError(
        reportsRes.reason instanceof Error ? reportsRes.reason.message : String(reportsRes.reason),
      );
    }
    setReportsLoading(false);
  }, []);

  // 切换员工时刷新趋势 / 报告
  useEffect(() => {
    setSelected(null);
    setPage(1);
    if (!employeeId) return;
    void loadReportData(employeeId);
  }, [employeeId, loadReportData]);

  const handleGenerateReport = async () => {
    if (!employeeId) {
      Toast.warning('请先选择数字员工');
      return;
    }
    setGenerating(true);
    try {
      await generateReport(employeeId, reportPeriod);
      Toast.success('报告已生成');
      const fresh = await listReports(employeeId);
      setReports(fresh);
      setReportsError('');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const pagedReports = useMemo(
    () => reports.slice((page - 1) * pageSize, page * pageSize),
    [reports, page, pageSize],
  );

  const reportColumns: SemiColumns<EvaluationReport> = [
    { title: '周期', dataIndex: 'period', width: 110 },
    {
      title: '平均分',
      dataIndex: 'avgQualityScore',
      width: 100,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      width: 100,
      render: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    { title: '任务数', dataIndex: 'totalTasks', width: 100 },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, r: EvaluationReport) => (
        <Button theme="borderless" type="primary" size="small" onClick={() => setReportPreview(r)}>
          详情
        </Button>
      ),
    },
  ];

  const currentEmployee = employees.find((e) => e.employeeId === employeeId);

  return (
    <>
      <PageHeader
        title="效果评估"
        desc={
          currentEmployee
            ? `当前员工：${currentEmployee.name} · 共 ${reports.length} 份历史报告`
            : '选择数字员工后查看对话回放、自动评分、优化建议与评估报告'
        }
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            onClick={() => void loadEmployees()}
            loading={employeesLoading}
          >
            刷新
          </Button>
        }
      />

      <FilterBar
        filters={
          <Select
            placeholder="选择数字员工"
            value={employeeId}
            onChange={(v) => setEmployeeId(v as string | undefined)}
            optionList={employees.map((e) => ({ label: e.name, value: e.employeeId }))}
            emptyContent={<span>暂无数字员工</span>}
          />
        }
        right={
          currentEmployee ? (
            <span className="mp-agent-section-label">已选 {currentEmployee.name}</span>
          ) : null
        }
      />

      {employeesError ? (
        <EmptyState
          illustration="failure"
          title="员工列表加载失败"
          desc={employeesError}
          actions={
            <Button theme="solid" type="primary" onClick={() => void loadEmployees()}>
              重试
            </Button>
          }
        />
      ) : employeesLoading && employees.length === 0 ? (
        <div className="mp-agent-loading">
          <Spin size="middle" />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="还没有数字员工"
          desc="先招聘数字员工，才能对它做效果评估。"
        />
      ) : (
        <Tabs>
          <TabPane itemKey="conversations" tab="对话回放">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <ConversationList
                  employeeId={employeeId}
                  onSelect={setSelected}
                  selectedId={selected?.conversationId}
                />
              </Col>
              <Col xs={24} lg={12}>
                {selected ? (
                  <ReplayPanel conversation={selected} />
                ) : (
                  <Card>
                    <EmptyState
                      illustration="no-content"
                      title="选择一段对话进行回放"
                      desc="从左侧「对话记录」点开任意对话。"
                    />
                  </Card>
                )}
              </Col>
            </Row>
          </TabPane>

          <TabPane itemKey="autoScore" tab="自动评分">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <AutoScorePanel
                  employeeId={employeeId}
                  conversationId={selected?.conversationId}
                />
              </Col>
              <Col span={24}>
                <QualityScoreForm />
              </Col>
            </Row>
          </TabPane>

          <TabPane itemKey="suggestions" tab="优化建议">
            {employeeId ? (
              <OptimizationSuggestionsCard employeeId={employeeId} />
            ) : (
              <Card>
                <EmptyState
                  illustration="no-content"
                  title="请先选择数字员工"
                  desc="优化建议按员工维度生成。"
                />
              </Card>
            )}
          </TabPane>

          <TabPane itemKey="reports" tab="评估报告">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <TrendChart data={trend} />
              </Col>
              <Col span={24}>
                <Card
                  title="历史报告"
                  headerExtraContent={
                    <Space>
                      <Select
                        size="small"
                        value={reportPeriod}
                        onChange={(v) => setReportPeriod(v as string)}
                        optionList={REPORT_PERIOD_OPTIONS}
                      />
                      <Button
                        theme="solid"
                        type="primary"
                        size="small"
                        icon={<FileText size={15} strokeWidth={1.5} />}
                        loading={generating}
                        onClick={() => void handleGenerateReport()}
                        disabled={!employeeId}
                      >
                        一键生成报告
                      </Button>
                    </Space>
                  }
                >
                  {reportsError ? (
                    <EmptyState
                      illustration="failure"
                      title="报告列表加载失败"
                      desc={reportsError}
                      actions={
                        <Button
                          theme="solid"
                          type="primary"
                          onClick={() => employeeId && void loadReportData(employeeId)}
                        >
                          重试
                        </Button>
                      }
                    />
                  ) : !reportsLoading && reports.length === 0 ? (
                    <EmptyState
                      illustration="no-content"
                      title="还没有生成的报告"
                      desc="选择周期后点「一键生成报告」。"
                    />
                  ) : (
                    <DataTablePro<EvaluationReport>
                      rowKey="reportId"
                      dataSource={pagedReports}
                      columns={reportColumns}
                      loading={reportsLoading}
                      pagination={{
                        currentPage: page,
                        pageSize,
                        total: reports.length,
                        onChange: setPage,
                        onPageSizeChange: (s) => {
                          setPageSize(s);
                          setPage(1);
                        },
                      }}
                      empty={<EmptyState illustration="no-content" title="还没有生成的报告" />}
                    />
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      )}

      <SheetDetail
        title={reportPreview ? `评估报告 · ${reportPreview.period}` : '评估报告'}
        open={reportPreview !== null}
        onClose={() => setReportPreview(null)}
        footer={<Button onClick={() => setReportPreview(null)}>关闭</Button>}
      >
        {reportPreview ? <EvaluationReportCard report={reportPreview} /> : null}
      </SheetDetail>
    </>
  );
}
