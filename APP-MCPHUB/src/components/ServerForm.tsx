import { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch } from 'antd';
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

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue({
          name: initial.name,
          code: initial.code,
          description: initial.description,
          transport: initial.transport,
          endpoint: initial.endpoint,
          toolIds: initial.toolIds,
          enabled: initial.enabled,
          tags: initial.tags,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ enabled: true, transport: 'sse', toolIds: [] });
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
      width={640}
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
