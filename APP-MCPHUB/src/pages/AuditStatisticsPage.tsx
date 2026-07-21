import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AuditOutlined,
  BarChartOutlined,
  BugOutlined,
  ClockCircleOutlined,
  EditOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  listAuditLogs,
  getAuditStatistics,
  getAuditTrends,
  getAuditAnalytics,
  getAuditTrace,
  exportAuditLogs,
} from '@/api/audit';
import {
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
} from '@/api/alert-rules';
import { listTools } from '@/api/tools';
import { listServers } from '@/api/servers';
import { listClients } from '@/api/clients';
import type {
  AnalyticsItem,
  AuditLog,
  AuditLogDetail,
  AuditLogStatistics,
  AlertRule,
  AlertRuleCreateRequest,
  McpTool,
  McpServer,
  McpClient,
  TrendPoint,
} from '@/types';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'error' },
  { label: '超时', value: 'timeout' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  success: { label: '成功', color: 'success' },
  SUCCESS: { label: '成功', color: 'success' },
  error: { label: '失败', color: 'error' },
  ERROR: { label: '失败', color: 'error' },
  timeout: { label: '超时', color: 'warning' },
  TIMEOUT: { label: '超时', color: 'warning' },
};

const METRIC_OPTIONS = [
  { label: '错误率', value: 'error_rate' },
  { label: '平均耗时', value: 'avg_duration' },
  { label: '调用总量', value: 'total_calls' },
  { label: 'Token 消耗', value: 'token_usage' },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  if (Number.isFinite(value)) return value.toLocaleString('zh-CN');
  return String(value);
}

function buildTimeRange(days = 7): [Dayjs, Dayjs] {
  const end = dayjs().endOf('day');
  const start = dayjs().subtract(days - 1, 'day').startOf('day');
  return [start, end];
}

function getInitialTimeRange(): [Dayjs, Dayjs] {
  return buildTimeRange(7);
}

export default function AuditStatisticsPage() {
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs]>(getInitialTimeRange);
  const [toolId, setToolId] = useState<string | undefined>();
  const [serverId, setServerId] = useState<string | undefined>();
  const [clientId, setClientId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [granularity, setGranularity] = useState<string>('hour');
  const [activeTab, setActiveTab] = useState<string>('trends');
  const [dimension, setDimension] = useState<string>('tool');

  const [tools, setTools] = useState<McpTool[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [clients, setClients] = useState<McpClient[]>([]);

  const [statistics, setStatistics] = useState<AuditLogStatistics | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsItem[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);

  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);
  const [traceLogs, setTraceLogs] = useState<AuditLogDetail[]>([]);
  const [loadingTrace, setLoadingTrace] = useState(false);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleForm] = Form.useForm();
  const [submittingRule, setSubmittingRule] = useState(false);

  const baseParams = useMemo(
    () => ({
      toolId,
      serverId,
      clientId,
      status,
      startTime: timeRange[0].toISOString(),
      endTime: timeRange[1].toISOString(),
    }),
    [toolId, serverId, clientId, status, timeRange],
  );

  const loadMetadata = async () => {
    try {
      const [toolsRes, serversRes, clientsRes] = await Promise.all([
        listTools(),
        listServers(),
        listClients(),
      ]);
      setTools(toolsRes.items);
      setServers(serversRes.items);
      setClients(clientsRes.items);
    } catch {
      message.error('加载筛选元数据失败');
    }
  };

  const loadStatistics = async () => {
    setLoadingStats(true);
    try {
      const res = await getAuditStatistics({
        startTime: baseParams.startTime,
        endTime: baseParams.endTime,
      });
      setStatistics(res);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadTrends = async () => {
    setLoadingTrends(true);
    try {
      const res = await getAuditTrends({ ...baseParams, granularity });
      setTrends(res);
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await getAuditAnalytics({ ...baseParams, dimension });
      setAnalytics(res);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await listAuditLogs({ ...baseParams, size: 50 });
      setLogs(res.items);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadAlertRules = async () => {
    setLoadingRules(true);
    try {
      const res = await listAlertRules({ size: 100 });
      setAlertRules(res.items);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadStatistics();
    loadTrends();
    loadLogs();
  }, [baseParams, granularity]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    } else if (activeTab === 'rules') {
      loadAlertRules();
    }
  }, [activeTab, baseParams, dimension]);

  const handleExport = async (format: string) => {
    try {
      const blob = await exportAuditLogs({ ...baseParams, format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-audit-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const openDrawer = async (log: AuditLog) => {
    setSelectedLog(log as AuditLogDetail);
    setDrawerOpen(true);
    setLoadingTrace(true);
    try {
      const res = await getAuditTrace(log.id);
      setTraceLogs(res);
    } finally {
      setLoadingTrace(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedLog(null);
    setTraceLogs([]);
  };

  const openRuleModal = (rule?: AlertRule) => {
    setEditingRule(rule || null);
    if (rule) {
      ruleForm.setFieldsValue({
        name: rule.name,
        metric: rule.metric,
        threshold: rule.threshold,
        windowMinutes: rule.windowMinutes,
        enabled: rule.enabled,
        notifyChannels: rule.notifyChannels?.join(',') || '',
      });
    } else {
      ruleForm.setFieldsValue({
        metric: 'error_rate',
        enabled: true,
        windowMinutes: 5,
      });
    }
    setRuleModalOpen(true);
  };

  const handleRuleSubmit = async (values: Record<string, unknown>) => {
    const payload: AlertRuleCreateRequest = {
      name: String(values.name),
      metric: String(values.metric),
      threshold: Number(values.threshold),
      windowMinutes: Number(values.windowMinutes),
      enabled: Boolean(values.enabled),
      notifyChannels: String(values.notifyChannels || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    setSubmittingRule(true);
    try {
      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        message.success('告警规则已更新');
      } else {
        await createAlertRule(payload);
        message.success('告警规则已创建');
      }
      setRuleModalOpen(false);
      setEditingRule(null);
      ruleForm.resetFields();
      loadAlertRules();
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await toggleAlertRule(rule.id, !rule.enabled);
      message.success('状态已更新');
      loadAlertRules();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteRule = async (rule: AlertRule) => {
    try {
      await deleteAlertRule(rule.id);
      message.success('告警规则已删除');
      loadAlertRules();
    } catch {
      message.error('删除失败');
    }
  };

  const logColumns: ColumnsType<AuditLog> = [
    {
      title: '工具',
      key: 'tool',
      render: (_, l) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <AuditOutlined /> {l.toolName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {l.method}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, l) => {
        const meta = STATUS_MAP[l.status] || { label: l.status, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      render: (v) => `${v} ms`,
    },
    {
      title: 'Token',
      key: 'tokens',
      render: (_, l) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          <span>输入：{l.inputTokens || 0}</span>
          <span>输出：{l.outputTokens || 0}</span>
          <Typography.Text strong>总计：{l.totalTokens || 0}</Typography.Text>
        </Space>
      ),
    },
    { title: '调用方', dataIndex: 'userId' },
    {
      title: '时间',
      key: 'timestamp',
      render: (_, l) => formatTime(l.timestamp),
    },
    {
      title: 'Trace',
      dataIndex: 'traceId',
      render: (v) => (v ? <code>{v}</code> : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, l) => (
        <Button type="link" onClick={() => openDrawer(l)}>
          详情
        </Button>
      ),
    },
  ];

  const analyticsColumns: ColumnsType<AnalyticsItem> = [
    {
      title: '维度',
      dataIndex: 'dimensionKey',
      render: (v) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: '调用次数',
      dataIndex: 'count',
      align: 'right',
      render: (v) => formatNumber(v),
    },
    {
      title: '错误数',
      dataIndex: 'errorCount',
      align: 'right',
      render: (v) => <span style={{ color: '#ff4d4f' }}>{formatNumber(v)}</span>,
    },
    {
      title: 'Token 消耗',
      dataIndex: 'tokenCount',
      align: 'right',
      render: (v) => formatNumber(v),
    },
    {
      title: '平均耗时',
      dataIndex: 'avgDuration',
      align: 'right',
      render: (v: number) => `${Number(v).toFixed(0)} ms`,
    },
  ];

  const ruleColumns: ColumnsType<AlertRule> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      render: (v) => (
        <Typography.Text strong>
          <WarningOutlined style={{ marginRight: 8, color: '#faad14' }} />
          {v}
        </Typography.Text>
      ),
    },
    {
      title: '指标',
      dataIndex: 'metric',
      render: (v) => METRIC_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      render: (v: number) => v,
    },
    {
      title: '窗口（分钟）',
      dataIndex: 'windowMinutes',
    },
    {
      title: '通知渠道',
      dataIndex: 'notifyChannels',
      render: (v: string[] | undefined) =>
        (v || []).length > 0 ? v!.map((c) => <Tag key={c}>{c}</Tag>) : '-',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v, r) => <Switch checked={v} onChange={() => handleToggleRule(r)} />,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openRuleModal(r)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteRule(r)}>
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const trendChartData = useMemo(
    () =>
      trends.map((t) => ({
        time: formatTime(t.time),
        calls: t.count,
        errors: t.errorCount,
        tokens: t.tokenCount,
        duration: Number(t.avgDuration.toFixed(0)),
      })),
    [trends],
  );

  const renderTrendsTab = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="调用量 / 错误数趋势" size="small" loading={loadingTrends}>
            {trendChartData.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1677ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="calls"
                    name="调用量"
                    stroke="#1677ff"
                    fillOpacity={1}
                    fill="url(#colorCalls)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="errors"
                    name="错误数"
                    stroke="#ff4d4f"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Token 消耗趋势" size="small" loading={loadingTrends}>
            {trendChartData.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#722ed1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#722ed1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    name="Token 消耗"
                    stroke="#722ed1"
                    fill="url(#colorTokens)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="平均耗时趋势" size="small" loading={loadingTrends}>
            {trendChartData.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis suffix="ms" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="duration"
                    name="平均耗时 (ms)"
                    stroke="#13c2c2"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );

  const renderAnalyticsTab = () => (
    <Card
      title="多维分析"
      size="small"
      extra={
        <Select
          value={dimension}
          onChange={setDimension}
          style={{ width: 140 }}
          options={[
            { label: '按工具', value: 'tool' },
            { label: '按 Server', value: 'server' },
            { label: '按 Client', value: 'client' },
          ]}
        />
      }
      loading={loadingAnalytics}
    >
      <Table
        rowKey={(r) => `${r.dimension}-${r.dimensionKey}`}
        dataSource={analytics}
        columns={analyticsColumns}
        pagination={false}
        locale={{ emptyText: <Empty description="暂无数据" /> }}
       scroll={{ x: 'max-content' }}/>
    </Card>
  );

  const renderRulesTab = () => (
    <Card
      title="告警规则"
      size="small"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openRuleModal()}>
          创建规则
        </Button>
      }
      loading={loadingRules}
    >
      <Table
        rowKey="id"
        dataSource={alertRules}
        columns={ruleColumns}
        pagination={false}
        locale={{ emptyText: <Empty description="还没有告警规则" scroll={{ x: 'max-content' }} /> }}
       scroll={{ x: 'max-content' }}/>
    </Card>
  );

  const renderLogsTab = () => (
    <Card title="调用日志" size="small" loading={loadingLogs}>
      <Table
        rowKey="id"
        dataSource={logs}
        columns={logColumns}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无调用日志" scroll={{ x: 'max-content' }} /> }}
       scroll={{ x: 'max-content' }}/>
    </Card>
  );

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          <BarChartOutlined /> 调用审计统计
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadStatistics()} loading={loadingStats}>
            刷新
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => handleExport('csv')}>
            导出 CSV
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={() => handleExport('xlsx')}>
            导出 Excel
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          value={timeRange}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setTimeRange([dates[0], dates[1]]);
            }
          }}
        />
        <Select
          placeholder="工具"
          allowClear
          style={{ width: 180 }}
          value={toolId}
          onChange={setToolId}
          options={tools.map((t) => ({ label: t.name, value: t.id }))}
        />
        <Select
          placeholder="Server"
          allowClear
          style={{ width: 180 }}
          value={serverId}
          onChange={setServerId}
          options={servers.map((s) => ({ label: s.name, value: s.id }))}
        />
        <Select
          placeholder="Client"
          allowClear
          style={{ width: 180 }}
          value={clientId}
          onChange={setClientId}
          options={clients.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 120 }}
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
        <Select
          placeholder="粒度"
          style={{ width: 120 }}
          value={granularity}
          onChange={setGranularity}
          options={[
            { label: '按小时', value: 'hour' },
            { label: '按天', value: 'day' },
          ]}
        />
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="总调用量"
              value={statistics?.totalCalls || 0}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="成功率"
              value={(statistics?.successRate || 0) * 100}
              suffix="%"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="平均耗时"
              value={statistics?.avgDuration || 0}
              suffix="ms"
              precision={0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="Token 消耗"
              value={statistics?.totalTokens || 0}
              prefix={<BugOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'trends', label: '趋势分析', children: renderTrendsTab() },
          { key: 'analytics', label: '多维分析', children: renderAnalyticsTab() },
          { key: 'rules', label: '告警规则', children: renderRulesTab() },
          { key: 'logs', label: '调用日志', children: renderLogsTab() },
        ]}
      />

      <Drawer
        title="调用详情"
        width={720}
        open={drawerOpen}
        onClose={closeDrawer}
        extra={
          selectedLog?.traceId ? (
            <Tag icon={<ExportOutlined />}>trace: {selectedLog.traceId}</Tag>
          ) : null
        }
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card title="基本信息" size="small">
              <Row gutter={[16, 8]}>
                <Col span={12}>工具：{selectedLog.toolName}</Col>
                <Col span={12}>方法：{selectedLog.method}</Col>
                <Col span={12}>
                  状态：
                  {(() => {
                    const meta = STATUS_MAP[selectedLog.status] || {
                      label: selectedLog.status,
                      color: 'default',
                    };
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  })()}
                </Col>
                <Col span={12}>耗时：{selectedLog.duration} ms</Col>
                <Col span={12}>输入 Token：{selectedLog.inputTokens || 0}</Col>
                <Col span={12}>输出 Token：{selectedLog.outputTokens || 0}</Col>
                <Col span={12}>Server：{selectedLog.serverId || '-'}</Col>
                <Col span={12}>Client：{selectedLog.clientId || '-'}</Col>
                <Col span={12}>调用方：{selectedLog.userId || '-'}</Col>
                <Col span={12}>时间：{formatTime(selectedLog.timestamp)}</Col>
              </Row>
            </Card>

            <Card title="执行链路" size="small" loading={loadingTrace}>
              {traceLogs.length === 0 ? (
                <Empty description="无链路信息" />
              ) : (
                <Timeline
                  mode="left"
                  items={traceLogs.map((l) => ({
                    label: formatTime(l.timestamp || l.calledAt || ''),
                    children: (
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>
                          {l.toolName || l.toolCode || '调用节点'}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {l.method || l.invocationType} · {l.durationMs || l.duration} ms ·{' '}
                          {l.status}
                        </Typography.Text>
                        {l.errorMessage && (
                          <Typography.Text type="danger" style={{ fontSize: 12 }}>
                            {l.errorMessage}
                          </Typography.Text>
                        )}
                      </Space>
                    ),
                    color:
                      l.status === 'success' || l.status === 'SUCCESS'
                        ? 'green'
                        : l.status === 'timeout' || l.status === 'TIMEOUT'
                          ? 'orange'
                          : 'red',
                  }))}
                />
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={editingRule ? '编辑告警规则' : '创建告警规则'}
        open={ruleModalOpen}
        onOk={() => ruleForm.submit()}
        onCancel={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
          ruleForm.resetFields();
        }}
        confirmLoading={submittingRule}
        destroyOnClose
      >
        <Form form={ruleForm} layout="vertical" onFinish={handleRuleSubmit}>
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：高错误率告警" />
          </Form.Item>
          <Form.Item
            name="metric"
            label="监控指标"
            rules={[{ required: true, message: '请选择监控指标' }]}
          >
            <Select options={METRIC_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="threshold"
            label="阈值"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="例如：0.05" />
          </Form.Item>
          <Form.Item
            name="windowMinutes"
            label="统计窗口（分钟）"
            rules={[{ required: true, message: '请输入窗口时间' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="例如：5" />
          </Form.Item>
          <Form.Item name="notifyChannels" label="通知渠道（逗号分隔）">
            <Input placeholder="例如：email,webhook,im" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
