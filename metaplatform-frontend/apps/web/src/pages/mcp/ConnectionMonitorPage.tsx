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
import { PageHeader } from '@/components/skeleton';

const STATUS_META: Record<
  ConnectionStatus['connectionStatus'],
  { label: string; color: TagColor; valueColor: string; icon: React.ReactNode }
> = {
  online: { label: '在线', color: 'green', valueColor: 'var(--semi-color-success)', icon: <CheckCircleFilled /> },
  offline: { label: '离线', color: 'grey', valueColor: 'var(--semi-color-text-2)', icon: <CloseCircleFilled /> },
  error: { label: '异常', color: 'red', valueColor: 'var(--semi-color-danger)', icon: <ExclamationCircleFilled /> },
};

const POLL_INTERVAL_MS = 10000;

function StatusTag({ status }: { status: ConnectionStatus['connectionStatus'] }) {
  const meta = STATUS_META[status];
  return <Tag color={meta.color} prefixIcon={meta.icon}>{meta.label}</Tag>;
}

function ConnectionCard({ item }: { item: ConnectionStatus }) {
  const isServer = item.type === 'server';
  return (
    <Card className="mp-mb-3">
      <div className="mp-flex mp-justify-between mp-items-start" >
        <div>
          <Typography.Text strong>
            {isServer ? <ClusterOutlined /> : <LinkOutlined />} {item.name}
          </Typography.Text>
          <div className="mp-mt-1">
            <Tag>{item.transportType || '-'}</Tag>
            <StatusTag status={item.connectionStatus} />
          </div>
        </div>
        {item.latencyMs !== undefined && (
          <div className="mp-text-right">
            <div className="mp-stat-label">超时/延迟</div>
            <div className="mp-stat-value mp-text-lg" >{item.latencyMs} ms</div>
          </div>
        )}
      </div>
      <div className="mp-mt-3">
        {item.endpoint && (
          <Typography.Paragraph type="tertiary" ellipsis className="mp-mb-1">
            端点: {item.endpoint}
          </Typography.Paragraph>
        )}
        {item.lastHeartbeatAt && (
          <Typography.Text type="tertiary" className="mp-text-sm">
            <ClockCircleOutlined className="mp-mr-1" />
            最后心跳: {new Date(item.lastHeartbeatAt).toLocaleString()}
          </Typography.Text>
        )}
        {item.lastErrorMessage && (
          <Typography.Paragraph type="danger" ellipsis={{ rows: 2 }} className="mp-mt-1 mp-mb-1" >
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
      <div className="mp-text-center mp-p-9">
        <Spin tip="加载连接监控..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mp-text-center mp-p-9">
        <ExclamationCircleFilled className="mp-text-danger mp-text-xl"  />
        <Typography.Title heading={4} className="mp-mt-4">
          加载失败
        </Typography.Title>
        <Typography.Text type="tertiary">{error.message}</Typography.Text>
        <div className="mp-mt-6">
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
      <PageHeader
        title="连接状态监控"
        actions={
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
                  刷新
                </Button>
        }
      />

      <Row gutter={[16, 16]} className="mp-mb-4">
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">Server 总数</div>
            <div className="mp-stat-value mp-text-xl" >
              <ClusterOutlined className="mp-text-lg mp-text-2" /> {summary.totalServers}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">Server 在线</div>
            <div className="mp-stat-value mp-text-success mp-text-xl" >
              <CheckCircleFilled className="mp-text-lg" /> {summary.onlineServers}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">Client 总数</div>
            <div className="mp-stat-value mp-text-xl" >
              <LinkOutlined className="mp-text-lg mp-text-2" /> {summary.totalClients}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <div className="mp-stat-label">Client 已连接</div>
            <div className="mp-stat-value mp-text-success mp-text-xl" >
              <CheckCircleFilled className="mp-text-lg" /> {summary.connectedClients}
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
