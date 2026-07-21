import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { listTechStacks, createTechStack, deleteTechStack, listInfrastructure, createInfrastructure, deleteInfrastructure } from '@/api/techArchitecture';
import type { TechStack, Infrastructure } from '@/types';

const STACK_STATUS: Record<string, { color: string; label: string }> = { adopted: { color: 'green', label: '已采纳' }, trial: { color: 'blue', label: '试用' }, deprecated: { color: 'default', label: '已废弃' } };
const INFRA_STATUS: Record<string, { color: string; label: string }> = { active: { color: 'green', label: '运行中' }, maintenance: { color: 'orange', label: '维护中' }, offline: { color: 'default', label: '离线' } };

export default function TechArchPage() {
  const [stacks, setStacks] = useState<TechStack[]>([]);
  const [infra, setInfra] = useState<Infrastructure[]>([]);
  const [stackModalOpen, setStackModalOpen] = useState(false);
  const [infraModalOpen, setInfraModalOpen] = useState(false);
  const [stackForm] = Form.useForm<Partial<TechStack>>();
  const [infraForm] = Form.useForm<Partial<Infrastructure>>();

  const load = async () => {
    const [s, i] = await Promise.all([listTechStacks(), listInfrastructure()]);
    setStacks(s); setInfra(i);
  };

  useEffect(() => { load(); }, []);

  const stackColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STACK_STATUS[s]?.color}>{STACK_STATUS[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: TechStack) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteTechStack(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  const infraColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '规格', dataIndex: 'spec', key: 'spec' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={INFRA_STATUS[s]?.color}>{INFRA_STATUS[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: Infrastructure) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteInfrastructure(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <Card>
      <Tabs items={[
        { key: 'stacks', label: '技术栈', children: (
          <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setStackModalOpen(true)} style={{ marginBottom: 16 }}>新增技术栈</Button>
            <Table rowKey="id" columns={stackColumns} dataSource={stacks} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        )},
        { key: 'infra', label: '基础设施', children: (
          <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setInfraModalOpen(true)} style={{ marginBottom: 16 }}>新增基础设施</Button>
            <Table rowKey="id" columns={infraColumns} dataSource={infra} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        )},
      ]} />

      <Modal title="新增技术栈" open={stackModalOpen} onOk={async () => { const v = await stackForm.validateFields(); await createTechStack(v); message.success('创建成功'); setStackModalOpen(false); stackForm.resetFields(); load(); }} onCancel={() => { setStackModalOpen(false); stackForm.resetFields(); }}>
        <Form form={stackForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="version" label="版本"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="trial"><Select><Select.Option value="adopted">已采纳</Select.Option><Select.Option value="trial">试用</Select.Option><Select.Option value="deprecated">已废弃</Select.Option></Select></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增基础设施" open={infraModalOpen} onOk={async () => { const v = await infraForm.validateFields(); await createInfrastructure(v); message.success('创建成功'); setInfraModalOpen(false); infraForm.resetFields(); load(); }} onCancel={() => { setInfraModalOpen(false); infraForm.resetFields(); }}>
        <Form form={infraForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="spec" label="规格"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="active"><Select><Select.Option value="active">运行中</Select.Option><Select.Option value="maintenance">维护中</Select.Option><Select.Option value="offline">离线</Select.Option></Select></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
