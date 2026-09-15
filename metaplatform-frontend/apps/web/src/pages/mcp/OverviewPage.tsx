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
  Empty,
  List,
  Spin,
  Table,
  Tag,
  Typography,
  Banner,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Col, Row } from '@douyinfe/semi-ui/lib/es/grid';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getOverview } from '@/api/mcphub/overview';
import type {
  OverviewErrorAlert,
  OverviewResponse,
  OverviewTopTool,
  OverviewTrendPoint,
} from '@/api/mcphub/types';
import './mcp.css';

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

/** Semi 无 Statistic，自建（label + 大数字）。 */
function Statistic({
  title,
  value,
  prefix,
  suffix,
  valueClass,
  precision,
}: {
  title: React.ReactNode;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  valueClass?: string;
  precision?: number;
}) {
  const display =
    typeof value === 'number'
      ? (precision == null ? value : value.toFixed(precision)).toLocaleString('zh-CN')
      : String(value);
  return (
    <div>
      <div
        className="mp-mb-1 mp-text-body mp-text-2"
      >
        {title}
      </div>
      <div className={`mp-fw-600 mp-text-xl mp-mcp-lh-13${valueClass ? ` ${valueClass}` : ''}`}>
        {prefix ? (
          <span className="mp-mr-1">{prefix}</span>
        ) : null}
        {display}
        {suffix ? (
          <span className="mp-text-md mp-ml-1 mp-mcp-fw-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ServerStatsCard({ stats }: { stats: OverviewResponse['serverStats'] }) {
  return (
    <Card title="MCP Server 状态">
      <Row gutter={[16, 8]}>
        <Col span={6}>
          <Statistic title="总数" value={stats.total} prefix={<ApiOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic
            title="在线"
            value={stats.online}
            valueClass="mp-text-success"
            prefix={<CheckCircleFilled />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="离线"
            value={stats.offline}
            valueClass="mp-text-2"
            prefix={<CloseCircleFilled />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="异常"
            value={stats.error}
            valueClass="mp-text-danger"
            prefix={<ExclamationCircleFilled />}
          />
        </Col>
      </Row>
    </Card>
  );
}

function ToolStatsCard({ stats }: { stats: OverviewResponse['toolStats'] }) {
  return (
    <Card title="工具总数">
      <Row gutter={[16, 8]}>
        <Col span={8}>
          <Statistic title="总数" value={stats.total} prefix={<ThunderboltOutlined />} />
        </Col>
        <Col span={8}>
          <Statistic
            title="已启用"
            value={stats.enabled}
            valueClass="mp-text-success"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="已禁用"
            value={stats.disabled}
            valueClass="mp-text-2"
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
    <Card title="今日调用">
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
            valueClass="mp-text-primary"
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
        <ResponsiveContainer width="100%" height={180} className="mp-mt-3">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--semi-color-border)" />
            <XAxis dataKey="time" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="calls" stroke="var(--semi-color-primary)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty description="今日暂无调用" className="mp-mt-4" />
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
    <Card title="今日 Token 消耗">
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
            valueClass="mp-mcp-text-purple"
          />
        </Col>
      </Row>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180} className="mp-mt-3">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--semi-color-border)" />
            <XAxis dataKey="time" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="tokens" stroke="rgb(var(--semi-purple-5))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty description="今日暂无 Token 消耗" className="mp-mt-4" />
      )}
    </Card>
  );
}

const LEVEL_META: Record<
  OverviewErrorAlert['level'],
  { color: TagColor; icon: React.ReactNode }
> = {
  error: {
    color: 'red',
    icon: <CloseCircleFilled className="mp-text-danger" />,
  },
  warning: {
    color: 'orange',
    icon: <WarningFilled className="mp-text-warning" />,
  },
};

function ErrorAlertsCard({ alerts }: { alerts: OverviewErrorAlert[] }) {
  return (
    <Card
      title={
        <span>
          <AlertOutlined className="mp-text-danger mp-mr-2"  />
          近期错误告警
        </span>
      }
    >
      {alerts.length === 0 ? (
        <Empty description="近期无错误告警" />
      ) : (
        <List
          dataSource={alerts}
          emptyContent={<Empty description="近期无错误告警" />}
          renderItem={(item) => {
            const meta = LEVEL_META[item.level] ?? LEVEL_META.error;
            return (
              <List.Item>
                <div className="mp-w-full mp-flex mp-items-start" >
                  <div className="mp-mt-1 mp-mr-2" >{meta.icon}</div>
                  <div className="mp-flex-1">
                    <Typography.Text strong>
                      {item.toolCode || '未知工具'}
                      <Tag color={meta.color} className="mp-ml-2">
                        {item.status}
                      </Tag>
                      <Tag color={meta.color} className="mp-ml-1">
                        {item.level}
                      </Tag>
                    </Typography.Text>
                    <div
                      className="mp-mt-1 mp-text-body mp-text-2 mp-lh-16" 
                    >
                      <ClockCircleOutlined className="mp-mr-1" />
                      {item.calledAt ? new Date(item.calledAt).toLocaleString() : '-'}
                      {item.traceId ? ` · trace: ${item.traceId}` : ''}
                      <br />
                      {item.errorMessage || '无错误详情'}
                    </div>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}

function TopToolsCard({ tools }: { tools: OverviewTopTool[] }) {
  const columns: ColumnProps<OverviewTopTool>[] = [
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
    <Card title="Top Tools 调用排行">
      <Table
        rowKey={(item) => item!.toolCode}
        size="small"
        pagination={false}
        columns={columns}
        dataSource={tools}
        empty={<Empty description="今日暂无调用" />}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOverview()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <Banner type="danger" description={error} className="mp-m-6" />;
  }

  if (loading || !data) {
    return (
      <div className="mp-text-center mp-p-9">
        <Spin tip="加载概览数据..." />
      </div>
    );
  }

  return (
    <div>
      <Typography.Title heading={4} className="mp-mb-4 mp-mt-1" >
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
