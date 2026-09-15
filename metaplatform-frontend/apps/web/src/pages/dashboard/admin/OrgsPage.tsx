import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Form,
  Popconfirm,
  Tag,
  Toast,
  Tree,
} from '@douyinfe/semi-ui';
import { ArrowRightLeft, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createOrg,
  createPosition,
  deleteOrg,
  deletePosition,
  getOrgTree,
  listOrgs,
  listPositions,
  transferEmployee,
  updateOrg,
  updatePosition,
  type CreateOrgPayload,
  type CreatePositionPayload,
  type UpdatePositionPayload,
  type TransferPayload,
} from '@/api/admin/orgs';
import type { AdminOrg, AdminOrgTreeNode, AdminPosition, OrgType } from '@/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  SplitPane,
} from '@/components/skeleton';
import './admin.css';

const PAGE_SIZE = 20;
const LOAD_LIMIT = 500;

const ORG_TYPE_LABEL: Record<OrgType, string> = {
  COMPANY: '公司',
  DEPARTMENT: '部门',
  TEAM: '团队',
  VIRTUAL: '虚拟组织',
};

const ORG_TYPE_OPTIONS = (Object.keys(ORG_TYPE_LABEL) as OrgType[]).map((value) => ({
  value,
  label: ORG_TYPE_LABEL[value],
}));

/** Semi Tree 的数据节点：key/label/children 是 Tree 约定，其余字段供 renderLabel 使用。 */
interface OrgTreeNode {
  key: string;
  label: string;
  type: OrgType;
  memberCount: number;
  children?: OrgTreeNode[];
}

function toTreeData(nodes: AdminOrgTreeNode[] | undefined): OrgTreeNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => {
    // 后端 Pydantic 默认 snake_case，回退兼容
    const raw = n as unknown as { member_count?: number };
    return {
      key: String(n.id),
      label: n.name,
      type: n.type,
      memberCount: n.memberCount ?? raw.member_count ?? 0,
      children:
        Array.isArray(n.children) && n.children.length > 0 ? toTreeData(n.children) : undefined,
    };
  });
}

function collectSubtreeIds(nodes: AdminOrgTreeNode[], id: number, out: Set<number>): boolean {
  for (const n of nodes) {
    if (n.id === id) {
      const walk = (list: AdminOrgTreeNode[]) => {
        for (const x of list) {
          out.add(x.id);
          if (x.children?.length) walk(x.children);
        }
      };
      walk([n]);
      return true;
    }
    if (n.children?.length && collectSubtreeIds(n.children, id, out)) return true;
  }
  return false;
}

/**
 * 平台管理 · 组织与租户（DESIGN-SPEC §5 版式 E + 树）。
 * 左栏为组织树（Semi Tree），右栏为扁平组织表（DataTablePro，listOrgs 数据面）；
 * 新建/编辑组织、岗位、人员调岗全部走右侧 SheetDetail。
 *
 * 说明：旧版「成员」tab 只是占位文案，无对应后端接口，未保留；
 * 组织人数 / 岗位数由 detail 抽屉如实呈现。
 */
export default function OrgsPage() {
  const [tree, setTree] = useState<AdminOrgTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState('');

  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTreeKey, setSelectedTreeKey] = useState<string | null>(null);

  const [detailOrg, setDetailOrg] = useState<AdminOrg | null>(null);
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState('');

  const [orgDraft, setOrgDraft] = useState<{ mode: 'create' | 'edit'; orgId?: number } | null>(null);
  const [positionDraft, setPositionDraft] = useState<{
    mode: 'create' | 'edit';
    positionId?: number;
  } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const [orgForm] = Form.useForm();
  const [positionForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    setTreeError('');
    try {
      const t = await getOrgTree();
      setTree(t ?? []);
    } catch (e) {
      setTree([]);
      setTreeError(e instanceof Error ? e.message : String(e));
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const loadOrgs = useCallback(async () => {
    setOrgsLoading(true);
    setOrgsError('');
    try {
      const r = await listOrgs({ pageSize: LOAD_LIMIT });
      setOrgs(r.items ?? []);
    } catch (e) {
      setOrgs([]);
      setOrgsError(e instanceof Error ? e.message : String(e));
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const loadPositions = useCallback(async (orgId: number) => {
    setPositionsLoading(true);
    setPositionsError('');
    try {
      const r = await listPositions({ orgId, pageSize: 100 });
      setPositions(r.items ?? []);
    } catch (e) {
      setPositions([]);
      setPositionsError(e instanceof Error ? e.message : String(e));
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTree();
    void loadOrgs();
  }, [loadTree, loadOrgs]);

  useEffect(() => {
    if (detailOrg) void loadPositions(detailOrg.id);
    else setPositions([]);
  }, [detailOrg, loadPositions]);

  useEffect(() => {
    setPage(1);
  }, [keyword, selectedTreeKey]);

  const refresh = useCallback(() => {
    void loadTree();
    void loadOrgs();
  }, [loadTree, loadOrgs]);

  const treeData = useMemo(() => toTreeData(tree), [tree]);

  /** 数据异步到达，defaultExpandAll 不会补展开 —— 由受控 expandedKeys 保证首屏全展开。 */
  const allExpandableKeys = useMemo(() => {
    const keys: string[] = [];
    const walk = (nodes: OrgTreeNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) keys.push(n.key);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(treeData);
    return keys;
  }, [treeData]);

  useEffect(() => {
    setExpandedKeys(allExpandableKeys);
  }, [allExpandableKeys]);

  const stats = useMemo(() => {
    let deptCount = 0;
    let rootCount = 0;
    let memberTotal = 0;
    for (const o of orgs) {
      memberTotal += o.memberCount ?? 0;
      if (o.type === 'DEPARTMENT') deptCount += 1;
      if (o.parentId == null) rootCount += 1;
    }
    return { total: orgs.length, deptCount, rootCount, memberTotal };
  }, [orgs]);

  const openOrgDetail = useCallback(
    (org: AdminOrg) => {
      setDetailOrg(org);
    },
    [],
  );

  const onSelectTreeNode = useCallback(
    (key: string) => {
      if (!key) return;
      setSelectedTreeKey(key);
      const found = orgs.find((o) => String(o.id) === key);
      if (found) openOrgDetail(found);
    },
    [orgs, openOrgDetail],
  );

  const filteredOrgs = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = orgs;
    if (selectedTreeKey) {
      const id = Number(selectedTreeKey);
      const allowed = new Set<number>();
      if (Number.isFinite(id) && collectSubtreeIds(tree, id, allowed)) {
        list = list.filter((o) => allowed.has(o.id));
      }
    }
    if (!kw) return list;
    return list.filter(
      (o) => o.name.toLowerCase().includes(kw) || o.code.toLowerCase().includes(kw),
    );
  }, [orgs, keyword, selectedTreeKey, tree]);

  const pagedOrgs = useMemo(
    () => filteredOrgs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOrgs, page],
  );

  const parentName = useCallback(
    (parentId?: number | null): string =>
      parentId == null ? '—' : (orgs.find((o) => o.id === parentId)?.name ?? `#${parentId}`),
    [orgs],
  );

  const orgOptions = useMemo(
    () => orgs.map((o) => ({ value: o.id, label: `${o.name}（${o.code}）` })),
    [orgs],
  );

  // ── 组织 新建 / 编辑 ──
  const openCreateOrg = (parentId?: number | null) => {
    orgForm.reset();
    if (parentId !== undefined && parentId !== null) orgForm.setValue('parentId', parentId);
    setOrgDraft({ mode: 'create' });
  };

  const openEditOrg = (org: AdminOrg) => {
    orgForm.setValues({
      parentId: org.parentId ?? undefined,
      code: org.code,
      name: org.name,
      type: org.type,
      sortOrder: org.sortOrder,
      description: org.description ?? '',
    });
    setOrgDraft({ mode: 'edit', orgId: org.id });
  };

  const submitOrg = async () => {
    const v = (await orgForm.validate()) as unknown as CreateOrgPayload;
    if (!orgDraft) return;
    setSaving(true);
    try {
      if (orgDraft.mode === 'create') {
        await createOrg(v);
        Toast.success('组织已创建');
      } else if (orgDraft.orgId !== undefined) {
        await updateOrg(orgDraft.orgId, v);
        Toast.success('已保存');
      }
      setOrgDraft(null);
      setDetailOrg(null);
      refresh();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeOrg = async (org: AdminOrg) => {
    try {
      await deleteOrg(org.id);
      Toast.success(`已删除 ${org.name}`);
      setDetailOrg(null);
      setSelectedTreeKey(null);
      refresh();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // ── 岗位 新建 / 编辑 / 删除 ──
  const openCreatePosition = () => {
    if (!detailOrg) return;
    positionForm.reset();
    positionForm.setValue('orgId', detailOrg.id);
    setPositionDraft({ mode: 'create' });
  };

  const openEditPosition = (p: AdminPosition) => {
    positionForm.setValues({
      orgId: p.orgId,
      code: p.code,
      name: p.name,
      level: p.level ?? '',
      description: p.description ?? '',
    });
    setPositionDraft({ mode: 'edit', positionId: p.id });
  };

  const submitPosition = async () => {
    const v = (await positionForm.validate()) as unknown as CreatePositionPayload;
    if (!positionDraft) return;
    setSaving(true);
    try {
      if (positionDraft.mode === 'create') {
        await createPosition(v);
        Toast.success('岗位已创建');
      } else if (positionDraft.positionId !== undefined) {
        const payload: UpdatePositionPayload = {
          name: v.name,
          level: v.level,
          description: v.description,
        };
        await updatePosition(positionDraft.positionId, payload);
        Toast.success('已保存');
      }
      setPositionDraft(null);
      if (detailOrg) void loadPositions(detailOrg.id);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removePosition = async (p: AdminPosition) => {
    try {
      await deletePosition(p.id);
      Toast.success(`已删除 ${p.name}`);
      if (detailOrg) void loadPositions(detailOrg.id);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // ── 人员调岗 ──
  const submitTransfer = async () => {
    const v = (await transferForm.validate()) as unknown as TransferPayload;
    setSaving(true);
    try {
      await transferEmployee(v);
      Toast.success('调岗成功');
      setTransferOpen(false);
      transferForm.reset();
      refresh();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const orgColumns = useMemo(
    () => [
      {
        title: '组织',
        dataIndex: 'name',
        width: 240,
        render: (_: unknown, row: AdminOrg) => (
          <span className="mp-admin-cell">
            <span className="mp-admin-cell-main">
              <span className="mp-admin-cell-title">{row.name}</span>
              <span className="mp-admin-cell-sub">{row.code}</span>
            </span>
          </span>
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 110,
        render: (v: OrgType) => <Tag size="small" type="light">{ORG_TYPE_LABEL[v] ?? v}</Tag>,
      },
      {
        title: '父组织',
        dataIndex: 'parentId',
        width: 200,
        ellipsis: true,
        render: (v: number | null | undefined) => (
          <span className="mp-admin-muted">{parentName(v)}</span>
        ),
      },
      {
        title: '人数',
        dataIndex: 'memberCount',
        width: 90,
        render: (v: number) => <span className="mp-admin-muted">{v ?? 0}</span>,
      },
      {
        title: '岗位',
        dataIndex: 'positionCount',
        width: 90,
        render: (v: number) => <span className="mp-admin-muted">{v ?? 0}</span>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 150,
        render: (_: unknown, row: AdminOrg) => (
          <span className="mp-admin-row-actions">
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => openOrgDetail(row)}
            >
              查看
            </Button>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              icon={<Pencil size={15} strokeWidth={1.5} />}
              onClick={() => openEditOrg(row)}
            >
              编辑
            </Button>
          </span>
        ),
      },
    ],
    // parentName / openOrgDetail / openEditOrg 为稳定闭包，随其读取的状态更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parentName],
  );

  const positionColumns = useMemo(
    () => [
      {
        title: '编码',
        dataIndex: 'code',
        width: 180,
        render: (v: string) => <span className="mp-admin-mono">{v}</span>,
      },
      { title: '名称', dataIndex: 'name', width: 160 },
      {
        title: '级别',
        dataIndex: 'level',
        width: 100,
        render: (v: string | null | undefined) =>
          v ? <Tag size="small" type="light">{v}</Tag> : <span className="mp-admin-faint">—</span>,
      },
      {
        title: '在岗',
        dataIndex: 'holderCount',
        width: 80,
        render: (v: number) => <span className="mp-admin-muted">{v ?? 0}</span>,
      },
      {
        title: '描述',
        dataIndex: 'description',
        ellipsis: true,
        render: (v: string | null | undefined) => (
          <span className="mp-admin-muted">{v || '—'}</span>
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 150,
        render: (_: unknown, row: AdminPosition) => (
          <span className="mp-admin-row-actions">
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Pencil size={15} strokeWidth={1.5} />}
              onClick={() => openEditPosition(row)}
            >
              编辑
            </Button>
            <Popconfirm
              title={`确认删除 ${row.name}？`}
              content="该岗位下的任职关系会一并解除。"
              okType="danger"
              okText="删除"
              cancelText="取消"
              onConfirm={() => void removePosition(row)}
            >
              <Button
                theme="borderless"
                type="danger"
                size="small"
                icon={<Trash2 size={15} strokeWidth={1.5} />}
              >
                删除
              </Button>
            </Popconfirm>
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const treePane = (
    <>
      <div className="mp-pane-title">组织树</div>
      <div className="mp-pane-scroll">
        {treeError ? (
          <div className="mp-pane-block">
            <EmptyState
              illustration="failure"
              title="组织树加载失败"
              desc={treeError}
              actions={
                <Button theme="solid" type="primary" onClick={() => void loadTree()}>
                  重试
                </Button>
              }
            />
          </div>
        ) : treeData.length === 0 && !treeLoading ? (
          <div className="mp-pane-block">
            <EmptyState
              illustration="no-content"
              title="暂无组织"
              desc="点击「新建组织」创建第一个节点。"
            />
          </div>
        ) : (
          <Tree
            treeData={treeData}
            showLine
            value={selectedTreeKey ?? undefined}
            expandedKeys={expandedKeys}
            onExpand={(keys: string[]) => setExpandedKeys(keys)}
            onSelect={(key: string) => onSelectTreeNode(key)}
            renderLabel={(label: unknown, node: unknown) => {
              const n = node as OrgTreeNode;
              return (
                <span className="mp-admin-cell">
                  <span className="mp-admin-cell-title">{String(label)}</span>
                  <Tag type="light">{n.memberCount ?? 0} 人</Tag>
                </span>
              );
            }}
          />
        )}
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title="组织与租户"
        desc={`${stats.total} 个组织 · ${stats.deptCount} 个部门 · ${stats.memberTotal} 名成员`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={treeLoading} onClick={refresh}>
              刷新
            </Button>
            <Button
              icon={<ArrowRightLeft size={15} strokeWidth={1.5} />}
              onClick={() => {
                transferForm.reset();
                setTransferOpen(true);
              }}
            >
              人员调岗
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => openCreateOrg(null)}
            >
              新建组织
            </Button>
          </>
        }
      />

      <div className="mp-admin-kpis">
        <Card>
          <span className="mp-admin-kpi-label">组织总数</span>
          <div className="mp-admin-kpi-value">{stats.total}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">部门数</span>
          <div className="mp-admin-kpi-value">{stats.deptCount}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">在职人数</span>
          <div className="mp-admin-kpi-value">{stats.memberTotal}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">根组织数</span>
          <div className="mp-admin-kpi-value">{stats.rootCount}</div>
        </Card>
      </div>

      <SplitPane ariaLabel="组织与租户" defaultWidth={300} pane={treePane}>
        <FilterBar
          search={{ value: keyword, onChange: setKeyword, placeholder: '搜索组织名称 / 编码…' }}
          filters={
            selectedTreeKey ? (
              <Tag type="light" closable onClose={() => setSelectedTreeKey(null)}>
                仅看该组织子树
              </Tag>
            ) : null
          }
        />
        <DataTablePro<AdminOrg>
          columns={orgColumns}
          dataSource={pagedOrgs}
          rowKey="id"
          loading={orgsLoading}
          pagination={{
            currentPage: page,
            pageSize: PAGE_SIZE,
            total: filteredOrgs.length,
            onChange: setPage,
          }}
          onRow={(record) => ({ onDoubleClick: () => openOrgDetail(record) })}
          empty={
            orgsError ? (
              <EmptyState illustration="failure" title="组织列表加载失败" desc={orgsError} />
            ) : (
              <EmptyState
                illustration="no-result"
                title="没有匹配的组织"
                desc="调整关键词，或在左侧选择其他组织。"
              />
            )
          }
        />
      </SplitPane>

      {/* 组织详情 */}
      <SheetDetail
        title={detailOrg ? `组织详情 · ${detailOrg.name}` : '组织详情'}
        open={detailOrg !== null}
        onClose={() => setDetailOrg(null)}
        width={640}
        footer={
          <>
            {detailOrg ? (
              <Popconfirm
                title={`确认删除 ${detailOrg.name}？`}
                content="子组织将无法保留。"
                okType="danger"
                okText="删除"
                cancelText="取消"
                onConfirm={() => void removeOrg(detailOrg)}
              >
                <Button type="danger" icon={<Trash2 size={15} strokeWidth={1.5} />}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
            <Button onClick={() => setDetailOrg(null)}>关闭</Button>
            {detailOrg ? (
              <>
                <Button icon={<Pencil size={15} strokeWidth={1.5} />} onClick={() => openEditOrg(detailOrg)}>
                  编辑组织
                </Button>
                <Button
                  theme="solid"
                  type="primary"
                  icon={<Plus size={15} strokeWidth={1.5} />}
                  onClick={openCreatePosition}
                >
                  新建岗位
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {detailOrg ? (
          <>
            <Descriptions
              column={1}
              size="small"
              data={[
                { key: '编码', value: <span className="mp-admin-mono">{detailOrg.code}</span> },
                { key: '名称', value: detailOrg.name },
                { key: '类型', value: <Tag type="light">{ORG_TYPE_LABEL[detailOrg.type] ?? detailOrg.type}</Tag> },
                { key: '父组织', value: parentName(detailOrg.parentId) },
                { key: '负责人', value: detailOrg.leaderName || '—' },
                { key: '成员数', value: `${detailOrg.memberCount ?? 0} 人` },
                { key: '岗位数', value: `${detailOrg.positionCount ?? 0} 个` },
                { key: '描述', value: detailOrg.description || '—' },
              ]}
            />
            <div className="mp-admin-section">
              <span className="mp-admin-section-label">岗位（{positions.length}）</span>
              <DataTablePro<AdminPosition>
                columns={positionColumns}
                dataSource={positions}
                rowKey="id"
                loading={positionsLoading}
                empty={
                  positionsError ? (
                    <EmptyState illustration="failure" title="岗位加载失败" desc={positionsError} />
                  ) : (
                    <EmptyState
                      illustration="no-content"
                      title="暂无岗位"
                      desc="为该组织创建第一个岗位。"
                    />
                  )
                }
              />
            </div>
          </>
        ) : null}
      </SheetDetail>

      {/* 组织 新建 / 编辑 */}
      <SheetDetail
        title={orgDraft?.mode === 'edit' ? '编辑组织' : '新建组织'}
        open={orgDraft !== null}
        onClose={() => setOrgDraft(null)}
        footer={
          <>
            <Button onClick={() => setOrgDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitOrg()}>
              保存
            </Button>
          </>
        }
      >
        <div className="mp-admin-form">
          <Form form={orgForm} labelPosition="left" labelWidth={92}>
            <Form.Select
              field="parentId"
              label="父组织"
              showClear
              filter
              disabled={orgDraft?.mode === 'edit'}
              placeholder="无（顶级组织）"
              optionList={orgOptions}
            />
            <Form.Input
              field="code"
              label="编码"
              rules={[{ required: true, min: 1, max: 64, message: '请输入组织编码' }]}
              disabled={orgDraft?.mode === 'edit'}
              placeholder="platform"
            />
            <Form.Input
              field="name"
              label="名称"
              rules={[{ required: true, message: '请输入组织名称' }]}
              placeholder="平台组"
            />
            <Form.Select
              field="type"
              label="类型"
              initValue="DEPARTMENT"
              optionList={ORG_TYPE_OPTIONS}
            />
            <Form.InputNumber field="sortOrder" label="排序" initValue={0} />
            <Form.TextArea field="description" label="描述" autosize={{ minRows: 2 }} />
          </Form>
        </div>
      </SheetDetail>

      {/* 岗位 新建 / 编辑 */}
      <SheetDetail
        title={positionDraft?.mode === 'edit' ? '编辑岗位' : '新建岗位'}
        open={positionDraft !== null}
        onClose={() => setPositionDraft(null)}
        footer={
          <>
            <Button onClick={() => setPositionDraft(null)}>取消</Button>
            <Button
              theme="solid"
              type="primary"
              loading={saving}
              onClick={() => void submitPosition()}
            >
              保存
            </Button>
          </>
        }
      >
        <div className="mp-admin-form">
          <Form form={positionForm} labelPosition="left" labelWidth={92}>
            <Form.Select
              field="orgId"
              label="所属组织"
              rules={[{ required: true, message: '请选择所属组织' }]}
              disabled={positionDraft?.mode === 'edit'}
              optionList={orgOptions}
            />
            <Form.Input
              field="code"
              label="编码"
              rules={[{ required: true, message: '请输入岗位编码' }]}
              disabled={positionDraft?.mode === 'edit'}
              placeholder="backend_engineer"
            />
            <Form.Input
              field="name"
              label="名称"
              rules={[{ required: true, message: '请输入岗位名称' }]}
              placeholder="后端工程师"
            />
            <Form.Input field="level" label="级别" placeholder="如 P6 / M2" />
            <Form.TextArea field="description" label="描述" autosize={{ minRows: 2 }} />
          </Form>
        </div>
      </SheetDetail>

      {/* 人员调岗 */}
      <SheetDetail
        title="人员调岗"
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <Button onClick={() => setTransferOpen(false)}>取消</Button>
            <Button
              theme="solid"
              type="primary"
              loading={saving}
              onClick={() => void submitTransfer()}
            >
              调岗
            </Button>
          </>
        }
      >
        <div className="mp-admin-form">
          <Form form={transferForm} labelPosition="left" labelWidth={112}>
            <Form.InputNumber
              field="userId"
              label="用户 ID"
              rules={[{ required: true, message: '请输入用户 ID' }]}
            />
            <Form.Select
              field="targetOrgId"
              label="目标组织"
              filter
              rules={[{ required: true, message: '请选择目标组织' }]}
              optionList={orgOptions}
            />
            <Form.InputNumber field="targetPositionId" label="目标岗位" />
            <Form.InputNumber field="reportsTo" label="汇报对象 ID" />
            <Form.TextArea field="reason" label="调岗原因" autosize={{ minRows: 2 }} />
          </Form>
        </div>
      </SheetDetail>
    </>
  );
}
