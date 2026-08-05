import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Typography, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listProcesses, createProcess, updateProcess, deleteProcess, linkProcessRoles, getProcessRoleIds } from '@/api/arch/businessProcesses';
import { listCapabilities } from '@/api/arch/capabilities';
import { listApplications } from '@/api/arch/applications';
import { listRoles } from '@/api/arch/roles';
import type { BusinessProcess, Capability, ArchApplication, ArchRole, BusinessProcessCreateRequest, BusinessProcessUpdateRequest } from '@/api/arch/types';

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: '生效' },
  DRAFT: { color: 'default', label: '草稿' },
  DEPRECATED: { color: 'red', label: '废弃' },
};

interface ProcessFormValues {
  name: string;
  code: string;
  description?: string;
  processType?: 'MAIN' | 'SUB';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ONCE' | 'CONTINUOUS';
  capabilityIds?: string[];
  applicationIds?: string[];
  bpmnXml?: string;
  status?: 'active' | 'draft' | 'deprecated';
}

export default function BusinessProcessPage() {
  const [list, setList] = useState<BusinessProcess[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [apps, setApps] = useState<ArchApplication[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessProcess | null>(null);
  const [detail, setDetail] = useState<BusinessProcess | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
  const [form] = Form.useForm<ProcessFormValues>();
  const [roleForm] = Form.useForm<{ roleIds: string[]; relationship?: string }>();

  const load = async () => {
    setLoading(true);
    try {
      const [res, capRes, appRes, roleRes] = await Promise.all([
        listProcesses(), listCapabilities(), listApplications(), listRoles()
      ]);
      setList(Array.isArray(res) ? res : ((res as { items?: BusinessProcess[] }).items ?? []));
      setCaps(capRes.items);
      setApps(appRes.items);
      setRoles(roleRes.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      const payload: BusinessProcessUpdateRequest = {
        name: values.name,
        description: values.description,
        processType: values.processType || 'MAIN',
        frequency: values.frequency || 'DAILY',
        capabilities: values.capabilityIds,
        applicationIds: values.applicationIds,
        bpmnXml: values.bpmnXml,
        status: typeof values.status === 'string' ? values.status.toUpperCase() : values.status,
      };
      await updateProcess(editing.id, payload);
      message.success('更新成功');
    } else {
      const payload: BusinessProcessCreateRequest = {
        name: values.name,
        code: values.code,
        description: values.description,
        processType: values.processType || 'MAIN',
        frequency: values.frequency || 'DAILY',
        capabilities: values.capabilityIds,
        applicationIds: values.applicationIds,
        bpmnXml: values.bpmnXml,
      };
      await createProcess(payload);
      message.success('创建成功');
    }
    setModalOpen(false); setEditing(null); form.resetFields(); load();
  };

  const openRoleModal = async (process: BusinessProcess) => {
    setSelectedProcess(process);
    const ids = await getProcessRoleIds(process.id);
    roleForm.setFieldsValue({ roleIds: ids, relationship: 'RESPONSIBLE' });
    setRoleModalOpen(true);
  };

  const handleRoleSubmit = async () => {
    if (!selectedProcess) return;
    const values = await roleForm.validateFields();
    await linkProcessRoles(selectedProcess.id, { roleIds: values.roleIds, relationship: values.relationship });
    message.success('角色关联成功');
    setRoleModalOpen(false);
    load();
  };

  const columns = [
    { title: '流程名称', dataIndex: 'name', key: 'name', render: (v: string, r: BusinessProcess) => <Typography.Link onClick={() => setDetail(r)}>{v}</Typography.Link> },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '流程类型', dataIndex: 'processType', key: 'processType' },
    { title: '频率', dataIndex: 'frequency', key: 'frequency' },
    { title: '关联能力', key: 'caps', render: (_: unknown, r: BusinessProcess) => (r.capabilities || r.capabilityIds || []).map((id) => <Tag key={id} color="blue">{caps.find((c) => c.capabilityId === id)?.name || id}</Tag>) },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
        const upper = typeof s === 'string' ? s.toUpperCase() : s;
        const meta = STATUS_TAG[upper as keyof typeof STATUS_TAG];
        return <Tag color={meta?.color}>{meta?.label ?? upper}</Tag>;
      } },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: BusinessProcess) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            const pt = r.processType;
            const statusUpper = typeof r.status === 'string' ? r.status.toUpperCase() : r.status;
            form.setFieldsValue({
              name: r.name,
              code: r.code,
              description: r.description,
              processType: pt === 'main' || pt === 'sub' ? pt.toUpperCase() as 'MAIN' | 'SUB' : pt as 'MAIN' | 'SUB' | undefined,
              frequency: r.frequency,
              capabilityIds: r.capabilityIds ?? r.capabilities,
              applicationIds: r.applicationIds,
              bpmnXml: r.bpmnXml,
              status: (statusUpper === 'ACTIVE' || statusUpper === 'DRAFT' || statusUpper === 'DEPRECATED'
                ? (statusUpper === 'ACTIVE' ? 'active' : statusUpper === 'DRAFT' ? 'draft' : 'deprecated')
                : undefined) as 'active' | 'draft' | 'deprecated' | undefined,
            });
            setModalOpen(true);
          }}>编辑</Button>
          <Button type="link" size="small" onClick={() => openRoleModal(r)}>角色</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteProcess(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="业务流程管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建</Button>}>
        <Table rowKey="id" columns={columns} dataSource={list ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
      </Card>

      {detail && (
        <Card title={`流程详情 - ${detail.name}`} style={{ marginTop: 16 }}>
          <Tabs items={[
            {
              key: 'steps', label: '流程步骤',
              children: detail.processSteps && detail.processSteps.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.processSteps.map((step, idx) => (
                    <div key={idx} style={{ padding: '4px 0' }}>
                      <Tag>{idx + 1}</Tag> {String(step.name || step)}
                    </div>
                  ))}
                </div>
              ) : <Typography.Text type="secondary">暂无步骤</Typography.Text>
            },
            {
              key: 'bpmn', label: 'BPMN',
              children: detail.bpmnXml ? <pre style={{ maxHeight: 400, overflow: 'auto' }}>{detail.bpmnXml}</pre> : <Typography.Text type="secondary">未配置 BPMN</Typography.Text>
            },
            {
              key: 'apps', label: '应用系统',
              children: detail.applicationIds?.length ? detail.applicationIds.map((id) => <Tag key={id}>{apps.find((a) => a.appId === id)?.name || id}</Tag>) : <Typography.Text type="secondary">未关联应用</Typography.Text>
            }
          ]} />
        </Card>
      )}

      <Modal title={editing ? '编辑流程' : '新建流程'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="processType" label="流程类型" initialValue="MAIN">
            <Select><Select.Option value="MAIN">主流程</Select.Option><Select.Option value="SUB">子流程</Select.Option></Select>
          </Form.Item>
          <Form.Item name="frequency" label="执行频率" initialValue="DAILY">
            <Select>
              <Select.Option value="DAILY">每日</Select.Option>
              <Select.Option value="WEEKLY">每周</Select.Option>
              <Select.Option value="MONTHLY">每月</Select.Option>
              <Select.Option value="YEARLY">每年</Select.Option>
              <Select.Option value="ONCE">一次性</Select.Option>
              <Select.Option value="CONTINUOUS">持续</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="capabilityIds" label="关联能力">
            <Select mode="multiple">{caps.map((c) => <Select.Option key={c.capabilityId} value={c.capabilityId}>{c.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item name="applicationIds" label="应用系统">
            <Select mode="multiple">{apps.map((a) => <Select.Option key={a.appId} value={a.appId}>{a.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item name="bpmnXml" label="BPMN XML"><Input.TextArea rows={4} placeholder="粘贴 BPMN 2.0 XML" /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft">
            <Select><Select.Option value="active">生效</Select.Option><Select.Option value="draft">草稿</Select.Option><Select.Option value="deprecated">废弃</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="关联角色" open={roleModalOpen} onOk={handleRoleSubmit} onCancel={() => { setRoleModalOpen(false); setSelectedProcess(null); roleForm.resetFields(); }}>
        <Form form={roleForm} layout="vertical">
          <Form.Item name="roleIds" label="负责角色">
            <Select mode="multiple">{roles.map((r) => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item name="relationship" label="关系类型" initialValue="RESPONSIBLE">
            <Select><Select.Option value="RESPONSIBLE">负责</Select.Option><Select.Option value="ACCOUNTABLE">问责</Select.Option><Select.Option value="CONSULTED">咨询</Select.Option><Select.Option value="INFORMED">知会</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
