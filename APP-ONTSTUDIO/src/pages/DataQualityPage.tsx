import { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  Popconfirm,
  Collapse,
  Switch,
  Statistic,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import {
  getQualityOverview,
  getQualityIssues,
  getQualityRules,
  runQualityCheck,
  updateIssueStatus,
  getDimensionLabel,
  getSeverityLabel,
  getStatusLabel,
  QUALITY_DIMENSION_OPTIONS,
  QUALITY_SEVERITY_OPTIONS,
  QUALITY_STATUS_OPTIONS,
} from '@/api/quality';
import type {
  QualityOverview,
  QualityIssue,
  QualityRule,
  QualitySeverity,
  QualityDimension,
  QualityIssueStatus,
} from '@/types';

const SEVERITY_COLOR: Record<QualitySeverity, string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
};

const STATUS_COLOR: Record<QualityIssueStatus, string> = {
  open: 'red',
  resolved: 'green',
  ignored: 'default',
};

function formatRelativeTime(iso?: string): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(iso).toLocaleString('zh-CN');
}

function TrendIndicator({ trend }: { trend: number }) {
  if (trend > 0) {
    return (
      <Typography.Text type="success" style={{ fontSize: 12 }}>
        <ArrowUpOutlined /> +{trend}
      </Typography.Text>
    );
  }
  if (trend < 0) {
    return (
      <Typography.Text type="danger" style={{ fontSize: 12 }}>
        <ArrowDownOutlined /> {trend}
      </Typography.Text>
    );
  }
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      <MinusOutlined /> 0
    </Typography.Text>
  );
}

export default function DataQualityPage() {
  const [overview, setOverview] = useState<QualityOverview | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<QualityIssueStatus | 'all'>('open');
  const [dimensionFilter, setDimensionFilter] = useState<QualityDimension | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<QualitySeverity | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, list, ruleList] = await Promise.all([
        getQualityOverview(),
        getQualityIssues(),
        getQualityRules(),
      ]);
      setOverview(ov);
      setIssues(list);
      setRules(ruleList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const res = await runQualityCheck();
      message.success(`质量检测任务已启动（jobId: ${res.jobId}）`);
      // 5 秒后刷新
      setTimeout(() => load(), 5000);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '启动失败');
    } finally {
      setRunning(false);
    }
  }, [load]);

  const handleUpdateStatus = useCallback(
    async (issueId: string, status: QualityIssueStatus) => {
      try {
        await updateIssueStatus(issueId, status);
        message.success(`已更新为「${getStatusLabel(status)}」`);
        setIssues((prev) =>
          prev.map((i) =>
            i.issueId === issueId
              ? {
                  ...i,
                  status,
                  resolvedAt: status === 'resolved' ? new Date().toISOString() : i.resolvedAt,
                }
              : i,
          ),
        );
      } catch (err) {
        message.error(err instanceof Error ? err.message : '更新失败');
      }
    },
    [],
  );

  const filteredIssues = issues.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (dimensionFilter !== 'all' && i.dimension !== dimensionFilter) return false;
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    return true;
  });

  const issueColumns: ColumnsType<QualityIssue> = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      render: (v: QualitySeverity) => <Tag color={SEVERITY_COLOR[v]}>{getSeverityLabel(v)}</Tag>,
    },
    {
      title: '维度',
      dataIndex: 'dimension',
      width: 100,
      render: (v: QualityDimension) => <Tag>{getDimensionLabel(v)}</Tag>,
    },
    {
      title: '规则',
      dataIndex: 'ruleName',
      width: 180,
      render: (v: string, r) => (
        <Tooltip title={r.ruleId}>
          <Typography.Text strong>{v}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: '受影响对象',
      key: 'target',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            {r.conceptName ?? r.conceptId}
            {r.attributeName ? ` · ${r.attributeName}` : ''}
          </Typography.Text>
          {r.entityName && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              实例：{r.entityName}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '问题描述',
      dataIndex: 'message',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: QualityIssueStatus) => <Tag color={STATUS_COLOR[v]}>{getStatusLabel(v)}</Tag>,
    },
    {
      title: '检测时间',
      dataIndex: 'detectedAt',
      width: 140,
      render: (v: string) => formatRelativeTime(v),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, r) =>
        r.status === 'open' ? (
          <Space size="small">
            <Popconfirm
              title="确认标记为已解决？"
              onConfirm={() => handleUpdateStatus(r.issueId, 'resolved')}
            >
              <Button type="link" size="small" icon={<CheckCircleOutlined />}>
                解决
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认忽略此问题？"
              onConfirm={() => handleUpdateStatus(r.issueId, 'ignored')}
            >
              <Button type="link" size="small">
                忽略
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Button
            type="link"
            size="small"
            onClick={() => handleUpdateStatus(r.issueId, 'open')}
          >
            重新打开
          </Button>
        ),
    },
  ];

  const overallScoreColor =
    (overview?.overallScore ?? 0) >= 85
      ? '#52c41a'
      : (overview?.overallScore ?? 0) >= 70
      ? '#faad14'
      : '#ff4d4f';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <ExperimentOutlined /> 数据质量
        </Typography.Title>
        <Space>
          {overview?.lastRunAt && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> 上次检测：{formatRelativeTime(overview.lastRunAt)}
            </Typography.Text>
          )}
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<AlertOutlined />}
            onClick={handleRun}
            loading={running}
          >
            运行质量检测
          </Button>
        </Space>
      </Space>

      {/* 顶部统计卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总体质量评分"
              value={overview?.overallScore ?? 0}
              suffix="/100"
              valueStyle={{ color: overallScoreColor }}
            />
            <Progress
              percent={overview?.overallScore ?? 0}
              showInfo={false}
              strokeColor={overallScoreColor}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="规则总数 / 启用"
              value={overview?.totalRules ?? 0}
              suffix={`/ ${overview?.enabledRules ?? 0}`}
              prefix={<ExperimentOutlined />}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              共启用 {overview?.enabledRules ?? 0} 条质量规则
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理问题"
              value={overview?.openIssues ?? 0}
              valueStyle={{ color: overview?.openIssues ? '#faad14' : undefined }}
              prefix={<WarningOutlined />}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              共 {overview?.totalIssues ?? 0} 条问题
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="严重问题"
              value={overview?.criticalIssues ?? 0}
              valueStyle={{ color: overview?.criticalIssues ? '#ff4d4f' : undefined }}
              prefix={<AlertOutlined />}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              需立即关注
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* 维度评分卡片 */}
      <Card title="六维质量评分" size="small">
        <Row gutter={[16, 16]}>
          {(overview?.scores ?? []).map((s) => (
            <Col span={4} key={s.dimension}>
              <Card size="small" bodyStyle={{ padding: 12, textAlign: 'center' }}>
                <Progress
                  type="dashboard"
                  percent={s.score}
                  size={80}
                  strokeColor={
                    s.score >= 85 ? '#52c41a' : s.score >= 70 ? '#faad14' : '#ff4d4f'
                  }
                />
                <div style={{ marginTop: 4 }}>
                  <Typography.Text strong>{getDimensionLabel(s.dimension)}</Typography.Text>
                </div>
                <Space size={4} style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {s.issueCount} 问题
                  </Typography.Text>
                  <TrendIndicator trend={s.trend} />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 问题列表 */}
      <Card
        title={
          <Space>
            <WarningOutlined />
            质量问题（{filteredIssues.length}）
          </Space>
        }
        size="small"
        extra={
          <Space size="small">
            <Segmented
              size="small"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as QualityIssueStatus | 'all')}
              options={[
                { label: '全部', value: 'all' },
                ...QUALITY_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
              ]}
            />
            <Select
              size="small"
              placeholder="维度"
              allowClear
              value={dimensionFilter === 'all' ? undefined : dimensionFilter}
              onChange={(v) => setDimensionFilter((v ?? 'all') as QualityDimension | 'all')}
              style={{ width: 110 }}
              options={QUALITY_DIMENSION_OPTIONS}
            />
            <Select
              size="small"
              placeholder="严重程度"
              allowClear
              value={severityFilter === 'all' ? undefined : severityFilter}
              onChange={(v) => setSeverityFilter((v ?? 'all') as QualitySeverity | 'all')}
              style={{ width: 110 }}
              options={QUALITY_SEVERITY_OPTIONS}
            />
          </Space>
        }
      >
        {filteredIssues.length === 0 ? (
          <Empty description="暂无符合条件的问题" />
        ) : (
          <Table
            rowKey="issueId"
            dataSource={filteredIssues}
            columns={issueColumns}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            size="small"
            scroll={{ x: 1100 }}
            expandable={{
              expandedRowRender: (r) => (
                <Space direction="vertical" size={4} style={{ padding: '8px 16px' }}>
                  {r.suggestion && (
                    <Typography.Text>
                      <Typography.Text type="secondary">修复建议：</Typography.Text>
                      {r.suggestion}
                    </Typography.Text>
                  )}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    问题ID：{r.issueId} · 规则ID：{r.ruleId}
                    {r.resolvedAt ? ` · 解决时间：${formatRelativeTime(r.resolvedAt)}` : ''}
                  </Typography.Text>
                </Space>
              ),
              rowExpandable: (r) => !!r.suggestion,
            }}
          />
        )}
      </Card>

      {/* 规则列表 */}
      <Card title="质量规则" size="small">
        <Collapse
          items={rules.map((r) => ({
            key: r.ruleId,
            label: (
              <Space>
                <Tag color={SEVERITY_COLOR[r.severity]}>{getSeverityLabel(r.severity)}</Tag>
                <Tag>{getDimensionLabel(r.dimension)}</Tag>
                <Typography.Text strong>{r.name}</Typography.Text>
                {!r.enabled && <Tag>已禁用</Tag>}
              </Space>
            ),
            children: (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Typography.Text>
                  <Typography.Text type="secondary">描述：</Typography.Text>
                  {r.description}
                </Typography.Text>
                <Typography.Text>
                  <Typography.Text type="secondary">表达式：</Typography.Text>
                  <code
                    style={{
                      background: 'rgba(0,0,0,0.04)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {r.expression}
                  </code>
                </Typography.Text>
                <Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    规则ID：{r.ruleId}
                  </Typography.Text>
                  {r.conceptId && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      概念：{r.conceptId}
                    </Typography.Text>
                  )}
                  {r.attributeId && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      属性：{r.attributeId}
                    </Typography.Text>
                  )}
                </Space>
                <Space>
                  <Switch
                    size="small"
                    checked={r.enabled}
                    onChange={async (checked) => {
                      setRules((prev) =>
                        prev.map((x) => (x.ruleId === r.ruleId ? { ...x, enabled: checked } : x)),
                      );
                      message.info(`规则「${r.name}」已${checked ? '启用' : '禁用'}（本地）`);
                    }}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {r.enabled ? '启用中' : '已禁用'}
                  </Typography.Text>
                </Space>
              </Space>
            ),
          }))}
        />
      </Card>
    </Space>
  );
}
