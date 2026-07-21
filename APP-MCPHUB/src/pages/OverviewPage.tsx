import { useEffect, useState } from 'react';
import {
  AlertOutlined,
  ApiOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  ExclamationCircleFilled,
  ThunderboltOutlined,
  WarningFilled,
} from '@ant-design/icons';
import {
  Card,
  Col,
  Empty,
  List,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getOverview } from '@/api/overview';
import type {
  OverviewErrorAlert,
  OverviewResponse,
  OverviewTopTool,
  OverviewTrendPoint,
} from '@/types';

const HOUR_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatHour(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return HOUR_FORMATTER.format(date);
}

function formatNumber(value: number): string {
  if (Number.isFinite(value)) {
    return value.toLocaleString('zh-CN');
  }
  return String(value);
}

function ServerStatsCard({ stats }: { stats: OverviewResponse['serverStats'] }) {
  return (
    <Card title="MCP Server 状态" size="small">
      <Row gutter={[16, 8]}>
        <Col span={6}>
          <Statistic title="总数" value={stats.total} prefix={<ApiOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic
            title="在线"
            value={stats.online}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleFilled />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="离线"
            value={stats.offline}
            valueStyle={{ color: '#8c8c8c' }}
            prefix={<CloseCircleFilled />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="异常"
            value={stats.error}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<ExclamationCircleFilled />}
          />
        </Col>
      </Row>
    </Card>
  );
}

function ToolStatsCard({ stats }: { stats: OverviewResponse['toolStats'] }) {
  return (
    <Card title="工具总数" size="small">
      <Row gutter={[16, 8]}>
        <Col span={8}>
          <Statistic title="总数" value={stats.total} prefix={<ThunderboltOutlined />} />
        </Col>
        <Col span={8}>
          <Statistic
            title="已启用"
            value={stats.enabled}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="已禁用"
            value={stats.disabled}
            valueStyle={{ color: '#8c8c8c' }}
          />
        </Col>
      </Row>
    </Card>
  );
}

function CallStatsCard({
  stats,
  trend,
}: {
  stats: OverviewResponse['callStats'];
  trend: OverviewTrendPoint[];
}) {
  const chartData = trend.map((p) => ({ time: formatHour(p.time), calls: p.count }));
  return (
    <Card title="今日调用" size="small">
      <Row gutter={[16, 8]}>
        <Col span={8}>
          <Statistic title="今日调用数" value={stats.todayCalls} />
        </Col>
        <Col span={8}>
          <Statistic
            title="成功率"
            value={stats.successRate}
            precision={2}
            suffix="%"
            valueStyle={{ color: '#1677ff' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="平均耗时"
            value={stats.avgDuration}
            precision={0}
            suffix="ms"
          />
        </Col>
      </Row>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180} style={{ marginTop: 12 }}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="calls" stroke="#1677ff" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty description="今日暂无调用" style={{ marginTop: 16 }} />
      )}
    </Card>
  );
}

function TokenStatsCard({
  stats,
  trend,
}: {
  stats: OverviewResponse['tokenStats'];
  trend: OverviewTrendPoint[];
}) {
  const chartData = trend.map((p) => ({ time: formatHour(p.time), tokens: p.tokens }));
  return (
    <Card title="今日 Token 消耗" size="small">
      <Row gutter={[16, 8]}>
        <Col span={8}>
          <Statistic title="输入 Token" value={stats.todayInputTokens} />
        </Col>
        <Col span={8}>
          <Statistic title="输出 Token" value={stats.todayOutputTokens} />
        </Col>
        <Col span={8}>
          <Statistic
            title="合计"
            value={stats.todayTotalTokens}
            valueStyle={{ color: '#722ed1' }}
          />
        </Col>
      </Row>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180} style={{ marginTop: 12 }}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="tokens" stroke="#722ed1" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty description="今日暂无 Token 消耗" style={{ marginTop: 16 }} />
      )}
    </Card>
  );
}

const LEVEL_META: Record<OverviewErrorAlert['level'], { color: string; icon: React.ReactNode }> = {
  error: {
    color: 'error',
    icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
  },
  warning: {
    color: 'warning',
    icon: <WarningFilled style={{ color: '#faad14' }} />,
  },
};

function ErrorAlertsCard({ alerts }: { alerts: OverviewErrorAlert[] }) {
  return (
    <Card
      title={
        <span>
          <AlertOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
          近期错误告警
        </span>
      }
      size="small"
    >
      {alerts.length === 0 ? (
        <Empty description="近期无错误告警" />
      ) : (
        <List
          dataSource={alerts}
          rowKey={(item) => item.id}
          renderItem={(item) => {
            const meta = LEVEL_META[item.level] ?? LEVEL_META.error;
            return (
              <List.Item>
                <List.Item.Meta
                  avatar={meta.icon}
                  title={
                    <Typography.Text strong>
                      {item.toolCode || '未知工具'}
                      <Tag color={meta.color} style={{ marginLeft: 8 }}>
                        {item.status}
                      </Tag>
                      <Tag color={meta.color} style={{ marginLeft: 4 }}>
                        {item.level}
                      </Tag>
                    </Typography.Text>
                  }
                  description={
                    <Typography.Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 0 }}
                    >
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {item.calledAt ? new Date(item.calledAt).toLocaleString() : '-'}
                      {item.traceId ? ` · trace: ${item.traceId}` : ''}
                      <br />
                      {item.errorMessage || '无错误详情'}
                    </Typography.Paragraph>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}

function TopToolsCard({ tools }: { tools: OverviewTopTool[] }) {
  const columns: ColumnsType<OverviewTopTool> = [
    {
      title: '排名',
      key: 'rank',
      width: 64,
      render: (_, __, index) => index + 1,
    },
    {
      title: '工具编码',
      dataIndex: 'toolCode',
      render: (v: string) => <Typography.Text code>{v || '-'}</Typography.Text>,
    },
    {
      title: '调用次数',
      dataIndex: 'count',
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
  ];
  return (
    <Card title="Top Tools 调用排行" size="small">
      <Table
        rowKey={(item) => item.toolCode}
        size="small"
        pagination={false}
        columns={columns}
        dataSource={tools}
        locale={{ emptyText: <Empty description="今日暂无调用" /> }}
       scroll={{ x: 'max-content' }}/>
    </Card>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOverview()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载概览数据..." />
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        MCP Hub 概览
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <ServerStatsCard stats={data.serverStats} />
        </Col>
        <Col xs={24} lg={12}>
          <ToolStatsCard stats={data.toolStats} />
        </Col>
        <Col xs={24} lg={12}>
          <CallStatsCard stats={data.callStats} trend={data.callTrend} />
        </Col>
        <Col xs={24} lg={12}>
          <TokenStatsCard stats={data.tokenStats} trend={data.tokenTrend} />
        </Col>
        <Col xs={24} lg={12}>
          <TopToolsCard tools={data.topTools} />
        </Col>
        <Col span={24}>
          <ErrorAlertsCard alerts={data.errorAlerts} />
        </Col>
      </Row>
    </div>
  );
}
