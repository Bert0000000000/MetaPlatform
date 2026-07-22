import { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Input, Select, Tag, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listApplications, createApplication, updateApplication, deleteApplication } from '@/api/applications';
import { listCapabilities } from '@/api/capabilities';
import DependencyGraph from '@/components/DependencyGraph';
import type { ArchApplication, ArchAppCreateRequest, Capability } from '@/types';
import { SectionCard, FormModal } from '@mate/shared';

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '运行中' },
  deprecated: { color: 'default', label: '已废弃' },
  planned: { color: 'blue', label: '规划中' },
};

export default function ApplicationManagementPage() {
  const [apps, setApps] = useState<ArchApplication[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ArchApplication | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ArchAppCreateRequest>();

  const load = async () => {
    setLoading(true);
    try {
      const [res, capRes] = await Promise.all([listApplications(), listCapabilities()]);
      setApps(res.items);
      setCaps(capRes.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await updateApplication(editing.appId, values);
        message.success('更新成功');
      } else {
        await createApplication(values);
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

  const handleDelete = async (app: ArchApplication) => {
    await deleteApplication(app.appId);
    message.success('删除成功');
    load();
  };

  const columns = [
    { title: '应用名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '技术栈', dataIndex: 'technologyStack', key: 'technologyStack' },
    { title: '负责人', dataIndex: 'owner', key: 'owner' },
    { title: '关联能力', key: 'caps', render: (_: unknown, r: ArchApplication) => r.capabilityIds.map((id) => <Tag key={id} color="blue">{caps.find((c) => c.capabilityId === id)?.name || id}</Tag>) },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ArchApplication) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* V12-08: 使用 SectionCard 替代裸 Card，统一各 APP 的卡片视觉风格。 */}
      <SectionCard
        title="应用系统管理"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>注册应用</Button>}
        bodyPadding={0}
      >
        <Table rowKey="appId" columns={columns} dataSource={apps} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
      </SectionCard>
      <SectionCard title="依赖拓扑图" style={{ marginTop: 16 }}>
        {apps.length > 0 ? <DependencyGraph applications={apps} /> : <Typography.Text type="secondary">暂无应用数据</Typography.Text>}
      </SectionCard>

      {/* V12-08: 使用 FormModal 替代裸 Modal + Form，统一提交逻辑与按钮 loading。 */}
      <FormModal
        open={modalOpen}
        title={editing ? '编辑应用' : '注册应用'}
        form={form}
        onSubmit={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        submitting={submitting}
      >
        <Form.Item name="name" label="应用名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="technologyStack" label="技术栈"><Input /></Form.Item>
        <Form.Item name="owner" label="负责人"><Input /></Form.Item>
        <Form.Item name="capabilityIds" label="关联能力">
          <Select mode="multiple" placeholder="选择关联的业务能力">
            {caps.map((c) => <Select.Option key={c.capabilityId} value={c.capabilityId}>{c.name}</Select.Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="dependencyAppIds" label="依赖应用">
          <Select mode="multiple" placeholder="选择依赖的应用">
            {apps.filter((a) => a.appId !== editing?.appId).map((a) => <Select.Option key={a.appId} value={a.appId}>{a.name}</Select.Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态" initialValue="active">
          <Select><Select.Option value="active">运行中</Select.Option><Select.Option value="planned">规划中</Select.Option><Select.Option value="deprecated">已废弃</Select.Option></Select>
        </Form.Item>
      </FormModal>
    </div>
  );
}
