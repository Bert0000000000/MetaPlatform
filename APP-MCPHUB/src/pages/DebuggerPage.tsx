import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Row,
  Col,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { listTools } from '@/api/tools';
import { callJsonRpc } from '@/api/jsonrpc';
import ParameterForm from '@/components/ParameterForm';
import ResponseViewer from '@/components/ResponseViewer';
import type { JsonRpcRequest, JsonRpcResponse, McpTool } from '@/types';

export default function DebuggerPage() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolId, setToolId] = useState<string>();
  const [method, setMethod] = useState('tools/call');
  const [endpoint, setEndpoint] = useState('/api/v1/mcp/sse/main');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [response, setResponse] = useState<JsonRpcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState<number>();

  useEffect(() => {
    listTools().then((r) => setTools(r.items));
  }, []);

  const tool = tools.find((t) => t.id === toolId);

  const buildRequest = (): JsonRpcRequest => {
    if (tool && method === 'tools/call') {
      return {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: {
          name: tool.code,
          arguments: params,
        },
      };
    }
    return {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };
  };

  const handleExecute = async () => {
    if (method === 'tools/call' && !tool) {
      message.warning('请先选择工具');
      return;
    }
    if (tool) {
      for (const p of tool.inputSchema) {
        if (p.required && (params[p.name] === undefined || params[p.name] === '')) {
          message.warning(`参数 ${p.name} 为必填`);
          return;
        }
      }
    }
    const req = buildRequest();
    setLoading(true);
    setResponse(null);
    const start = Date.now();
    try {
      const res = await callJsonRpc(endpoint, req);
      setDuration(Date.now() - start);
      setResponse(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          <ThunderboltOutlined /> MCP 调试器
        </Typography.Title>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card title="工具" size="small">
            {tools.length === 0 ? (
              <Spin />
            ) : (
              <div style={{ maxHeight: 600, overflow: 'auto' }}>
                {tools.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setToolId(t.id);
                      setParams({});
                      setMethod('tools/call');
                    }}
                    style={{
                      padding: 8,
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: toolId === t.id ? '#e6f4ff' : 'transparent',
                      marginBottom: 4,
                    }}
                  >
                    <Typography.Text strong>{t.name}</Typography.Text>
                    <div>
                      <Tag color="blue">{t.category}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        <CodeOutlined /> {t.code}
                      </Typography.Text>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col span={16}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card title="请求配置">
              <Space wrap>
                <Select
                  value={method}
                  onChange={setMethod}
                  style={{ width: 200 }}
                  options={[
                    { label: 'tools/call', value: 'tools/call' },
                    { label: 'tools/list', value: 'tools/list' },
                    { label: 'resources/list', value: 'resources/list' },
                    { label: 'resources/read', value: 'resources/read' },
                    { label: 'prompts/list', value: 'prompts/list' },
                    { label: 'initialize', value: 'initialize' },
                  ]}
                />
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="JSON-RPC 端点"
                  style={{ width: 320 }}
                />
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleExecute}
                  loading={loading}
                >
                  执行
                </Button>
              </Space>
            </Card>

            {method === 'tools/call' && tool && (
              <ParameterForm tool={tool} value={params} onChange={setParams} />
            )}
            {method === 'tools/call' && !tool && (
              <Empty description="请先选择工具" />
            )}
            {(method !== 'tools/call' || tool) && (
              <ResponseViewer response={response} loading={loading} durationMs={duration} />
            )}
          </Space>
        </Col>
      </Row>
    </div>
  );
}
