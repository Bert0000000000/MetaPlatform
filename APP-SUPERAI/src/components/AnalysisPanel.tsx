import { useState, useCallback } from 'react';
import {
  Button,
  Input,
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Select,
  Spin,
  Tabs,
} from 'antd';
import {
  PlayCircleOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { generateSql, executeSql, auditSql, autoDetectChartType } from '@/api/analysis';
import type { SqlGenerationResult, SqlExecutionResult, SqlAuditResult, ChartType } from '@/types';

const { TextArea } = Input;

const PIE_COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];

interface AnalysisPanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult: (metadata: { sql?: string; sqlAudit?: SqlAuditResult; chartData?: { type: ChartType; title: string; columns: string[]; data: Record<string, unknown>[] }; chartType?: ChartType }) => void;
}

export default function AnalysisPanel({ query, onQueryChange, onResult }: AnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [sqlResult, setSqlResult] = useState<SqlGenerationResult | null>(null);
  const [editableSql, setEditableSql] = useState('');
  const [execResult, setExecResult] = useState<SqlExecutionResult | null>(null);
  const [auditResult, setAuditResult] = useState<SqlAuditResult | null>(null);
  const [chartType, setChartType] = useState<ChartType | 'auto'>('auto');
  const [activeTab, setActiveTab] = useState('sql');

  const handleGenerate = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await generateSql(query);
      setSqlResult(result);
      setEditableSql(result.sql);
      setActiveTab('sql');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleExecute = useCallback(async () => {
    if (!editableSql.trim()) return;
    setLoading(true);
    try {
      const audit = await auditSql(editableSql);
      setAuditResult(audit);
      if (audit.level === 'danger') {
        return;
      }
      const result = await executeSql(editableSql);
      setExecResult(result);

      const detectedType = chartType === 'auto'
        ? await autoDetectChartType(result.columns, result.rows)
        : chartType;
      const actualChartType = detectedType as ChartType;

      onResult({
        sql: editableSql,
        sqlAudit: audit,
        chartData: { type: actualChartType, title: '查询结果可视化', columns: result.columns, data: result.rows },
        chartType: actualChartType,
      });

      setActiveTab('chart');
    } finally {
      setLoading(false);
    }
  }, [editableSql, chartType, onResult]);

  const handleAudit = useCallback(async () => {
    if (!editableSql.trim()) return;
    setLoading(true);
    try {
      const result = await auditSql(editableSql);
      setAuditResult(result);
      setActiveTab('audit');
    } finally {
      setLoading(false);
    }
  }, [editableSql]);

  const renderAuditResult = () => {
    if (!auditResult) return <Typography.Text type="secondary">点击"安全检查"执行 SQL 安全校验</Typography.Text>;
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert
          type={auditResult.level === 'safe' ? 'success' : auditResult.level === 'warning' ? 'warning' : 'error'}
          message={auditResult.level === 'safe' ? 'SQL 安全检查通过' : auditResult.level === 'warning' ? '存在安全警告' : '存在严重安全风险'}
          showIcon
          icon={
            auditResult.level === 'safe' ? <CheckCircleOutlined /> :
            auditResult.level === 'warning' ? <WarningOutlined /> :
            <CloseCircleOutlined />
          }
        />
        {auditResult.risks.length > 0 && (
          <Card size="small" title={<Typography.Text type="danger">严重风险</Typography.Text>}>
            {auditResult.risks.map((r, i) => (
              <Tag key={i} color="red" icon={<CloseCircleOutlined />} style={{ marginBottom: 4 }}>
                {r}
              </Tag>
            ))}
          </Card>
        )}
        {auditResult.warnings.length > 0 && (
          <Card size="small" title={<Typography.Text type="warning">警告</Typography.Text>}>
            {auditResult.warnings.map((w, i) => (
              <Tag key={i} color="orange" icon={<WarningOutlined />} style={{ marginBottom: 4 }}>
                {w}
              </Tag>
            ))}
          </Card>
        )}
      </Space>
    );
  };

  const renderChart = () => {
    if (!execResult) return <Typography.Text type="secondary">执行 SQL 后查看可视化</Typography.Text>;
    const { columns, rows } = execResult;
    if (columns.length < 2) return <Table dataSource={rows} columns={columns.map((c) => ({ title: c, dataIndex: c, key: c }))} rowKey={(_, i) => String(i)} size="small"  scroll={{ x: 'max-content' }}/>;

    const effectiveChartType = chartType === 'auto' ? 'bar' : chartType;

    switch (effectiveChartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={columns[0]} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={columns[1]} fill="#1677ff" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={columns[0]} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={columns[1]} stroke="#1677ff" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie': {
        const pieData = rows.map((r) => ({ name: String(r[columns[0]]), value: Number(r[columns[1]]) }));
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={columns[0]} type="number" name={columns[0]} />
              <YAxis dataKey={columns[1]} type="number" name={columns[1]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={rows} fill="#1677ff" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case 'table':
      default:
        return (
          <Table
            dataSource={rows}
            columns={columns.map((c) => ({ title: c, dataIndex: c, key: c }))}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={{ pageSize: 10 }}
           scroll={{ x: 'max-content' }}/>
        );
    }
  };

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <TextArea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="描述您想分析的数据，如：按部门统计本月销售额"
          rows={2}
        />
        <Space>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleGenerate}>
            生成 SQL
          </Button>
        </Space>

        {sqlResult && (
          <>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              items={[
                {
                  key: 'sql',
                  label: 'SQL 语句',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {sqlResult.explanation && (
                        <Typography.Text type="secondary">{sqlResult.explanation}</Typography.Text>
                      )}
                      <TextArea
                        value={editableSql}
                        onChange={(e) => setEditableSql(e.target.value)}
                        rows={6}
                        style={{ fontFamily: 'monospace', fontSize: 13 }}
                      />
                      {sqlResult.referencedTables.length > 0 && (
                        <Space wrap>
                          <Typography.Text type="secondary">引用表：</Typography.Text>
                          {sqlResult.referencedTables.map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                        </Space>
                      )}
                      <Space>
                        <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleExecute}>
                          执行 SQL
                        </Button>
                        <Button icon={<SafetyOutlined />} loading={loading} onClick={handleAudit}>
                          安全检查
                        </Button>
                        <Select
                          size="small"
                          value={chartType}
                          onChange={setChartType}
                          style={{ width: 120 }}
                          options={[
                            { label: '自动检测', value: 'auto' },
                            { label: '柱状图', value: 'bar' },
                            { label: '折线图', value: 'line' },
                            { label: '饼图', value: 'pie' },
                            { label: '散点图', value: 'scatter' },
                            { label: '表格', value: 'table' },
                          ]}
                        />
                      </Space>
                    </Space>
                  ),
                },
                {
                  key: 'audit',
                  label: <Space size={4}><SafetyOutlined />安全检查</Space>,
                  children: renderAuditResult(),
                },
                {
                  key: 'result',
                  label: '查询结果',
                  children: execResult ? (
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <Space>
                        <Tag color="blue">{execResult.rowCount} 行</Tag>
                        <Tag>{execResult.executionTime}ms</Tag>
                      </Space>
                      <Table
                        dataSource={execResult.rows}
                        columns={execResult.columns.map((c) => ({ title: c, dataIndex: c, key: c }))}
                        rowKey={(_, i) => String(i)}
                        size="small"
                        pagination={{ pageSize: 5 }}
                        scroll={{ x: 'max-content' }}
                      />
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">执行 SQL 后查看结果</Typography.Text>
                  ),
                },
                {
                  key: 'chart',
                  label: '可视化',
                  children: loading ? <Spin /> : renderChart(),
                },
              ]}
            />
          </>
        )}
      </Space>
    </Card>
  );
}
