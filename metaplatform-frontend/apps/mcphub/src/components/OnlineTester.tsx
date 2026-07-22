import { useState } from 'react';
import { Button, Card, Empty, Input, Space, Typography, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { Integration, JsonRpcResponse } from '@/types';
import { callJsonRpc } from '@/api/jsonrpc';

interface OnlineTesterProps {
  integration: Integration;
}

export default function OnlineTester({ integration }: OnlineTesterProps) {
  const [method, setMethod] = useState('tools/list');
  const [params, setParams] = useState('{}');
  const [response, setResponse] = useState<JsonRpcResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    let parsed = {};
    try {
      parsed = JSON.parse(params);
    } catch {
      message.warning('参数必须是合法 JSON');
      return;
    }
    setLoading(true);
    try {
      const res = await callJsonRpc(integration.endpoint, {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: parsed,
      });
      setResponse(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="在线测试" size="small">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <Input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={{ width: 200 }}
          />
          <Input
            value={params}
            onChange={(e) => setParams(e.target.value)}
            placeholder="params (JSON)"
            style={{ width: 400 }}
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleTest}
          >
            发送
          </Button>
        </Space>

        {response ? (
          <Typography.Paragraph copyable={{ text: JSON.stringify(response, null, 2) }}>
            <pre style={codeStyle}>
              {JSON.stringify(response, null, 2)}
            </pre>
          </Typography.Paragraph>
        ) : (
          <Empty description="尚未调用" />
        )}
      </Space>
    </Card>
  );
}

const codeStyle: React.CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 320,
  overflow: 'auto',
  margin: 0,
};
