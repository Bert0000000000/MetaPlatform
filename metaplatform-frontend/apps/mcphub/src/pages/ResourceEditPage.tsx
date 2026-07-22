import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Input, Select, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import { createResource, getResource, updateResource } from '@/api/resources';
import ContentPreview from '@/components/ContentPreview';
import type { McpResource, McpResourceCreateRequest } from '@/types';

const MIME_OPTIONS = [
  { label: 'text/plain', value: 'text/plain' },
  { label: 'text/markdown', value: 'text/markdown' },
  { label: 'application/json', value: 'application/json' },
  { label: 'image/png', value: 'image/png' },
  { label: 'image/jpeg', value: 'image/jpeg' },
  { label: 'application/pdf', value: 'application/pdf' },
];

export default function ResourceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<McpResourceCreateRequest>();
  const [resource, setResource] = useState<McpResource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (id) {
      getResource(id).then((r) => {
        setResource(r);
        form.setFieldsValue({
          uri: r.uri,
          name: r.name,
          mimeType: r.mimeType,
          description: r.description,
          content: r.content,
          tags: r.tags,
        });
        setPreviewMode(true);
      });
    }
  }, [id, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (id) {
        await updateResource(id, values);
        message.success('已更新');
      } else {
        await createResource(values);
        message.success('已创建');
      }
      navigate('/resources');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resources')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {id ? `编辑资源：${resource?.name ?? ''}` : '添加资源'}
        </Typography.Title>
        <Button
          icon={<EyeOutlined />}
          onClick={() => setPreviewMode(!previewMode)}
          type={previewMode ? 'primary' : 'default'}
        >
          {previewMode ? '编辑模式' : '预览'}
        </Button>
      </Space>

      {previewMode && resource ? (
        <ContentPreview resource={resource} />
      ) : (
        <Card>
          <Form form={form} layout="vertical" style={{ maxWidth: 800 }}>
            <Form.Item
              name="uri"
              label="资源 URI"
              rules={[{ required: true }, { pattern: /^[a-z][a-z0-9_:\-/]*$/, message: '小写 URI' }]}
            >
              <Input placeholder="docs://handbook/index.md" disabled={!!id} />
            </Form.Item>
            <Form.Item name="name" label="资源名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="mimeType" label="MIME 类型" rules={[{ required: true }]}>
              <Select options={MIME_OPTIONS} />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="content" label="内容" rules={[{ required: true }]}>
              <Input.TextArea rows={12} placeholder="文本/Markdown/JSON 字符串" />
            </Form.Item>
            <Form.Item name="tags" label="标签">
              <Select mode="tags" placeholder="输入后回车" />
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
      )}
    </div>
  );
}
