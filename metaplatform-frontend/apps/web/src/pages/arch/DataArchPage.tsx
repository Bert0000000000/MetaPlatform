import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, Toast, Popconfirm, Tabs } from '@douyinfe/semi-ui';
import { PlusOutlined, DeleteOutlined, EditOutlined, BranchesOutlined, BookOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { listDomains, createDomain, deleteDomain, listEntities, createEntity, deleteEntity } from '@/api/arch/dataArchitecture';
import type { DataDomain, DataEntity } from '@/api/arch/types';

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
    setDomains(Array.isArray(d) ? d : ((d as { items?: DataDomain[] }).items ?? []));
    setEntities(Array.isArray(e) ? e : ((e as { items?: DataEntity[] }).items ?? []));
  };

  useEffect(() => { load(); }, []);

  const handleDomainSubmit = async () => {
    const values = await domainForm.validate();
    await createDomain(values);
    Toast.success('创建成功');
    setDomainModalOpen(false);
    domainForm.reset();
    load();
  };

  const handleEntitySubmit = async () => {
    const values = await entityForm.validate();
    await createEntity({ ...values, fields: [] });
    Toast.success('创建成功');
    setEntityModalOpen(false);
    entityForm.reset();
    load();
  };

  const domainColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '操作', key: 'action', render: (_: unknown, r: DataDomain) => <Popconfirm title="确认删除？" onConfirm={async () => { await deleteDomain(r.id); Toast.success('已删除'); load(); }}><Button theme="borderless" type="primary" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
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
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => navigate(`/arch/data/entities/${r.id}`)}>字段编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteEntity(r.id); Toast.success('已删除'); load(); }}>
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="数据架构"
      headerExtraContent={
        <Space>
          <Button icon={<BranchesOutlined />} onClick={() => navigate('/arch/data/flows')}>数据流</Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate('/arch/data/standards')}>数据标准</Button>
          <Button icon={<BookOutlined />} onClick={() => navigate('/arch/data/assets')}>资产目录</Button>
        </Space>
      }
    >
      <Tabs>
        <Tabs.TabPane itemKey="domains" tab="数据域">
          <div>
            <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setDomainModalOpen(true)} style={{ marginBottom: 16 }}>新建数据域</Button>
            <Table rowKey="id" columns={domainColumns} dataSource={domains ?? []} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="entities" tab="数据实体">
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => setEntityModalOpen(true)}>新建实体</Button>
              <Select placeholder="筛选数据域" showClear style={{ width: 200 }} value={selectedDomain} onChange={(v) => { setSelectedDomain(v as string | undefined); listEntities(v as string | undefined).then((data) => setEntities(Array.isArray(data) ? data : ((data as { items?: DataEntity[] }).items ?? []))); }} optionList={domains.map((d) => ({ label: d.name, value: d.id }))} />
            </Space>
            <Table rowKey="id" columns={entityColumns} dataSource={entities ?? []} size="small" pagination={false} scroll={{ x: 'max-content' }} />
          </div>
        </Tabs.TabPane>
      </Tabs>

      <Modal title="新建数据域" visible={domainModalOpen} onOk={handleDomainSubmit} onCancel={() => { setDomainModalOpen(false); domainForm.reset(); }}>
        <Form form={domainForm}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.Input field="description" label="描述" />
        </Form>
      </Modal>

      <Modal title="新建数据实体" visible={entityModalOpen} onOk={handleEntitySubmit} onCancel={() => { setEntityModalOpen(false); entityForm.reset(); }}>
        <Form form={entityForm}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.Select field="domainId" label="数据域" optionList={domains.map((d) => ({ label: d.name, value: d.id }))} />
          <Form.Input field="entityType" label="实体类型" placeholder="如 MASTER_DATA / TRANSACTIONAL" />
          <Form.Input field="description" label="描述" />
        </Form>
      </Modal>
    </Card>
  );
}
