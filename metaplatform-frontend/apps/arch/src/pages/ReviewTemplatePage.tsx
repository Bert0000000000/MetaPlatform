import { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Input, Tag, message, Popconfirm, List, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  listReviewTemplates,
  createReviewTemplate,
  updateReviewTemplate,
  deleteReviewTemplate,
} from '@/api/governance';
import type { ReviewTemplate, ReviewDimension, ReviewExpert } from '@/types';
import { SectionCard, FormModal } from '@mate/shared';

export default function ReviewTemplatePage() {
  const [list, setList] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<Partial<ReviewTemplate>>();

  const load = async () => {
    setLoading(true);
    try { setList(await listReviewTemplates()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const parseLines = (value: unknown): string[] => {
    if (typeof value !== 'string') return [];
    return value.split('\n').map((s) => s.trim()).filter(Boolean);
  };

  const buildDimensions = (text: string): ReviewDimension[] =>
    parseLines(text).map((name) => ({ name, weight: 0, maxScore: 100 }));

  const buildExperts = (text: string): ReviewExpert[] =>
    parseLines(text).map((line) => {
      const parts = line.split(',').map((s) => s.trim());
      return { userId: parts[0] || line, name: parts[1] || parts[0] || line, role: parts[2] };
    });

  const dimensionsToText = (dimensions: ReviewDimension[] | undefined): string =>
    (dimensions || []).map((d) => d.name).join('\n');

  const expertsToText = (experts: ReviewExpert[] | undefined): string =>
    (experts || []).map((e) => `${e.userId},${e.name}${e.role ? `,${e.role}` : ''}`).join('\n');

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: Partial<ReviewTemplate> = {
      ...values,
      dimensions: buildDimensions(values.dimensions as unknown as string),
      experts: buildExperts(values.experts as unknown as string),
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updateReviewTemplate(editing.id, payload);
        message.success('更新成功');
      } else {
        await createReviewTemplate(payload);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '评审维度',
      key: 'dimensions',
      render: (_: unknown, r: ReviewTemplate) => (
        <List
          size="small"
          dataSource={r.dimensions || []}
          renderItem={(d) => (
            <List.Item>
              <Typography.Text>{d.name}</Typography.Text>
              {d.weight ? <Tag color="blue" style={{ marginLeft: 8 }}>权重 {d.weight}</Tag> : null}
            </List.Item>
          )}
        />
      ),
    },
    {
      title: '专家组',
      key: 'experts',
      render: (_: unknown, r: ReviewTemplate) => (
        <List
          size="small"
          dataSource={r.experts || []}
          renderItem={(e) => (
            <List.Item>
              <Typography.Text>{e.name}</Typography.Text>
              {e.role ? <Tag style={{ marginLeft: 8 }}>{e.role}</Tag> : null}
            </List.Item>
          )}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: ReviewTemplate) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({
                ...r,
                dimensions: dimensionsToText(r.dimensions),
                experts: expertsToText(r.experts),
              } as unknown as Partial<ReviewTemplate>);
              setModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={async () => { await deleteReviewTemplate(r.id); message.success('已删除'); load(); }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <SectionCard
      title="评审模板与专家组"
      extra={(
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新增模板
        </Button>
      )}
      bodyPadding={0}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="small" scroll={{ x: 'max-content' }} />

      <FormModal
        open={modalOpen}
        title={editing ? '编辑评审模板' : '新增评审模板'}
        form={form}
        onSubmit={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        submitting={submitting}
        width={640}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="dimensions" label="评审维度（每行一个维度）">
          <Input.TextArea rows={4} placeholder={'可扩展性\n可维护性\n安全性'} />
        </Form.Item>
        <Form.Item name="experts" label="专家组（每行：userId,姓名,角色）">
          <Input.TextArea rows={4} placeholder={'arch-1,张三,架构师\nsecurity-1,李四,安全专家'} />
        </Form.Item>
      </FormModal>
    </SectionCard>
  );
}
