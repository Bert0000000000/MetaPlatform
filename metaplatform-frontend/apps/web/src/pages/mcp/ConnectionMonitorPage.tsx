import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  ReloadOutlined,
  ClusterOutlined,
  LinkOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getConnectionMonitor } from '@/api/mcphub/ide-config';
import type { ConnectionMonitorResponse, ConnectionStatus } from '@/api/mcphub/types';

const STATUS_META: Record<
  ConnectionStatus['connectionStatus'],
  { label: string; color: TagColor; valueColor: string; icon: React.ReactNode }
> = {
  online: { label: '在线', color: 'green', valueColor: 'var(--success)', icon: <CheckCircleFilled /> },
  offline: { label: '离线', color: 'grey', valueColor: 'var(--muted-foreground)', icon: <CloseCircleFilled /> },
  error: { label: '异常', color: 'red', valueColor: 'var(--destructive)', icon: <ExclamationCircleFilled /> },
};

const POLL_INTERVAL_MS = 10000;

function StatusTag({ status }: { status: ConnectionStatus['connectionStatus'] }) {
  const meta = STATUS_META[status];
  return <Tag color={meta.color} prefixIcon={meta.icon}>{meta.label}</Tag>;
}

function ConnectionCard({ item }: { item: ConnectionStatus }) {
  const isServer = item.type === 'server';
  return (
    <Card style={{ marginBottom: 12 }}>
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
          <div style={{ textAlign: 'right' }}>
            <div className="v-stat-label">超时/延迟</div>
            <div className="v-stat-value" style={{ fontSize: 16 }}>{item.latencyMs} ms</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        {item.endpoint && (
          <Typography.Paragraph type="tertiary" ellipsis style={{ marginBottom: 4 }}>
            端点: {item.endpoint}
          </Typography.Paragraph>
        )}
        {item.lastHeartbeatAt && (
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
      <div style={{ textAlign: 'center', padding: 48 }}>
        <ExclamationCircleFilled style={{ fontSize: 48, color: 'var(--destructive)' }} />
        <Typography.Title heading={4} style={{ marginTop: 16 }}>
          加载失败
        </Typography.Title>
        <Typography.Text type="tertiary">{error.message}</Typography.Text>
        <div style={{ marginTop: 24 }}>
          <Button theme="solid" type="primary" icon={<ReloadOutlined />} onClick={load}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <Empty description="暂无监控数据" />;
  }

  const { summary } = data;

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          连接状态监控
        </Typography.Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false}>
            <div className="v-stat-label">Server 总数</div>
            <div className="v-stat-value" style={{ fontSize: 24 }}>
              <ClusterOutlined style={{ fontSize: 16, color: 'var(--muted-foreground)' }} /> {summary.totalServers}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="v-stat-label">Server 在线</div>
            <div className="v-stat-value" style={{ fontSize: 24, color: 'var(--success)' }}>
              <CheckCircleFilled style={{ fontSize: 16 }} /> {summary.onlineServers}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="v-stat-label">Client 总数</div>
            <div className="v-stat-value" style={{ fontSize: 24 }}>
              <LinkOutlined style={{ fontSize: 16, color: 'var(--muted-foreground)' }} /> {summary.totalClients}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="v-stat-label">Client 已连接</div>
            <div className="v-stat-value" style={{ fontSize: 24, color: 'var(--success)' }}>
              <CheckCircleFilled style={{ fontSize: 16 }} /> {summary.connectedClients}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="MCP Server 状态">
            {data.servers.length === 0 ? (
              <Empty description="暂无 Server" />
            ) : (
              data.servers.map((s) => <ConnectionCard key={s.id} item={s} />)
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="MCP Client 状态">
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
