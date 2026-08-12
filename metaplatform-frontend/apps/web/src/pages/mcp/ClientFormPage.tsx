import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { ArrowLeftOutlined, SaveOutlined, ApiOutlined } from '@ant-design/icons';
import { createClient, getClient, testConnection, updateClient } from '@/api/mcphub/clients';
import type { McpClient, McpClientCreateRequest } from '@/api/mcphub/types';

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
        form.setValues({
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
      form.setValues({ authType: 'none', clientType: 'custom', transportType: 'HTTP' });
    }
  }, [id, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (id) {
        await updateClient(id, values);
        Toast.success('已更新');
      } else {
        await createClient(values);
        Toast.success('已创建');
      }
      navigate('/clients');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!id) {
      Toast.warning('请先保存 Client');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const updated = await testConnection(id);
      const ok = updated.status.toLowerCase() === 'connected';
      setTestResult({ ok, message: ok ? '连接成功' : '连接失败' });
      Toast.success(ok ? '连接成功' : '连接失败');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '连接失败';
      setTestResult({ ok: false, message: msg });
      Toast.error(msg);
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
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {id ? `编辑 Client：${client?.name ?? ''}` : '添加 MCP Client'}
        </Typography.Title>
      </Space>

      <Card>
        {/* antd 的 noStyle + shouldUpdate 条件渲染：Semi 无 shouldUpdate，
            Form 的 render prop 接收 FormFCChild（含 values，随表单值变化重渲染），行为等价 */}
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 640 }}
          render={({ values }) => (
            <>
              <Form.Input
                field="name"
                label="名称"
                rules={[{ required: true }]}
                placeholder="例如：cursor-ide"
              />
              <Form.Input
                field="endpoint"
                label="MCP 端点 URL"
                rules={[{ required: true, type: 'url', message: '请输入合法的 URL' }]}
                placeholder="https://example.com/mcp/sse"
              />
              <Form.Select
                field="clientType"
                label="Client 类型"
                rules={[{ required: true }]}
                optionList={CLIENT_TYPE_OPTIONS}
              />
              <Form.Select
                field="transportType"
                label="传输协议"
                rules={[{ required: true }]}
                optionList={TRANSPORT_OPTIONS}
              />
              <Form.Select
                field="authType"
                label="认证方式"
                rules={[{ required: true }]}
                optionList={AUTH_OPTIONS}
              />
              {values.authType !== 'none' ? (
                <Form.Input
                  field="apiKey"
                  label="API Key / Token"
                  rules={[{ required: true, message: '请输入认证凭证' }]}
                  placeholder="sk-..."
                  keepState
                />
              ) : null}
              <Form.InputNumber
                field="timeoutMs"
                label="超时（ms）"
                min={1000}
                max={300000}
                step={1000}
                style={{ width: '100%' }}
              />
              <Form.TextArea
                field="headers"
                label="自定义 Headers（JSON）"
                rows={3}
                placeholder='{"X-Custom":"value"}'
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return true;
                      try {
                        JSON.parse(value);
                        return true;
                      } catch {
                        return new Error('请输入合法 JSON');
                      }
                    },
                  },
                ]}
              />
              <Form.TextArea
                field="serverIds"
                label="关联 Server IDs（JSON 数组）"
                rows={2}
                placeholder='["550e8400-e29b-41d4-a716-446655440000"]'
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return true;
                      try {
                        const parsed = JSON.parse(value);
                        if (!Array.isArray(parsed)) throw new Error('必须是数组');
                        return true;
                      } catch {
                        return new Error('请输入合法 JSON 数组');
                      }
                    },
                  },
                ]}
              />
              <Form.TextArea
                field="config"
                label="扩展配置（JSON）"
                rows={3}
                placeholder="{}"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return true;
                      try {
                        JSON.parse(value);
                        return true;
                      } catch {
                        return new Error('请输入合法 JSON');
                      }
                    },
                  },
                ]}
              />
              <Form.Slot>
                <Space>
                  <Button
                    theme="solid"
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
                              borderColor: testResult.ok ? 'var(--success)' : 'var(--destructive)',
                              color: testResult.ok ? 'var(--success)' : 'var(--destructive)',
                            }
                          : undefined
                      }
                    >
                      {testing ? '测试中' : testResult ? testResult.message : '测试连接'}
                    </Button>
                  )}
                </Space>
              </Form.Slot>
            </>
          )}
        >
        </Form>
      </Card>
    </div>
  );
}
