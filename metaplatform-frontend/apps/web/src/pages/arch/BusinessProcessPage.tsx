import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, Toast, Popconfirm, Typography, Tabs } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listProcesses, createProcess, updateProcess, deleteProcess, linkProcessRoles, getProcessRoleIds } from '@/api/arch/businessProcesses';
import { listCapabilities } from '@/api/arch/capabilities';
import { listApplications } from '@/api/arch/applications';
import { listRoles } from '@/api/arch/roles';
import type { BusinessProcess, Capability, ArchApplication, ArchRole, BusinessProcessCreateRequest, BusinessProcessUpdateRequest } from '@/api/arch/types';

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  ACTIVE: { color: 'green', label: '生效' },
  DRAFT: { color: 'grey', label: '草稿' },
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
    const values = await form.validate();
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
      Toast.success('更新成功');
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
      Toast.success('创建成功');
    }
    setModalOpen(false); setEditing(null); form.reset(); load();
  };

  const openRoleModal = async (process: BusinessProcess) => {
    setSelectedProcess(process);
    const ids = await getProcessRoleIds(process.id);
    roleForm.setValues({ roleIds: ids, relationship: 'RESPONSIBLE' });
    setRoleModalOpen(true);
  };

  const handleRoleSubmit = async () => {
    if (!selectedProcess) return;
    const values = await roleForm.validate();
    await linkProcessRoles(selectedProcess.id, { roleIds: values.roleIds, relationship: values.relationship });
    Toast.success('角色关联成功');
    setRoleModalOpen(false);
    load();
  };

  const columns = [
    { title: '流程名称', dataIndex: 'name', key: 'name', render: (v: string, r: BusinessProcess) => <Typography.Text link onClick={() => setDetail(r)}>{v}</Typography.Text> },
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
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            const pt = r.processType;
            const statusUpper = typeof r.status === 'string' ? r.status.toUpperCase() : r.status;
            form.setValues({
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
          <Button theme="borderless" type="primary" size="small" onClick={() => openRoleModal(r)}>角色</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteProcess(r.id); Toast.success('已删除'); load(); }}><Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="业务流程管理" headerExtraContent={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新建</Button>}>
        <Table rowKey="id" columns={columns} dataSource={list ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
      </Card>

      {detail && (
        <Card title={`流程详情 - ${detail.name}`} style={{ marginTop: 16 }}>
          <Tabs>
            <Tabs.TabPane
              itemKey="steps"
              tab="流程步骤"
            >
              {detail.processSteps && detail.processSteps.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.processSteps.map((step, idx) => (
                    <div key={idx} style={{ padding: '4px 0' }}>
                      <Tag>{idx + 1}</Tag> {String(step.name || step)}
                    </div>
                  ))}
                </div>
              ) : <Typography.Text type="tertiary">暂无步骤</Typography.Text>}
            </Tabs.TabPane>
            <Tabs.TabPane
              itemKey="bpmn"
              tab="BPMN"
            >
              {detail.bpmnXml ? <pre style={{ maxHeight: 400, overflow: 'auto' }}>{detail.bpmnXml}</pre> : <Typography.Text type="tertiary">未配置 BPMN</Typography.Text>}
            </Tabs.TabPane>
            <Tabs.TabPane
              itemKey="apps"
              tab="应用系统"
            >
              {detail.applicationIds?.length ? detail.applicationIds.map((id) => <Tag key={id}>{apps.find((a) => a.appId === id)?.name || id}</Tag>) : <Typography.Text type="tertiary">未关联应用</Typography.Text>}
            </Tabs.TabPane>
          </Tabs>
        </Card>
      )}

      <Modal title={editing ? '编辑流程' : '新建流程'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} disabled={!!editing} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select field="processType" label="流程类型" initValue="MAIN" optionList={[{ value: 'MAIN', label: '主流程' }, { value: 'SUB', label: '子流程' }]} />
          <Form.Select field="frequency" label="执行频率" initValue="DAILY" optionList={[
            { value: 'DAILY', label: '每日' },
            { value: 'WEEKLY', label: '每周' },
            { value: 'MONTHLY', label: '每月' },
            { value: 'YEARLY', label: '每年' },
            { value: 'ONCE', label: '一次性' },
            { value: 'CONTINUOUS', label: '持续' },
          ]} />
          <Form.Select field="capabilityIds" label="关联能力" multiple optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))} />
          <Form.Select field="applicationIds" label="应用系统" multiple optionList={apps.map((a) => ({ value: a.appId, label: a.name }))} />
          <Form.TextArea field="bpmnXml" label="BPMN XML" rows={4} placeholder="粘贴 BPMN 2.0 XML" />
          <Form.Select field="status" label="状态" initValue="draft" optionList={[
            { value: 'active', label: '生效' },
            { value: 'draft', label: '草稿' },
            { value: 'deprecated', label: '废弃' },
          ]} />
        </Form>
      </Modal>

      <Modal title="关联角色" visible={roleModalOpen} onOk={handleRoleSubmit} onCancel={() => { setRoleModalOpen(false); setSelectedProcess(null); roleForm.reset(); }}>
        <Form form={roleForm}>
          <Form.Select field="roleIds" label="负责角色" multiple optionList={roles.map((r) => ({ value: r.id, label: r.name }))} />
          <Form.Select field="relationship" label="关系类型" initValue="RESPONSIBLE" optionList={[
            { value: 'RESPONSIBLE', label: '负责' },
            { value: 'ACCOUNTABLE', label: '问责' },
            { value: 'CONSULTED', label: '咨询' },
            { value: 'INFORMED', label: '知会' },
          ]} />
        </Form>
      </Modal>
    </div>
  );
}
