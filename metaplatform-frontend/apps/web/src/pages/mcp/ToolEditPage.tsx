import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Space, Typography, Toast } from '@douyinfe/semi-ui';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { createTool, getTool, listCategories, updateTool } from '@/api/mcphub/tools';
import type { McpTool, McpToolCreateRequest } from '@/api/mcphub/types';

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
        form.setValues({
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
      form.setValues({ enabled: true, outputType: 'json', inputSchema: [] });
    }
  }, [id, form]);

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (id) {
        await updateTool(id, values);
        Toast.success('已更新');
      } else {
        await createTool(values);
        Toast.success('已创建');
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
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {id ? `编辑工具：${tool?.name ?? ''}` : '创建工具'}
        </Typography.Title>
      </Space>

      <Card>
        <Form form={form} style={{ maxWidth: 720 }}>
          <Form.Input
            field="name"
            label="工具名称"
            rules={[{ required: true }]}
            placeholder="例如：查询员工数据库"
          />
          <Form.Input
            field="code"
            label="工具编码"
            rules={[
              { required: true },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '只能小写字母、数字、下划线' },
            ]}
            placeholder="query_employees"
            disabled={!!id}
          />
          <Form.Select
            field="category"
            label="分类"
            rules={[{ required: true }]}
            multiple
            maxTagCount={1}
            optionList={categories.map((c) => ({ label: c, value: c }))}
            placeholder="选择或新建分类"
          />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select
            field="outputType"
            label="输出类型"
            optionList={[
              { label: '文本', value: 'text' },
              { label: 'JSON', value: 'json' },
              { label: '表格', value: 'table' },
              { label: '文件', value: 'file' },
            ]}
          />
          <Form.Switch field="enabled" label="启用" />
          <Form.Select field="tags" label="标签" multiple optionList={[]} placeholder="输入后回车" />
          <Button
            theme="solid"
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            onClick={handleSubmit}
          >
            保存
          </Button>
        </Form>
      </Card>
    </div>
  );
}
