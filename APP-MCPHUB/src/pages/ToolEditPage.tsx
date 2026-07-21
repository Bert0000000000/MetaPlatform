import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Input, Select, Switch, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { createTool, getTool, listCategories, updateTool } from '@/api/tools';
import type { McpTool, McpToolCreateRequest } from '@/types';

export default function ToolEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<McpToolCreateRequest>();
  const [tool, setTool] = useState<McpTool | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listCategories().then((cs) => setCategories(cs.map((c) => c.name)));
    if (id) {
      getTool(id).then((t) => {
        setTool(t);
        form.setFieldsValue({
          name: t.name,
          code: t.code,
          category: t.category,
          description: t.description,
          outputType: t.outputType,
          enabled: t.enabled,
          tags: t.tags,
          inputSchema: t.inputSchema,
        });
      });
    } else {
      form.setFieldsValue({ enabled: true, outputType: 'json', inputSchema: [] });
    }
  }, [id, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (id) {
        await updateTool(id, values);
        message.success('已更新');
      } else {
        await createTool(values);
        message.success('已创建');
      }
      navigate('/tools');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tools')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {id ? `编辑工具：${tool?.name ?? ''}` : '创建工具'}
        </Typography.Title>
      </Space>

      <Card>
        <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
          <Form.Item name="name" label="工具名称" rules={[{ required: true }]}>
            <Input placeholder="例如：查询员工数据库" />
          </Form.Item>
          <Form.Item
            name="code"
            label="工具编码"
            rules={[
              { required: true },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '只能小写字母、数字、下划线' },
            ]}
          >
            <Input placeholder="query_employees" disabled={!!id} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select
              mode="tags"
              maxCount={1}
              options={categories.map((c) => ({ label: c, value: c }))}
              placeholder="选择或新建分类"
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="outputType" label="输出类型">
            <Select
              options={[
                { label: '文本', value: 'text' },
                { label: 'JSON', value: 'json' },
                { label: '表格', value: 'table' },
                { label: '文件', value: 'file' },
              ]}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
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
    </div>
  );
}
