import { useEffect, useState } from 'react';
import { Form, Modal } from '@douyinfe/semi-ui';
import type { McpServer, McpServerCreateRequest } from '@/api/mcphub/types';

interface ServerFormProps {
  open: boolean;
  initial?: McpServer | null;
  availableTools: Array<{ id: string; name: string }>;
  onOk: (values: McpServerCreateRequest) => void;
  onCancel: () => void;
  confirmLoading?: boolean;
}

const TRANSPORT_OPTIONS = [
  { label: 'stdio', value: 'stdio' },
  { label: 'SSE', value: 'sse' },
  { label: 'HTTP', value: 'http' },
];

const AUTH_TYPE_OPTIONS = [
  { label: '无', value: 'none' },
  { label: 'API Key', value: 'apikey' },
  { label: 'OAuth2', value: 'oauth2' },
];

export default function ServerForm({
  open,
  initial,
  availableTools,
  onOk,
  onCancel,
  confirmLoading,
}: ServerFormProps) {
  const [form] = Form.useForm<McpServerCreateRequest>();
  const [authType, setAuthType] = useState<string>('none');

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setValues({
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
        setAuthType(initial.authType ?? 'none');
      } else {
        form.reset();
        form.setValues({
          enabled: true,
          transport: 'sse',
          authType: 'none',
          toolIds: [],
          timeoutMs: 30000,
          maxConcurrentCalls: 100,
        });
        setAuthType('none');
      }
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validate();
    onOk(values);
  };

  return (
    <Modal
      visible={open}
      title={initial ? '编辑 MCP Server' : '创建 MCP Server'}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      width={720}
    >
      <Form form={form}>
        <Form.Input field="name" label="名称" rules={[{ required: true }]} />
        <Form.Input
          field="code"
          label="编码"
          rules={[{ required: true }, { pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '字母数字下划线' }]}
          disabled={!!initial}
        />
        <Form.TextArea field="description" label="描述" rows={2} />
        <Form.Select
          field="transport"
          label="传输方式"
          rules={[{ required: true }]}
          optionList={TRANSPORT_OPTIONS}
        />
        <Form.Input field="endpoint" label="访问端点" rules={[{ required: true }]} placeholder="例如：/mcp/sse/main" />
        <Form.Input field="host" label="监听地址" placeholder="例如：0.0.0.0 或 127.0.0.1" />
        <Form.InputNumber field="port" label="监听端口" min={1} max={65535} style={{ width: '100%' }} placeholder="例如：8080" />
        <Form.Input field="sseEndpoint" label="SSE 端点" placeholder="例如：/sse" />
        <Form.Select
          field="authType"
          label="认证方式"
          optionList={AUTH_TYPE_OPTIONS}
          onChange={(v) => setAuthType(v as string)}
        />
        {authType && authType !== 'none' && (
          <Form.TextArea
            field="authConfig"
            label="认证配置（JSON）"
            rows={3}
            placeholder='例如：{ "apiKey": "xxx" }'
          />
        )}
        <Form.InputNumber field="timeoutMs" label="超时时间（ms）" min={1} style={{ width: '100%' }} placeholder="例如：30000" />
        <Form.InputNumber field="maxConcurrentCalls" label="最大并发调用数" min={1} style={{ width: '100%' }} placeholder="例如：100" />
        <Form.Input field="healthCheckUrl" label="健康检查 URL" placeholder="例如：http://localhost:8080/health" />
        <Form.Select
          field="toolIds"
          label="暴露的工具"
          multiple
          placeholder="选择工具"
          optionList={availableTools.map((t) => ({ label: t.name, value: t.id }))}
        />
        <Form.Switch field="enabled" label="启用" />
        <Form.Select
          field="tags"
          label="标签"
          multiple
          placeholder="输入后回车"
          optionList={[]}
        />
      </Form>
    </Modal>
  );
}
