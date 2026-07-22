import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Space,
  Spin,
  Tag,
  Typography,
  Tabs,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getAuditLogDetail } from '@/api/audit';
import type { AuditLogDetail } from '@/types';

const STATUS_MAP: Record<AuditLogDetail['status'], { label: string; color: string }> = {
  success: { label: '成功', color: 'success' },
  error: { label: '失败', color: 'error' },
  timeout: { label: '超时', color: 'warning' },
};

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [log, setLog] = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getAuditLogDetail(id).then((l) => {
        setLog(l);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading || !log) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/audit')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          审计详情：{log.toolName}
        </Typography.Title>
        <Tag color={STATUS_MAP[log.status].color}>{STATUS_MAP[log.status].label}</Tag>
      </Space>

      <Card title="基本信息">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Trace ID">
            <code>{log.traceId}</code>
          </Descriptions.Item>
          <Descriptions.Item label="方法">{log.method}</Descriptions.Item>
          <Descriptions.Item label="调用方">{log.userId}</Descriptions.Item>
          <Descriptions.Item label="耗时">{log.duration} ms</Descriptions.Item>
          <Descriptions.Item label="输入 Token">{log.inputTokens || 0}</Descriptions.Item>
          <Descriptions.Item label="输出 Token">{log.outputTokens || 0}</Descriptions.Item>
          <Descriptions.Item label="Server">{log.serverId}</Descriptions.Item>
          <Descriptions.Item label="Client">{log.clientId}</Descriptions.Item>
          <Descriptions.Item label="时间" span={2}>
            {new Date(log.timestamp).toLocaleString()}
          </Descriptions.Item>
          {log.errorCode && (
            <Descriptions.Item label="错误码" span={2}>
              <Tag color="red">{log.errorCode}</Tag>
            </Descriptions.Item>
          )}
          {log.errorMessage && (
            <Descriptions.Item label="错误信息" span={2}>
              <Typography.Text type="danger">{log.errorMessage}</Typography.Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'params',
              label: '请求参数',
              children: (
                <pre style={jsonStyle}>
                  {JSON.stringify(log.requestParams, null, 2)}
                </pre>
              ),
            },
            {
              key: 'response',
              label: '响应',
              children: (
                <pre style={jsonStyle}>{JSON.stringify(log.response, null, 2)}</pre>
              ),
            },
            {
              key: 'stack',
              label: '堆栈',
              children: log.stackTrace ? (
                <pre style={jsonStyle}>{log.stackTrace}</pre>
              ) : (
                <Typography.Text type="secondary">无堆栈信息</Typography.Text>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

const jsonStyle: React.CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 400,
  overflow: 'auto',
};
