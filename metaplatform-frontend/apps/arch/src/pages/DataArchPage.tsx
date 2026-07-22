import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, BranchesOutlined, BookOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { listDomains, createDomain, deleteDomain, listEntities, createEntity, deleteEntity } from '@/api/dataArchitecture';
import type { DataDomain, DataEntity } from '@/types';

export default function DataArchPage() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DataDomain[]>([]);
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [domainForm] = Form.useForm<Partial<DataDomain>>();
  const [entityForm] = Form.useForm<Partial<DataEntity>>();

  const load = async () => {
    const [d, e] = await Promise.all([listDomains(), listEntities()]);
    setDomains(d);
    setEntities(e);
  };

  useEffect(() => { load(); }, []);

  const handleDomainSubmit = async () => {
    const values = await domainForm.validateFields();
    await createDomain(values);
    message.success('创建成功');
    setDomainModalOpen(false);
    domainForm.resetFields();
    load();
  };

  const handleEntitySubmit = async () => {
    const values = await entityForm.validateFields();
    await createEntity({ ...values, fields: [] });
    message.success('创建成功');
    setEntityModalOpen(false);
    entityForm.resetFields();
    load();
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
    { title: '类型', dataIndex: 'entityType', key: 'entityType' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: DataEntity) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/arch/data/entities/${r.id}`)}>字段编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteEntity(r.id); message.success('已删除'); load(); }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="数据架构"
      extra={
        <Space>
          <Button icon={<BranchesOutlined />} onClick={() => navigate('/arch/data/flows')}>数据流</Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/arch/data/standards')}>数据标准</Button>
          <Button icon={<BookOutlined />} onClick={() => navigate('/arch/data/assets')}>资产目录</Button>
        </Space>
      }
    >
      <Tabs items={[
        { key: 'domains', label: '数据域', children: (
          <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDomainModalOpen(true)} style={{ marginBottom: 16 }}>新建数据域</Button>
            <Table rowKey="id" columns={domainColumns} dataSource={domains} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        )},
        { key: 'entities', label: '数据实体', children: (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setEntityModalOpen(true)}>新建实体</Button>
              <Select placeholder="筛选数据域" allowClear style={{ width: 200 }} value={selectedDomain} onChange={(v) => { setSelectedDomain(v); listEntities(v).then(setEntities); }} options={domains.map((d) => ({ label: d.name, value: d.id }))} />
            </Space>
            <Table rowKey="id" columns={entityColumns} dataSource={entities} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
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
          <Form.Item name="entityType" label="实体类型"><Input placeholder="如 MASTER_DATA / TRANSACTIONAL" /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
