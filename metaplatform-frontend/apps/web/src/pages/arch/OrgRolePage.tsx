import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Space, Tag, Toast, Tree } from '@douyinfe/semi-ui';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { createRole, deleteRole, getOrgTree, listRoles, updateRole } from '@/api/arch/roles';
import type { ArchRole, CreateRoleRequest, OrgUnit } from '@/api/arch/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  SplitPane,
} from '@/components/skeleton';

const DOMAIN_OPTIONS = ['SALES', 'MARKETING', 'FINANCE', 'HR', 'OPERATIONS', 'IT', 'LEGAL', 'PRODUCT'];

interface RoleDraft extends CreateRoleRequest {
  id?: string;
}

interface RawOrg {
  id?: string;
  name?: string;
  code?: string;
  level?: number;
  head?: string;
  description?: string;
  parent_id?: string;
  parentId?: string;
  children?: RawOrg[];
}

/** 组织树可能是嵌套 children 结构，先拍平成带 parentId 的列表。 */
function flattenOrgs(nodes: RawOrg[], parentId?: string): OrgUnit[] {
  const out: OrgUnit[] = [];
  for (const n of nodes) {
    const id = n.id ?? '';
    out.push({
      id,
      name: n.name ?? '',
      level: n.level ?? 0,
      parentId: n.parentId ?? n.parent_id ?? parentId,
      head: n.head,
      description: n.description,
    });
    if (n.children?.length) out.push(...flattenOrgs(n.children, id));
  }
  return out;
}

/** 组织树可能返回裸数组、{tree} 或 {items} 信封，统一成扁平数组。 */
function orgList(raw: unknown): OrgUnit[] {
  const bag = raw as { tree?: RawOrg[]; items?: RawOrg[] } | null | undefined;
  const nodes = Array.isArray(raw) ? (raw as RawOrg[]) : (bag?.tree ?? bag?.items ?? []);
  return flattenOrgs(nodes);
}

interface RawRole {
  id?: string;
  name?: string;
  code?: string;
  description?: string;
  responsibility?: string;
  org_id?: string;
  orgUnitId?: string;
  orgUnitName?: string;
  domain?: string;
  iamRoleIds?: string[];
  processCount?: number;
}

function adaptRole(raw: RawRole): ArchRole {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    code: raw.code ?? '',
    description: raw.description,
    responsibility: raw.responsibility,
    orgUnitId: raw.orgUnitId ?? raw.org_id ?? undefined,
    orgUnitName: raw.orgUnitName,
    domain: raw.domain,
    iamRoleIds: raw.iamRoleIds ?? [],
    processCount: raw.processCount,
  };
}

/** 角色列表可能返回裸数组或 PageResponse，统一成数组。 */
function roleList(raw: unknown): ArchRole[] {
  const items = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] } | null)?.items ?? []);
  return items.map((i) => adaptRole(i as RawRole));
}

function buildOrgTree(orgs: OrgUnit[]): TreeNodeData[] {
  const visited = new Set<string>();
  const build = (parentId: string): TreeNodeData[] =>
    orgs
      .filter((o) => (o.parentId ?? '') === parentId && !visited.has(o.id))
      .map((o) => {
        visited.add(o.id);
        return { key: o.id, label: `${o.name}${o.head ? `（${o.head}）` : ''}`, children: build(o.id) };
      });
  return orgs
    .filter((o) => !o.parentId && !visited.has(o.id))
    .map((o) => {
      visited.add(o.id);
      return { key: o.id, label: `${o.name}${o.head ? `（${o.head}）` : ''}`, children: build(o.id) };
    });
}

/**
 * 组织角色（DESIGN-SPEC §5 版式 B：左树右表）。
 * 数据面沿用 src/api/arch/roles：getOrgTree 组织树、listRoles 角色列表。
 */
export default function OrgRolePage() {
  const [orgs, setOrgs] = useState<OrgUnit[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [domainFilter, setDomainFilter] = useState<string | undefined>();
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateRoleRequest>();

  const loadRoles = useCallback(
    async (orgUnitId?: string, domain?: string, keyword?: string) => {
      const res = await listRoles({
        orgUnitId,
        domain,
        keyword: keyword || undefined,
      });
      setRoles(roleList(res));
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [orgRes, roleRes] = await Promise.allSettled([
      getOrgTree(),
      listRoles({ orgUnitId: selectedOrg, domain: domainFilter, keyword: keyword || undefined }),
    ]);
    setOrgs(orgRes.status === 'fulfilled' ? orgList(orgRes.value) : []);
    setRoles(roleRes.status === 'fulfilled' ? roleList(roleRes.value) : []);
    if (roleRes.status === 'rejected') {
      setError(roleRes.reason instanceof Error ? roleRes.reason.message : String(roleRes.reason));
    }
    setLoading(false);
  }, [selectedOrg, domainFilter, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectOrg = (orgId: string | undefined) => {
    setSelectedOrg(orgId);
  };

  const openCreate = () => {
    setDraft({ name: '', code: '', orgUnitId: selectedOrg });
    form.reset();
  };

  const openEdit = (role: ArchRole) => {
    setDraft({
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      responsibility: role.responsibility,
      orgUnitId: role.orgUnitId,
      domain: role.domain,
      iamRoleIds: role.iamRoleIds ?? [],
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: CreateRoleRequest;
    try {
      values = (await form.validate()) as CreateRoleRequest;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await updateRole(draft.id, values);
        Toast.success('角色已更新');
      } else {
        await createRole({ ...values, orgUnitId: values.orgUnitId ?? selectedOrg });
        Toast.success('角色已创建');
      }
      setDraft(null);
      await loadRoles(selectedOrg, domainFilter, keyword);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: ArchRole) => {
    try {
      await deleteRole(role.id);
      Toast.success('角色已删除');
      await loadRoles(selectedOrg, domainFilter, keyword);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const treeData = useMemo(() => buildOrgTree(orgs), [orgs]);
  const orgName = useMemo(
    () => orgs.find((o) => o.id === selectedOrg)?.name,
    [orgs, selectedOrg],
  );
  const orgById = useCallback(
    (id: string | undefined) => (id ? orgs.find((o) => o.id === id)?.name ?? id : ''),
    [orgs],
  );

  const columns = useMemo(
    () => [
      { title: '角色名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
      { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
      {
        title: '所属组织',
        dataIndex: '__org__',
        key: 'org',
        width: 180,
        ellipsis: true,
        render: (_: unknown, row: ArchRole) => orgById(row.orgUnitId) || row.orgUnitName || '—',
      },
      {
        title: '业务域',
        dataIndex: 'domain',
        key: 'domain',
        width: 120,
        render: (v: string | undefined) => (v ? <Tag color="cyan" type="light">{v}</Tag> : '—'),
      },
      { title: '职责', dataIndex: 'responsibility', key: 'responsibility', ellipsis: true },
      {
        title: 'IAM 角色',
        dataIndex: '__iam__',
        key: 'iam',
        width: 150,
        render: (_: unknown, row: ArchRole) =>
          (row.iamRoleIds ?? []).slice(0, 2).map((id) => (
            <Tag key={id} type="light">
              {id.slice(0, 8)}
            </Tag>
          )),
      },
      { title: '流程数', dataIndex: 'processCount', key: 'processCount', width: 90 },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 140,
        render: (_: unknown, row: ArchRole) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该角色？" onConfirm={() => void remove(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgById],
  );

  return (
    <>
      <PageHeader
        title="组织角色"
        desc={
          orgName
            ? `${roles.length} 个角色 · 当前组织 ${orgName}`
            : `${roles.length} 个角色 · 左树定位组织，右侧维护角色职责`
        }
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增角色
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索角色名称、编码…' }}
        filters={
          <Select
            value={domainFilter ?? ''}
            onChange={(v) => setDomainFilter(v ? String(v) : undefined)}
            placeholder="全部业务域"
          >
            <Select.Option value="">全部业务域</Select.Option>
            {DOMAIN_OPTIONS.map((d) => (
              <Select.Option key={d} value={d}>
                {d}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <SplitPane
        ariaLabel="组织架构"
        pane={
          <>
            <div className="mp-pane-title">组织架构</div>
            <div className="mp-pane-scroll">
              {treeData.length > 0 ? (
                <Tree
                  treeData={treeData}
                  defaultExpandAll
                  onSelect={(key) => selectOrg(key ? String(key) : undefined)}
                />
              ) : (
                <EmptyState illustration="no-content" title="暂无组织架构" desc="后端还没有组织单元数据。" />
              )}
            </div>
          </>
        }
      >
        <DataTablePro<ArchRole>
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          onRow={(record) => ({ onDoubleClick: () => openEdit(record as ArchRole) })}
          empty={
            error ? (
              <EmptyState illustration="failure" title="角色列表加载失败" desc={error} />
            ) : (
              <EmptyState
                illustration="no-result"
                title="没有匹配的角色"
                desc="调整组织、业务域或关键词，或新增一个角色。"
              />
            )
          }
        />
      </SplitPane>

      <SheetDetail
        title={draft?.id ? `编辑角色 · ${draft.name}` : '新增角色'}
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
            <Form.Input field="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]} />
            <Form.Input field="code" label="编码" disabled={Boolean(draft.id)} rules={[{ required: true, message: '请输入编码' }]} />
            <Form.TextArea field="description" label="描述" rows={2} />
            <Form.TextArea field="responsibility" label="职责" rows={2} />
            <Form.Select
              field="orgUnitId"
              label="所属组织"
              showClear
              placeholder="选择组织单元"
              optionList={orgs.map((o) => ({ value: o.id, label: o.name }))}
            />
            <Form.Select
              field="domain"
              label="业务域"
              showClear
              placeholder="选择业务域"
              optionList={DOMAIN_OPTIONS.map((d) => ({ value: d, label: d }))}
            />
            <Form.TagInput field="iamRoleIds" label="IAM 角色 ID" placeholder="输入 IAM 角色 ID，按回车确认" separator="," />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
