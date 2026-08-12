import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Toast, Popconfirm, Tabs } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { listTechStacks, createTechStack, deleteTechStack, listInfrastructure, createInfrastructure, deleteInfrastructure } from '@/api/arch/techArchitecture';
import type { TechStack, Infrastructure } from '@/api/arch/types';

const STACK_STATUS: Record<string, { color: TagColor; label: string }> = { adopted: { color: 'green', label: '已采纳' }, trial: { color: 'blue', label: '试用' }, deprecated: { color: 'grey', label: '已废弃' } };
const INFRA_STATUS: Record<string, { color: TagColor; label: string }> = { active: { color: 'green', label: '运行中' }, maintenance: { color: 'orange', label: '维护中' }, offline: { color: 'grey', label: '离线' } };

export default function TechArchPage() {
  const [stacks, setStacks] = useState<TechStack[]>([]);
  const [infra, setInfra] = useState<Infrastructure[]>([]);
  const [stackModalOpen, setStackModalOpen] = useState(false);
  const [infraModalOpen, setInfraModalOpen] = useState(false);
  const [stackForm] = Form.useForm<Partial<TechStack>>();
  const [infraForm] = Form.useForm<Partial<Infrastructure>>();

  const load = async () => {
    const [s, i] = await Promise.all([listTechStacks(), listInfrastructure()]);
    setStacks(Array.isArray(s) ? s : ((s as { items?: TechStack[] }).items ?? [])); setInfra(Array.isArray(i) ? i : ((i as { items?: Infrastructure[] }).items ?? []));
  };

  useEffect(() => { load(); }, []);

  const stackColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STACK_STATUS[s]?.color}>{STACK_STATUS[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: TechStack) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteTechStack(r.id); Toast.success('已删除'); load(); }}><Button theme="borderless" type="primary" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  const infraColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '规格', dataIndex: 'spec', key: 'spec' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={INFRA_STATUS[s]?.color}>{INFRA_STATUS[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: Infrastructure) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteInfrastructure(r.id); Toast.success('已删除'); load(); }}><Button theme="borderless" type="primary" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <Card>
      <Tabs>
        <Tabs.TabPane itemKey="stacks" tab="技术栈">
          <div>
            <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setStackModalOpen(true)} style={{ marginBottom: 16 }}>新增技术栈</Button>
            <Table rowKey="id" columns={stackColumns} dataSource={stacks ?? []} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="infra" tab="基础设施">
          <div>
            <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setInfraModalOpen(true)} style={{ marginBottom: 16 }}>新增基础设施</Button>
            <Table rowKey="id" columns={infraColumns} dataSource={infra ?? []} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        </Tabs.TabPane>
      </Tabs>

      <Modal title="新增技术栈" visible={stackModalOpen} onOk={async () => { const v = await stackForm.validate(); await createTechStack(v); Toast.success('创建成功'); setStackModalOpen(false); stackForm.reset(); load(); }} onCancel={() => { setStackModalOpen(false); stackForm.reset(); }}>
        <Form form={stackForm}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="category" label="分类" rules={[{ required: true }]} />
          <Form.Input field="version" label="版本" />
          <Form.Input field="description" label="描述" />
          <Form.Select field="status" label="状态" initValue="trial" optionList={[{ value: 'adopted', label: '已采纳' }, { value: 'trial', label: '试用' }, { value: 'deprecated', label: '已废弃' }]} />
        </Form>
      </Modal>

      <Modal title="新增基础设施" visible={infraModalOpen} onOk={async () => { const v = await infraForm.validate(); await createInfrastructure(v); Toast.success('创建成功'); setInfraModalOpen(false); infraForm.reset(); load(); }} onCancel={() => { setInfraModalOpen(false); infraForm.reset(); }}>
        <Form form={infraForm}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="type" label="类型" rules={[{ required: true }]} />
          <Form.Input field="spec" label="规格" />
          <Form.Input field="description" label="描述" />
          <Form.Select field="status" label="状态" initValue="active" optionList={[{ value: 'active', label: '运行中' }, { value: 'maintenance', label: '维护中' }, { value: 'offline', label: '离线' }]} />
        </Form>
      </Modal>
    </Card>
  );
}
