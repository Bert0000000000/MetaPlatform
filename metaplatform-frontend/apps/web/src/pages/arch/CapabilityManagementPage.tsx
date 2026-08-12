import { useEffect, useState } from 'react';
import { Row, Col, Card, Tree, Button, Table, Space, Input, Modal, Form, Toast, Popconfirm, Tag } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { listCapabilities, getCapabilityTree, createCapability, updateCapability, deleteCapability } from '@/api/arch/capabilities';
import CapabilityGraph from './components/CapabilityGraph';
import type { Capability, CapabilityCreateRequest } from '@/api/arch/types';

function buildTreeData(caps: Capability[]): TreeNodeData[] {
  const idField = (c: Capability): string =>
    c.capabilityId ||
    String((c as unknown as Record<string, unknown>).capability_id ?? '') ||
    String((c as unknown as Record<string, unknown>).id ?? '');
  const parentField = (c: Capability): string =>
    c.parentCapabilityId ||
    String((c as unknown as Record<string, unknown>).parent_capability_id ?? '') ||
    String((c as unknown as Record<string, unknown>).parent_id ?? '');
  const visited = new Set<string>();
  const build = (parentId: string): TreeNodeData[] =>
    caps
      .filter((c) => parentField(c) === parentId && !visited.has(idField(c)))
      .map((c) => {
        const id = idField(c);
        visited.add(id);
        return {
          key: id,
          label: `${c.name} (${c.code})`,
          children: build(id),
        };
      });
  const roots = caps.filter((c) => !parentField(c));
  return roots.map((r) => {
    const id = idField(r);
    visited.add(id);
    return { key: id, label: `${r.name} (${r.code})`, children: build(id) };
  });
}

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '生效' },
  deprecated: { color: 'grey', label: '废弃' },
  planned: { color: 'blue', label: '规划中' },
};

export default function CapabilityManagementPage() {
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Capability | null>(null);
  const [form] = Form.useForm<CapabilityCreateRequest>();

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, treeRes] = await Promise.all([
        listCapabilities().catch(() => ({ items: [] })),
        getCapabilityTree().catch(() => []),
      ]);
      const listItems = Array.isArray(listRes) ? listRes : (listRes?.items ?? []);
      const treeItems = Array.isArray(treeRes)
        ? treeRes
        : (((treeRes as unknown as Record<string, unknown>)?.tree as Capability[]) ?? []);
      setCaps(listItems.length > 0 ? listItems : treeItems);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '加载能力列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validate();
      if (editing) {
        await updateCapability(editing.capabilityId, values);
        Toast.success('更新成功');
      } else {
        await createCapability(values);
        Toast.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.reset();
      load();
    } catch (err) {
      // form.validate rejection returns a validation error object (not an Error);
      // Form renders inline field errors, so only surface backend/axios errors here.
      if (err instanceof Error) {
        Toast.error(err.message || '操作失败');
      }
    }
  };

  const handleDelete = async (cap: Capability) => {
    try {
      await deleteCapability(cap.capabilityId);
      Toast.success('删除成功');
      load();
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns = [
    { title: '能力名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '层级', dataIndex: 'level', key: 'level' },
    { title: '父能力', dataIndex: 'parentName', key: 'parentName', render: (v?: string) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: Capability) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); form.setValues(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record)}>
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filtered = selectedId ? caps.filter((c) => c.capabilityId === selectedId || c.parentCapabilityId === selectedId) : caps;

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="能力树" bodyStyle={{ padding: 12 }} headerExtraContent={<Button size="small" theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新增</Button>}>
            <Tree treeData={buildTreeData(caps)} onSelect={(key) => setSelectedId(key || undefined)} defaultExpandAll />
          </Card>
        </Col>
        <Col span={18}>
          <Card title="能力列表" bodyStyle={{ padding: 12 }} headerExtraContent={<Input placeholder="搜索" showClear prefix={<SearchOutlined />} onEnterPress={() => load()} style={{ width: 200 }} />}>
            <Table rowKey={(r) => r?.capabilityId || ((r as unknown as Record<string, unknown> | undefined)?.id as string) || Math.random().toString()} columns={columns} dataSource={filtered ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
          </Card>
        </Col>
      </Row>
      <Card title="能力可视化" style={{ marginTop: 16 }}>
        <CapabilityGraph data={caps} />
      </Card>

      <Modal title={editing ? '编辑能力' : '创建能力'} visible={modalOpen} onOk={handleCreate} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="能力名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select field="parentCapabilityId" label="父能力" showClear placeholder="无（顶级能力）" optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))} />
          <Form.Select field="status" label="状态" initValue="active" optionList={[{ value: 'active', label: '生效' }, { value: 'planned', label: '规划中' }, { value: 'deprecated', label: '废弃' }]} />
        </Form>
      </Modal>
    </div>
  );
}
