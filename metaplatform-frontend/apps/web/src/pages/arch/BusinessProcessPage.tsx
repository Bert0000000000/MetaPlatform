import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Form, Popconfirm, Space, Tag, Timeline, Toast } from '@douyinfe/semi-ui';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createProcess,
  deleteProcess,
  getProcessRoleIds,
  linkProcessRoles,
  listProcesses,
  updateProcess,
} from '@/api/arch/businessProcesses';
import { listApplications } from '@/api/arch/applications';
import { listCapabilities } from '@/api/arch/capabilities';
import { listRoles } from '@/api/arch/roles';
import type {
  ArchApplication,
  ArchRole,
  BusinessProcess,
  BusinessProcessCreateRequest,
  BusinessProcessUpdateRequest,
  Capability,
} from '@/api/arch/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
} from '@/components/skeleton';

const STATUS_META: Record<string, { label: string; color: 'green' | 'grey' | 'red' }> = {
  ACTIVE: { label: '生效', color: 'green' },
  DRAFT: { label: '草稿', color: 'grey' },
  DEPRECATED: { label: '废弃', color: 'red' },
};

const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: '每日',
  WEEKLY: '每周',
  MONTHLY: '每月',
  YEARLY: '每年',
  ONCE: '一次性',
  CONTINUOUS: '持续',
};

interface ProcessDraft {
  id?: string;
  name: string;
  code: string;
  description?: string;
  processType?: 'MAIN' | 'SUB';
  frequency?: string;
  capabilityIds?: string[];
  applicationIds?: string[];
  bpmnXml?: string;
  status?: 'active' | 'draft' | 'deprecated';
}

interface RoleDraft {
  roleIds: string[];
  relationship?: string;
}

const upper = (v: string | undefined): string => (typeof v === 'string' ? v.toUpperCase() : '');

function stepLabel(step: Record<string, unknown>): string {
  const name = step.name;
  return typeof name === 'string' && name ? name : JSON.stringify(step);
}

/** 后端可能返回裸数组或 {items} 信封，统一成数组。 */
function normalize<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const bag = raw as { items?: T[] } | null | undefined;
  return bag?.items ?? [];
}

/**
 * 业务流程（DESIGN-SPEC §5 版式 E：表格页 + 抽屉详情/角色关联）。
 * 数据面沿用 src/api/arch/businessProcesses，能力/应用/角色用于关联选择。
 */
export default function BusinessProcessPage() {
  const [list, setList] = useState<BusinessProcess[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [apps, setApps] = useState<ArchApplication[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<BusinessProcess | null>(null);
  const [draft, setDraft] = useState<ProcessDraft | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ProcessDraft>();
  const [roleForm] = Form.useForm<RoleDraft>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [procRes, capRes, appRes, roleRes] = await Promise.allSettled([
      listProcesses(),
      listCapabilities(),
      listApplications(),
      listRoles(),
    ]);
    setList(procRes.status === 'fulfilled' ? normalize<BusinessProcess>(procRes.value) : []);
    setCaps(capRes.status === 'fulfilled' ? (capRes.value.items ?? []) : []);
    setApps(appRes.status === 'fulfilled' ? (appRes.value.items ?? []) : []);
    setRoles(roleRes.status === 'fulfilled' ? (roleRes.value.items ?? []) : []);
    if (procRes.status === 'rejected') {
      setError(procRes.reason instanceof Error ? procRes.reason.message : String(procRes.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const capName = useCallback(
    (id: string) => caps.find((c) => c.capabilityId === id)?.name ?? id,
    [caps],
  );
  const appName = useCallback((id: string) => apps.find((a) => a.appId === id)?.name ?? id, [apps]);

  const openCreate = () => {
    setDraft({ name: '', code: '', processType: 'MAIN', frequency: 'DAILY', status: 'draft' });
    form.reset();
  };

  const openEdit = (p: BusinessProcess) => {
    const pt = upper(p.processType);
    setDraft({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      processType: pt === 'MAIN' || pt === 'SUB' ? (pt as 'MAIN' | 'SUB') : 'MAIN',
      frequency: p.frequency,
      capabilityIds: p.capabilityIds ?? p.capabilities ?? [],
      applicationIds: p.applicationIds ?? [],
      bpmnXml: p.bpmnXml,
      status:
        upper(p.status) === 'ACTIVE'
          ? 'active'
          : upper(p.status) === 'DEPRECATED'
            ? 'deprecated'
            : 'draft',
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: ProcessDraft;
    try {
      values = (await form.validate()) as ProcessDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        const payload: BusinessProcessUpdateRequest = {
          name: values.name,
          description: values.description,
          processType: values.processType ?? 'MAIN',
          frequency: values.frequency ?? 'DAILY',
          capabilities: values.capabilityIds,
          applicationIds: values.applicationIds,
          bpmnXml: values.bpmnXml,
          status: upper(values.status),
        };
        await updateProcess(draft.id, payload);
        Toast.success('流程已更新');
      } else {
        const payload: BusinessProcessCreateRequest = {
          name: values.name,
          code: values.code,
          description: values.description,
          processType: values.processType ?? 'MAIN',
          frequency: values.frequency ?? 'DAILY',
          capabilities: values.capabilityIds,
          applicationIds: values.applicationIds,
          bpmnXml: values.bpmnXml,
        };
        await createProcess(payload);
        Toast.success('流程已创建');
      }
      setDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: BusinessProcess) => {
    try {
      await deleteProcess(p.id);
      Toast.success('流程已删除');
      if (detail?.id === p.id) setDetail(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openRoleDraft = async (p: BusinessProcess) => {
    try {
      const ids = await getProcessRoleIds(p.id);
      setRoleDraft({ roleIds: ids ?? [], relationship: 'RESPONSIBLE' });
      roleForm.reset();
      setDetail(p);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const submitRoles = async () => {
    if (!roleDraft || !detail) return;
    let values: RoleDraft;
    try {
      values = (await roleForm.validate()) as RoleDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      await linkProcessRoles(detail.id, { roleIds: values.roleIds ?? [], relationship: values.relationship });
      Toast.success('角色关联已保存');
      setRoleDraft(null);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(
    () =>
      keyword
        ? list.filter(
            (p) =>
              p.name.toLowerCase().includes(keyword.toLowerCase()) ||
              p.code.toLowerCase().includes(keyword.toLowerCase()),
          )
        : list,
    [list, keyword],
  );

  const columns = useMemo(
    () => [
      {
        title: '流程名称',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        ellipsis: true,
        render: (v: string, row: BusinessProcess) => (
          <Button theme="borderless" type="primary" size="small" onClick={() => setDetail(row)}>
            {v}
          </Button>
        ),
      },
      { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
      { title: '流程类型', dataIndex: 'processType', key: 'processType', width: 110 },
      {
        title: '频率',
        dataIndex: 'frequency',
        key: 'frequency',
        width: 100,
        render: (v: string | undefined) => (v ? FREQUENCY_LABEL[v] ?? v : '—'),
      },
      {
        title: '关联能力',
        dataIndex: '__capabilities__',
        key: 'capabilities',
        width: 240,
        render: (_: unknown, row: BusinessProcess) => (
          <Space>
            {(row.capabilities ?? row.capabilityIds ?? []).slice(0, 3).map((id) => (
              <Tag size="small" key={id} type="light">
                {capName(id)}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (v: string | undefined) => {
          const meta = STATUS_META[upper(v)];
          return (
            <Tag size="small" color={meta?.color ?? 'grey'} type="light">
              {meta?.label ?? (v ? upper(v) : '—')}
            </Tag>
          );
        },
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 180,
        render: (_: unknown, row: BusinessProcess) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Button theme="borderless" type="tertiary" size="small" onClick={() => void openRoleDraft(row)}>
              角色
            </Button>
            <Popconfirm title="确认删除该流程？" onConfirm={() => void remove(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capName],
  );

  return (
    <>
      <PageHeader
        title="业务流程"
        desc={`${list.length} 条流程 · 点名称查看步骤、BPMN 与关联应用`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新建流程
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索流程名称、编码…' }} />

      <DataTablePro<BusinessProcess>
        columns={columns}
        dataSource={visible}
        rowKey="id"
        loading={loading}
        empty={
          error ? (
            <EmptyState illustration="failure" title="流程列表加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的流程"
              desc="调整关键词，或新建一条业务流程。"
            />
          )
        }
      />

      <SheetDetail
        title={detail ? `流程详情 · ${detail.name}` : '流程详情'}
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail ? (
          <>
            <Descriptions
              row
              data={[
                { key: '编码', value: detail.code },
                { key: '流程类型', value: detail.processType ?? '—' },
                { key: '频率', value: detail.frequency ? FREQUENCY_LABEL[detail.frequency] ?? detail.frequency : '—' },
                { key: '状态', value: STATUS_META[upper(detail.status)]?.label ?? upper(detail.status) },
                { key: '版本', value: detail.version ?? '—' },
                { key: '描述', value: detail.description ?? '—' },
              ]}
            />

            <span className="mp-pane-title">流程步骤</span>
            {detail.processSteps && detail.processSteps.length > 0 ? (
              <Timeline>
                {detail.processSteps.map((step, idx) => (
                  <Timeline.Item key={idx} time={`第 ${idx + 1} 步`}>
                    {stepLabel(step)}
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <EmptyState illustration="no-content" title="暂无步骤" />
            )}

            <span className="mp-pane-title">关联应用</span>
            {detail.applicationIds && detail.applicationIds.length > 0 ? (
              <Space>
                {detail.applicationIds.map((id) => (
                  <Tag key={id} type="light">
                    {appName(id)}
                  </Tag>
                ))}
              </Space>
            ) : (
              <EmptyState illustration="no-content" title="未关联应用" />
            )}

            {detail.bpmnXml ? (
              <>
                <span className="mp-pane-title">BPMN XML</span>
                <pre>{detail.bpmnXml}</pre>
              </>
            ) : null}
          </>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={draft?.id ? `编辑流程 · ${draft.name}` : '新建流程'}
        open={draft !== null}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        {draft ? (
          <Form form={form} key={draft.id ?? 'new'} initValues={draft} labelPosition="top">
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Input field="code" label="编码" disabled={Boolean(draft.id)} rules={[{ required: true, message: '请输入编码' }]} />
            <Form.TextArea field="description" label="描述" rows={2} />
            <Form.Select
              field="processType"
              label="流程类型"
              optionList={[
                { value: 'MAIN', label: '主流程' },
                { value: 'SUB', label: '子流程' },
              ]}
            />
            <Form.Select
              field="frequency"
              label="执行频率"
              optionList={Object.entries(FREQUENCY_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Form.Select
              field="capabilityIds"
              label="关联能力"
              multiple
              optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))}
            />
            <Form.Select
              field="applicationIds"
              label="应用系统"
              multiple
              optionList={apps.map((a) => ({ value: a.appId, label: a.name }))}
            />
            <Form.TextArea field="bpmnXml" label="BPMN XML" rows={4} placeholder="粘贴 BPMN 2.0 XML" />
            <Form.Select
              field="status"
              label="状态"
              optionList={[
                { value: 'active', label: '生效' },
                { value: 'draft', label: '草稿' },
                { value: 'deprecated', label: '废弃' },
              ]}
            />
          </Form>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={detail ? `关联角色 · ${detail.name}` : '关联角色'}
        open={roleDraft !== null}
        onClose={() => setRoleDraft(null)}
        footer={
          <>
            <Button onClick={() => setRoleDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitRoles()}>
              保存关联
            </Button>
          </>
        }
      >
        {roleDraft ? (
          <Form form={roleForm} initValues={roleDraft} labelPosition="top">
            <Form.Select
              field="roleIds"
              label="负责角色"
              multiple
              optionList={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
            <Form.Select
              field="relationship"
              label="关系类型"
              optionList={[
                { value: 'RESPONSIBLE', label: '负责' },
                { value: 'ACCOUNTABLE', label: '问责' },
                { value: 'CONSULTED', label: '咨询' },
                { value: 'INFORMED', label: '知会' },
              ]}
            />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
