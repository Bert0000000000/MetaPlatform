import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
  Toast,
  Popconfirm,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { createTemplate, listTemplates } from '@/api/superai/templates';
import type { ScheduleTemplate } from '@/api/superai/schedule';

export default function TaskTemplatePage() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await listTemplates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    const v = await form.validate();
    setSubmitting(true);
    try {
      await createTemplate({
        name: v.name,
        description: v.description,
        intentPattern: v.intentPattern,
        plan: {
          planId: 'plan',
          intentId: 'intent',
          steps: [],
          totalEstimatedDuration: 0,
          createdAt: new Date().toISOString(),
        },
        createdBy: 'admin',
      });
      Toast.success('已创建');
      setEditorOpen(false);
      form.reset();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnProps<ScheduleTemplate>[] = [
    {
      title: '模板',
      key: 'name',
      render: (_, t) => (
        <Space vertical spacing={0}>
          <Typography.Text strong>{t.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.description}</Typography.Text>
        </Space>
      ),
    },
    { title: '意图模式', dataIndex: 'intentPattern', render: (v) => <code>{v}</code> },
    {
      title: '创建',
      dataIndex: 'createdAt',
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, _t) => (
        <Space>
          <Button theme="borderless" icon={<EditOutlined />}>编辑</Button>
          <Popconfirm title="确定删除？">
            <Button theme="borderless" type="danger" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="v-page-header">
        <Typography.Title heading={4} style={{ margin: 0 }}>
          任务模板
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setEditorOpen(true)}>
          创建模板
        </Button>
      </div>

      <Card>
        {templates.length === 0 && !loading ? (
          <Empty description="还没有模板" />
        ) : (
          <Table rowKey="templateId" dataSource={templates} columns={columns} loading={loading} scroll={{ x: 'max-content' }} />
        )}
      </Card>

      <Modal
        visible={editorOpen}
        title="创建任务模板"
        onCancel={() => setEditorOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
      >
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Input field="intentPattern" label="意图模式" extraText="示例：每周一上午汇总销售数据" />
        </Form>
      </Modal>
    </div>
  );
}
