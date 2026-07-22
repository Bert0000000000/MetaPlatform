import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, ApiOutlined } from '@ant-design/icons';
import { createClient, getClient, testConnection, updateClient } from '@/api/clients';
import type { McpClient, McpClientCreateRequest } from '@/types';

const CLIENT_TYPE_OPTIONS = [
  { label: 'Cursor', value: 'cursor' },
  { label: 'Claude Desktop', value: 'claude-desktop' },
  { label: 'GitHub Copilot', value: 'copilot' },
  { label: 'Cline', value: 'cline' },
  { label: 'Windsurf', value: 'windsurf' },
  { label: '自定义', value: 'custom' },
];

const TRANSPORT_OPTIONS = [
  { label: 'HTTP', value: 'HTTP' },
  { label: 'SSE', value: 'SSE' },
  { label: 'STDIO', value: 'STDIO' },
];

const AUTH_OPTIONS = [
  { label: '无认证', value: 'none' },
  { label: 'API Key', value: 'apikey' },
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'OAuth 2.0', value: 'oauth2' },
];

export default function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<McpClientCreateRequest>();
  const [client, setClient] = useState<McpClient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (id) {
      getClient(id).then((c) => {
        setClient(c);
        form.setFieldsValue({
          name: c.name,
          endpoint: c.endpoint,
          clientType: c.clientType || 'custom',
          transportType: c.transportType || 'HTTP',
          authType: c.authType || 'none',
          apiKey: c.apiKey,
          timeoutMs: c.timeoutMs,
          headers: c.headers,
          serverIds: c.serverIds,
          config: c.config,
        });
      });
    } else {
      form.setFieldsValue({ authType: 'none', clientType: 'custom', transportType: 'HTTP' });
    }
  }, [id, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (id) {
        await updateClient(id, values);
        message.success('已更新');
      } else {
        await createClient(values);
        message.success('已创建');
      }
      navigate('/clients');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!id) {
      message.warning('请先保存 Client');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const updated = await testConnection(id);
      const ok = updated.status.toLowerCase() === 'connected';
      setTestResult({ ok, message: ok ? '连接成功' : '连接失败' });
      message.success(ok ? '连接成功' : '连接失败');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '连接失败';
      setTestResult({ ok: false, message: msg });
      message.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {id ? `编辑 Client：${client?.name ?? ''}` : '添加 MCP Client'}
        </Typography.Title>
      </Space>

      <Card>
        <Form form={form} layout="vertical" style={{ maxWidth: 640 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="例如：cursor-ide" />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="MCP 端点 URL"
            rules={[{ required: true, type: 'url', message: '请输入合法的 URL' }]}
          >
            <Input placeholder="https://example.com/mcp/sse" />
          </Form.Item>
          <Form.Item name="clientType" label="Client 类型" rules={[{ required: true }]}>
            <Select options={CLIENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="transportType" label="传输协议" rules={[{ required: true }]}>
            <Select options={TRANSPORT_OPTIONS} />
          </Form.Item>
          <Form.Item name="authType" label="认证方式" rules={[{ required: true }]}>
            <Select options={AUTH_OPTIONS} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.authType !== next.authType}
          >
            {({ getFieldValue }) =>
              getFieldValue('authType') !== 'none' ? (
                <Form.Item
                  name="apiKey"
                  label="API Key / Token"
                  rules={[{ required: true, message: '请输入认证凭证' }]}
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="timeoutMs" label="超时（ms）">
            <InputNumber min={1000} max={300000} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="headers"
            label="自定义 Headers（JSON）"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入合法 JSON'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={3} placeholder='{"X-Custom":"value"}' />
          </Form.Item>
          <Form.Item
            name="serverIds"
            label="关联 Server IDs（JSON 数组）"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    const parsed = JSON.parse(value);
                    if (!Array.isArray(parsed)) throw new Error('必须是数组');
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入合法 JSON 数组'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={2} placeholder='["550e8400-e29b-41d4-a716-446655440000"]' />
          </Form.Item>
          <Form.Item
            name="config"
            label="扩展配置（JSON）"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('请输入合法 JSON'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={3} placeholder='{}' />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={submitting}
                onClick={handleSubmit}
              >
                保存
              </Button>
              {id && (
                <Button
                  icon={<ApiOutlined />}
                  loading={testing}
                  onClick={handleTest}
                  style={
                    testResult
                      ? {
                          borderColor: testResult.ok ? '#52c41a' : '#ff4d4f',
                          color: testResult.ok ? '#52c41a' : '#ff4d4f',
                        }
                      : undefined
                  }
                >
                  {testing ? '测试中' : testResult ? testResult.message : '测试连接'}
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
