import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Descriptions,
  Space,
  Spin,
  TabPane,
  Tabs,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { getAuditLogDetail } from '@/api/mcphub/audit';
import type { AuditLogDetail } from '@/api/mcphub/types';

const STATUS_MAP: Record<AuditLogDetail['status'], { label: string; color: TagColor }> = {
  success: { label: '成功', color: 'green' },
  error: { label: '失败', color: 'red' },
  timeout: { label: '超时', color: 'orange' },
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
        <Typography.Title heading={4} style={{ margin: 0 }}>
          审计详情：{log.toolName}
        </Typography.Title>
        <Tag color={STATUS_MAP[log.status].color}>{STATUS_MAP[log.status].label}</Tag>
      </Space>

      <Card title="基本信息">
        <Descriptions
          column={2}
          data={[
            {
              key: 'Trace ID',
              value: <code>{log.traceId}</code>,
            },
            { key: '方法', value: log.method },
            { key: '调用方', value: log.userId },
            { key: '耗时', value: `${log.duration} ms` },
            { key: '输入 Token', value: log.inputTokens || 0 },
            { key: '输出 Token', value: log.outputTokens || 0 },
            { key: 'Server', value: log.serverId },
            { key: 'Client', value: log.clientId },
            {
              key: '时间',
              value: new Date(log.timestamp).toLocaleString(),
              span: 2,
            },
            ...(log.errorCode
              ? [
                  {
                    key: '错误码',
                    value: <Tag color="red">{log.errorCode}</Tag>,
                    span: 2,
                  },
                ]
              : []),
            ...(log.errorMessage
              ? [
                  {
                    key: '错误信息',
                    value: <Typography.Text type="danger">{log.errorMessage}</Typography.Text>,
                    span: 2,
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs>
          <TabPane tab="请求参数" itemKey="params">
            <pre style={jsonStyle}>
              {JSON.stringify(log.requestParams, null, 2)}
            </pre>
          </TabPane>
          <TabPane tab="响应" itemKey="response">
            <pre style={jsonStyle}>{JSON.stringify(log.response, null, 2)}</pre>
          </TabPane>
          <TabPane tab="堆栈" itemKey="stack">
            {log.stackTrace ? (
              <pre style={jsonStyle}>{log.stackTrace}</pre>
            ) : (
              <Typography.Text type="tertiary">无堆栈信息</Typography.Text>
            )}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

const jsonStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 400,
  overflow: 'auto',
};
