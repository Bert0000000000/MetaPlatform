import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { createClient, getClient, updateClient } from '@/api/clients';
import type { McpClient, McpClientCreateRequest } from '@/types';

export default function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<McpClientCreateRequest>();
  const [client, setClient] = useState<McpClient | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      getClient(id).then((c) => {
        setClient(c);
        form.setFieldsValue({
          name: c.name,
          endpoint: c.endpoint,
          authType: c.authType,
          apiKey: c.apiKey,
        });
      });
    } else {
      form.setFieldsValue({ authType: 'none' });
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
          <Form.Item name="authType" label="认证方式" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '无认证', value: 'none' },
                { label: 'API Key', value: 'apikey' },
                { label: 'OAuth 2.0', value: 'oauth2' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API Key"
            tooltip="使用 API Key 或 OAuth 认证时必填"
            dependencies={['authType']}
            rules={[
              ({ getFieldValue }) => ({
                required: getFieldValue('authType') !== 'none',
                message: '请输入 API Key',
              }),
            ]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
