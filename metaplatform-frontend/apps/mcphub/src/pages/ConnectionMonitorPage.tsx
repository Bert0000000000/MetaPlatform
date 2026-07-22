import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Spin,
  Statistic,
  Tag,
  Typography,
  Result,
} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  ReloadOutlined,
  ClusterOutlined,
  LinkOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getConnectionMonitor } from '@/api/ide-config';
import type { ConnectionMonitorResponse, ConnectionStatus } from '@/types';

const STATUS_META: Record<
  ConnectionStatus['connectionStatus'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  online: { label: '在线', color: '#52c41a', icon: <CheckCircleFilled /> },
  offline: { label: '离线', color: '#8c8c8c', icon: <CloseCircleFilled /> },
  error: { label: '异常', color: '#ff4d4f', icon: <ExclamationCircleFilled /> },
};

const POLL_INTERVAL_MS = 10000;

function StatusTag({ status }: { status: ConnectionStatus['connectionStatus'] }) {
  const meta = STATUS_META[status];
  return <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>;
}

function ConnectionCard({ item }: { item: ConnectionStatus }) {
  const isServer = item.type === 'server';
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Typography.Text strong>
            {isServer ? <ClusterOutlined /> : <LinkOutlined />} {item.name}
          </Typography.Text>
          <div style={{ marginTop: 4 }}>
            <Tag>{item.transportType || '-'}</Tag>
            <StatusTag status={item.connectionStatus} />
          </div>
        </div>
        {item.latencyMs !== undefined && (
          <Statistic
            title="超时/延迟"
            value={item.latencyMs}
            suffix="ms"
            valueStyle={{ fontSize: 16 }}
          />
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        {item.endpoint && (
          <Typography.Paragraph type="secondary" ellipsis style={{ marginBottom: 4 }}>
            端点: {item.endpoint}
          </Typography.Paragraph>
        )}
        {item.lastHeartbeatAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            最后心跳: {new Date(item.lastHeartbeatAt).toLocaleString()}
          </Typography.Text>
        )}
        {item.lastErrorMessage && (
          <Typography.Paragraph type="danger" ellipsis={{ rows: 2 }} style={{ marginBottom: 0, marginTop: 4 }}>
            {item.lastErrorMessage}
          </Typography.Paragraph>
        )}
      </div>
    </Card>
  );
}

export default function ConnectionMonitorPage() {
  const [data, setData] = useState<ConnectionMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getConnectionMonitor();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载监控数据失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin tip="加载连接监控..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error.message}
        extra={
          <Button type="primary" icon={<ReloadOutlined />} onClick={load}>
            重试
          </Button>
        }
      />
    );
  }

  if (!data) {
    return <Empty description="暂无监控数据" />;
  }

  const { summary } = data;

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          连接状态监控
        </Typography.Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Server 总数"
              value={summary.totalServers}
              prefix={<ClusterOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Server 在线"
              value={summary.onlineServers}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleFilled />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Client 总数"
              value={summary.totalClients}
              prefix={<LinkOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Client 已连接"
              value={summary.connectedClients}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleFilled />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="MCP Server 状态" size="small">
            {data.servers.length === 0 ? (
              <Empty description="暂无 Server" />
            ) : (
              data.servers.map((s) => <ConnectionCard key={s.id} item={s} />)
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="MCP Client 状态" size="small">
            {data.clients.length === 0 ? (
              <Empty description="暂无 Client" />
            ) : (
              data.clients.map((c) => <ConnectionCard key={c.id} item={c} />)
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
