import { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, InputNumber } from 'antd';
import type { McpServer, McpServerCreateRequest } from '@/types';

interface ServerFormProps {
  open: boolean;
  initial?: McpServer | null;
  availableTools: Array<{ id: string; name: string }>;
  onOk: (values: McpServerCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

export default function ServerForm({
  open,
  initial,
  availableTools,
  onOk,
  onCancel,
  confirmLoading,
}: ServerFormProps) {
  const [form] = Form.useForm<McpServerCreateRequest>();
  const authType = Form.useWatch('authType', form);

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue({
          name: initial.name,
          code: initial.code,
          description: initial.description,
          transport: initial.transport,
          endpoint: initial.endpoint,
          host: initial.host,
          port: initial.port,
          sseEndpoint: initial.sseEndpoint,
          authType: initial.authType ?? 'none',
          authConfig: initial.authConfig,
          timeoutMs: initial.timeoutMs,
          maxConcurrentCalls: initial.maxConcurrentCalls,
          healthCheckUrl: initial.healthCheckUrl,
          toolIds: initial.toolIds,
          enabled: initial.enabled,
          tags: initial.tags,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          enabled: true,
          transport: 'sse',
          authType: 'none',
          toolIds: [],
          timeoutMs: 30000,
          maxConcurrentCalls: 100,
        });
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
  };

  return (
    <Modal
      open={open}
      title={initial ? '编辑 MCP Server' : '创建 MCP Server'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      destroyOnClose
      width={720}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="code"
          label="编码"
          rules={[{ required: true }, { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母数字下划线' }]}
        >
          <Input disabled={!!initial} />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="transport" label="传输方式" rules={[{ required: true }]}>
          <Select
            options={[
              { label: 'stdio', value: 'stdio' },
              { label: 'SSE', value: 'sse' },
              { label: 'HTTP', value: 'http' },
            ]}
          />
        </Form.Item>
        <Form.Item name="endpoint" label="访问端点" rules={[{ required: true }]}>
          <Input placeholder="例如：/mcp/sse/main" />
        </Form.Item>
        <Form.Item name="host" label="监听地址">
          <Input placeholder="例如：0.0.0.0 或 127.0.0.1" />
        </Form.Item>
        <Form.Item name="port" label="监听端口">
          <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="例如：8080" />
        </Form.Item>
        <Form.Item name="sseEndpoint" label="SSE 端点">
          <Input placeholder="例如：/sse" />
        </Form.Item>
        <Form.Item name="authType" label="认证方式">
          <Select
            options={[
              { label: '无', value: 'none' },
              { label: 'API Key', value: 'apikey' },
              { label: 'OAuth2', value: 'oauth2' },
            ]}
          />
        </Form.Item>
        {authType && authType !== 'none' && (
          <Form.Item name="authConfig" label="认证配置（JSON）">
            <Input.TextArea rows={3} placeholder='例如：{ "apiKey": "xxx" }' />
          </Form.Item>
        )}
        <Form.Item name="timeoutMs" label="超时时间（ms）">
          <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：30000" />
        </Form.Item>
        <Form.Item name="maxConcurrentCalls" label="最大并发调用数">
          <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：100" />
        </Form.Item>
        <Form.Item name="healthCheckUrl" label="健康检查 URL">
          <Input placeholder="例如：http://localhost:8080/health" />
        </Form.Item>
        <Form.Item name="toolIds" label="暴露的工具">
          <Select
            mode="multiple"
            placeholder="选择工具"
            options={availableTools.map((t) => ({ label: t.name, value: t.id }))}
          />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Select mode="tags" placeholder="输入后回车" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
