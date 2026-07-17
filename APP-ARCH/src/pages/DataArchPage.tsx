import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Tabs, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { listDomains, createDomain, deleteDomain, listEntities, createEntity, deleteEntity, listFlows } from '@/api/dataArchitecture';
import type { DataDomain, DataEntity, DataFlow } from '@/types';

export default function DataArchPage() {
  const [domains, setDomains] = useState<DataDomain[]>([]);
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [flows, setFlows] = useState<DataFlow[]>([]);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [domainForm] = Form.useForm<Partial<DataDomain>>();
  const [entityForm] = Form.useForm<Partial<DataEntity>>();

  const load = async () => {
    const [d, e, f] = await Promise.all([listDomains(), listEntities(), listFlows()]);
    setDomains(d); setEntities(e); setFlows(f);
  };

  useEffect(() => { load(); }, []);

  const handleDomainSubmit = async () => {
    const values = await domainForm.validateFields();
    await createDomain(values);
    message.success('创建成功');
    setDomainModalOpen(false); domainForm.resetFields(); load();
  };

  const handleEntitySubmit = async () => {
    const values = await entityForm.validateFields();
    await createEntity(values);
    message.success('创建成功');
    setEntityModalOpen(false); entityForm.resetFields(); load();
  };

  const domainColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '操作', key: 'action', render: (_: unknown, r: DataDomain) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteDomain(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  const entityColumns = [
    { title: '实体名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '所属域', key: 'domain', render: (_: unknown, r: DataEntity) => <Tag color="blue">{domains.find((d) => d.id === r.domainId)?.name || '-'}</Tag> },
    { title: '字段数', key: 'fields', render: (_: unknown, r: DataEntity) => r.fields?.length || 0 },
    { title: '操作', key: 'action', render: (_: unknown, r: DataEntity) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteEntity(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <Card>
      <Tabs items={[
        { key: 'domains', label: '数据域', children: (
          <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDomainModalOpen(true)} style={{ marginBottom: 16 }}>新建数据域</Button>
            <Table rowKey="id" columns={domainColumns} dataSource={domains} size="small" pagination={false} />
          </div>
        )},
        { key: 'entities', label: '数据实体', children: (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setEntityModalOpen(true)}>新建实体</Button>
              <Select placeholder="筛选数据域" allowClear style={{ width: 200 }} value={selectedDomain} onChange={(v) => { setSelectedDomain(v); listEntities(v).then(setEntities); }} options={domains.map((d) => ({ label: d.name, value: d.id }))} />
            </Space>
            <Table rowKey="id" columns={entityColumns} dataSource={entities} size="small" pagination={false} />
          </div>
        )},
        { key: 'flows', label: '数据流', children: (
          <Table rowKey="id" columns={[{ title: '名称', dataIndex: 'name', key: 'name' }, { title: '描述', dataIndex: 'description', key: 'description' }, { title: '源实体', key: 'src', render: (_: unknown, r: DataFlow) => entities.find((e) => e.id === r.sourceEntityId)?.name || r.sourceEntityId }, { title: '目标实体', key: 'tgt', render: (_: unknown, r: DataFlow) => entities.find((e) => e.id === r.targetEntityId)?.name || r.targetEntityId }]} dataSource={flows} size="small" pagination={false} />
        )},
      ]} />

      <Modal title="新建数据域" open={domainModalOpen} onOk={handleDomainSubmit} onCancel={() => { setDomainModalOpen(false); domainForm.resetFields(); }}>
        <Form form={domainForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新建数据实体" open={entityModalOpen} onOk={handleEntitySubmit} onCancel={() => { setEntityModalOpen(false); entityForm.resetFields(); }}>
        <Form form={entityForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="domainId" label="数据域"><Select options={domains.map((d) => ({ label: d.name, value: d.id }))} /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
