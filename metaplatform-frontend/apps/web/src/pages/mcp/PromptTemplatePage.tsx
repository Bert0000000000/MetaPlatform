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
  Toast,
  Popconfirm,
  Form,
  withField,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  AppstoreOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { listPrompts, createPrompt, updatePrompt, deletePrompt } from '@/api/mcphub/prompts';
import VariableEditor from './components/VariableEditor';
import PreviewPanel from './components/PreviewPanel';
import type { PromptTemplate, PromptTemplateCreateRequest } from '@/api/mcphub/types';

const FormVariableEditor = withField(
  VariableEditor as React.ComponentType<Partial<React.ComponentProps<typeof VariableEditor>>>
);

export default function PromptTemplatePage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
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
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (editing) {
        await updatePrompt(editing.id, values);
        Toast.success('已更新');
      } else {
        await createPrompt(values);
        Toast.success('已创建');
      }
      setFormOpen(false);
      setEditing(null);
      form.reset();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<PromptTemplate>[] = [
    {
      title: 'Prompt',
      key: 'name',
      render: (_, p) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>
            <AppstoreOutlined /> {p.name}
          </Typography.Text>
          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
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
          <Button theme="borderless" icon={<EyeOutlined />} onClick={() => setPreviewPrompt(p)}>
            预览
          </Button>
          <Button
            theme="borderless"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(p);
              form.setValues(p);
              setFormOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={async () => {
              await deletePrompt(p.id);
              Toast.success('已删除');
              load();
            }}
          >
            <Button theme="borderless" type="danger" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          Prompt 模板
        </Typography.Title>
        <Button
          theme="solid"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.reset();
            setFormOpen(true);
          }}
        >
          创建模板
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索名称/分类"
          showClear
          value={query}
          onChange={(v) => setQuery(v)}
          onEnterPress={() => setKeyword(query)}
          suffix={<SearchOutlined style={{ color: 'var(--muted-foreground)', cursor: 'pointer' }} onClick={() => setKeyword(query)} />}
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
            pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        visible={formOpen}
        title={editing ? '编辑 Prompt' : '创建 Prompt'}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        width={760}
        confirmLoading={submitting}
      >
        <Form form={form}>
          <Form.Input field="name" label="模板名称" rules={[{ required: true }]} />
          <Form.Input field="category" label="分类" rules={[{ required: true }]} placeholder="如：财务、HR、客服" />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select
            field="role"
            label="角色"
            rules={[{ required: true }]}
            optionList={[
              { label: 'System', value: 'system' },
              { label: 'User', value: 'user' },
              { label: 'Assistant', value: 'assistant' },
            ]}
          />
          <Form.TextArea
            field="template"
            label="模板内容"
            rules={[{ required: true }]}
            rows={6}
            placeholder="你是一个...请基于 {{name}} 的数据..."
            extraText="使用 {{varName}} 引用变量"
          />
          <FormVariableEditor field="variables" label="变量定义" initValue={[]} />
          <Form.TagInput field="tags" label="标签" placeholder="输入后回车" />
        </Form>
      </Modal>

      <Modal
        visible={!!previewPrompt}
        title={`预览：${previewPrompt?.name ?? ''}`}
        onCancel={() => setPreviewPrompt(null)}
        footer={<Button onClick={() => setPreviewPrompt(null)}>关闭</Button>}
        width={760}
      >
        {previewPrompt && (
          <Tabs>
            <Tabs.TabPane itemKey="preview" tab="渲染预览">
              <PreviewPanel template={previewPrompt} />
            </Tabs.TabPane>
            <Tabs.TabPane itemKey="raw" tab="原始模板">
              <pre
                style={{
                  background: 'var(--muted)',
                  padding: 12,
                  borderRadius: 4,
                  fontFamily: 'Menlo, Consolas, monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {previewPrompt.template}
              </pre>
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  );
}
