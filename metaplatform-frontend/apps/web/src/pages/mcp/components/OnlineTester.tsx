import { useState } from 'react';
import { Button, Card, Empty, Input, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { Integration, JsonRpcResponse } from '@/api/mcphub/types';
import { callJsonRpc } from '@/api/mcphub/jsonrpc';

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
      Toast.warning('参数必须是合法 JSON');
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
    <Card title="在线测试">
      <Space vertical spacing="medium" style={{ width: '100%' }}>
        <Space>
          <Input
            value={method}
            onChange={(val) => setMethod(val)}
            style={{ width: 200 }}
          />
          <Input
            value={params}
            onChange={(val) => setParams(val)}
            placeholder="params (JSON)"
            style={{ width: 400 }}
          />
          <Button
            theme="solid"
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleTest}
          >
            发送
          </Button>
        </Space>

        {response ? (
          <Typography.Paragraph copyable={{ content: JSON.stringify(response, null, 2) }}>
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
  background: 'var(--card)',
  border: '1px solid var(--border)',
  padding: 12,
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  maxHeight: 320,
  overflow: 'auto',
  margin: 0,
};
