import { useEffect, useState } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, Select, Tag, Toast, Popconfirm, SideSheet } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { listStandards, createStandard, updateStandard, deleteStandard } from '@/api/arch/dataArchitecture';
import type { DataStandard } from '@/api/arch/types';

const STANDARD_TYPES = ['format', 'enum', 'rule', 'range', 'regex'];

export default function DataStandardPage() {
  const [standards, setStandards] = useState<DataStandard[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DataStandard | null>(null);
  const [preview, setPreview] = useState<DataStandard | null>(null);
  const [form] = Form.useForm<Partial<DataStandard>>();

  const load = async () => {
    const data = await listStandards();
    setStandards(Array.isArray(data) ? data : ((data as { items?: DataStandard[] }).items ?? []));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setModalOpen(true);
  };

  const openEdit = (record: DataStandard) => {
    setEditing(record);
    form.setValues(record);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editing) {
      await updateStandard(editing.id, values);
      Toast.success('更新成功');
    } else {
      await createStandard(values);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    form.reset();
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteStandard(id);
    Toast.success('已删除');
    load();
  };

  const typeColor: Record<string, TagColor> = { format: 'blue', enum: 'green', rule: 'orange', range: 'purple', regex: 'cyan' };

  const columns = [
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'standardType', key: 'standardType', render: (v: string) => <Tag color={typeColor[v] || 'grey'}>{v}</Tag> },
    { title: '规则', dataIndex: 'rule', key: 'rule', ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: DataStandard) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<EyeOutlined />} onClick={() => setPreview(r)}>预览</Button>
          <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="数据标准管理"
      headerExtraContent={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建标准</Button>}
    >
      <Table rowKey="id" columns={columns} dataSource={standards ?? []} size="small" scroll={{ x: 'max-content' }} />

      <Modal title={editing ? '编辑数据标准' : '新建数据标准'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Select field="standardType" label="类型" rules={[{ required: true }]} optionList={STANDARD_TYPES.map((t) => ({ label: t, value: t }))} />
          <Form.TextArea field="rule" label="规则" rows={3} placeholder="如正则表达式、枚举值、阈值范围等" />
          <Form.TextArea field="description" label="描述" rows={2} />
        </Form>
      </Modal>

      <SideSheet title="规则预览" visible={!!preview} onCancel={() => setPreview(null)}>
        {preview && (
          <Space vertical style={{ width: '100%' }}>
            <div><strong>编码：</strong>{preview.code}</div>
            <div><strong>名称：</strong>{preview.name}</div>
            <div><strong>类型：</strong><Tag color={typeColor[preview.standardType] || 'grey'}>{preview.standardType}</Tag></div>
            <div><strong>规则：</strong></div>
            <pre style={{ background: 'var(--semi-color-fill-0)', padding: 12, borderRadius: 4 }}>{preview.rule || '无'}</pre>
            <div><strong>描述：</strong>{preview.description || '无'}</div>
          </Space>
        )}
      </SideSheet>
    </Card>
  );
}
