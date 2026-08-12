import { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Input, Select, Tag, Toast, Popconfirm, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listApplications, createApplication, updateApplication, deleteApplication } from '@/api/arch/applications';
import { listCapabilities } from '@/api/arch/capabilities';
import DependencyGraph from './components/DependencyGraph';
import type { ArchApplication, ArchAppCreateRequest, Capability } from '@/api/arch/types';
import { SectionCard, FormModal } from '@mate/shared';

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '运行中' },
  deprecated: { color: 'grey', label: '已废弃' },
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
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (editing) {
        await updateApplication(editing.appId, values);
        Toast.success('更新成功');
      } else {
        await createApplication(values);
        Toast.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.reset();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (app: ArchApplication) => {
    await deleteApplication(app.appId);
    Toast.success('删除成功');
    load();
  };

  const columns = [
    { title: '应用名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '技术栈', dataIndex: 'technologyStack', key: 'technologyStack' },
    { title: '负责人', dataIndex: 'owner', key: 'owner' },
    { title: '关联能力', key: 'caps', render: (_: unknown, r: ArchApplication) => (r.capabilityIds ?? []).map((id) => <Tag key={id} color="blue">{caps.find((c) => c.capabilityId === id)?.name || id}</Tag>) },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ArchApplication) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setValues(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}><Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* V12-08: 使用 SectionCard 替代裸 Card，统一各 APP 的卡片视觉风格。 */}
      <SectionCard
        title="应用系统管理"
        extra={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>注册应用</Button>}
        bodyPadding={0}
      >
        <Table rowKey="appId" columns={columns} dataSource={apps ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
      </SectionCard>
      <SectionCard title="依赖拓扑图" style={{ marginTop: 16 }}>
        {apps.length > 0 ? <DependencyGraph applications={apps} /> : <Typography.Text type="tertiary">暂无应用数据</Typography.Text>}
      </SectionCard>

      {/* V12-08: 使用 FormModal 替代裸 Modal + Form，统一提交逻辑与按钮 loading。 */}
      <FormModal
        open={modalOpen}
        title={editing ? '编辑应用' : '注册应用'}
        form={form}
        onSubmit={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}
        submitting={submitting}
      >
        <Form form={form}>
          <Form.Input field="name" label="应用名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Input field="technologyStack" label="技术栈" />
          <Form.Input field="owner" label="负责人" />
          <Form.Select field="capabilityIds" label="关联能力" multiple placeholder="选择关联的业务能力" optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))} />
          <Form.Select field="dependencyAppIds" label="依赖应用" multiple placeholder="选择依赖的应用" optionList={apps.filter((a) => a.appId !== editing?.appId).map((a) => ({ value: a.appId, label: a.name }))} />
          <Form.Select field="status" label="状态" initValue="active" optionList={[{ value: 'active', label: '运行中' }, { value: 'planned', label: '规划中' }, { value: 'deprecated', label: '已废弃' }]} />
        </Form>
      </FormModal>
    </div>
  );
}
