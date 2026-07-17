import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Popconfirm,
  Form,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { listPrompts, createPrompt, updatePrompt, deletePrompt } from '@/api/prompts';
import VariableEditor from '@/components/VariableEditor';
import PreviewPanel from '@/components/PreviewPanel';
import type { PromptTemplate, PromptTemplateCreateRequest } from '@/types';

export default function PromptTemplatePage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState<PromptTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PromptTemplateCreateRequest>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listPrompts({ keyword });
      setPrompts(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await updatePrompt(editing.id, values);
        message.success('已更新');
      } else {
        await createPrompt(values);
        message.success('已创建');
      }
      setFormOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<PromptTemplate> = [
    {
      title: 'Prompt',
      key: 'name',
      render: (_, p) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            <AppstoreOutlined /> {p.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {p.description}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '分类', dataIndex: 'category', render: (v) => <Tag>{v}</Tag> },
    { title: '角色', dataIndex: 'role', render: (v) => <Tag color="blue">{v}</Tag> },
    {
      title: '变量',
      key: 'variables',
      render: (_, p) => <Tag color="purple">{p.variables.length} 个</Tag>,
    },
    {
      title: '更新时间',
      key: 'updated',
      render: (_, p) => (p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, p) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => setPreviewPrompt(p)}>
            预览
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(p);
              form.setFieldsValue(p);
              setFormOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deletePrompt(p.id);
              message.success('已删除');
              load();
            }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mcphub-page-header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Prompt 模板
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setFormOpen(true);
          }}
        >
          创建模板
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索名称/分类"
          allowClear
          onSearch={setKeyword}
          style={{ width: 240 }}
        />
      </Space>

      <Card>
        {prompts.length === 0 && !loading ? (
          <Empty description="还没有 Prompt 模板" />
        ) : (
          <Table
            rowKey="id"
            dataSource={prompts}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        title={editing ? '编辑 Prompt' : '创建 Prompt'}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        width={760}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Input placeholder="如：财务、HR、客服" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'System', value: 'system' },
                { label: 'User', value: 'user' },
                { label: 'Assistant', value: 'assistant' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="template"
            label="模板内容"
            rules={[{ required: true }]}
            extra="使用 {{varName}} 引用变量"
          >
            <Input.TextArea rows={6} placeholder="你是一个...请基于 {{name}} 的数据..." />
          </Form.Item>
          <Form.Item name="variables" label="变量定义">
            <VariableEditor value={[]} onChange={() => {}} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入后回车" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!previewPrompt}
        title={`预览：${previewPrompt?.name ?? ''}`}
        onCancel={() => setPreviewPrompt(null)}
        footer={<Button onClick={() => setPreviewPrompt(null)}>关闭</Button>}
        width={760}
      >
        {previewPrompt && (
          <Tabs
            items={[
              {
                key: 'preview',
                label: '渲染预览',
                children: <PreviewPanel template={previewPrompt} />,
              },
              {
                key: 'raw',
                label: '原始模板',
                children: (
                  <pre
                    style={{
                      background: '#fafafa',
                      padding: 12,
                      borderRadius: 4,
                      fontFamily: 'Menlo, Consolas, monospace',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {previewPrompt.template}
                  </pre>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
