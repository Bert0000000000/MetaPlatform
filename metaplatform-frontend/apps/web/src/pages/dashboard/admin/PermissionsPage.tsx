import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Popconfirm,
  Select,
  Tabs,
  Tag,
  Toast,
} from '@douyinfe/semi-ui';
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  assignPermissions,
  createRole,
  deleteRole,
  getPermissionMatrix,
  getRoleDetail,
  listPermissionCatalog,
  listRoles,
  updateRole,
  type CreateRolePayload,
} from '@/api/admin/permissions';
import type {
  AdminPermission,
  AdminRole,
  AdminRoleDetail,
  PermissionMatrixResponse,
} from '@/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import { CatalogEditor } from './CatalogEditor';
import { formatDateTime } from '@/utils/datetime';
import { useSettings } from '@/contexts/SettingsContext';
import './admin.css';

const PAGE_SIZE = 20;

const DATA_SCOPE_LABEL: Record<string, string> = {
  ALL: '全部数据',
  DEPT: '本部门',
  DEPT_AND_SUB: '本部门及子部门',
  SELF: '仅本人',
  CUSTOM: '自定义',
};

const DATA_SCOPE_OPTIONS = Object.entries(DATA_SCOPE_LABEL).map(([value, label]) => ({ value, label }));

/** 只用到 getValues / setValues：用最小结构类型承接 Semi 的 formApi，避免深路径 import 与泛型噪声。 */
interface FormApiLike {
  getValues: () => Record<string, unknown>;
  setValues: (values: Record<string, unknown>) => void;
}

/** 抽屉形态：新建（无 id）/ 编辑（有 id）。 */
interface Draft {
  id?: number;
  code: string;
  name: string;
  description: string;
  dataScope: string;
  permissionIds: number[];
}

const EMPTY_DRAFT: Draft = {
  code: '',
  name: '',
  description: '',
  dataScope: 'SELF',
  permissionIds: [],
};

/** 权限矩阵的行：matrix.roles 的元素。 */
interface MatrixRoleRow {
  id: number;
  code: string;
  name: string;
  isBuiltin: boolean;
}

type TabKey = 'roles' | 'catalog' | 'matrix';

type AdminTableColumn = React.ComponentProps<typeof DataTablePro<AdminRole>>['columns'][number];

/**
 * 平台管理 · 权限管理（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 分页，新建/编辑走右侧抽屉）。
 * 数据面沿用 src/api/admin/permissions，未新增后端契约。
 *
 * 说明：权限矩阵改为 DataTablePro（列 = 权限）而不是自绘 <table>，
 * 用冻结骨架接管滚动/列宽/列显隐；勾选语义不变。
 */
export default function PermissionsPage() {
  const { settings } = useSettings();

  const [tab, setTab] = useState<TabKey>('roles');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [catalog, setCatalog] = useState<AdminPermission[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState('');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [detail, setDetail] = useState<AdminRoleDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const formApi = useRef<FormApiLike | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await listRoles({ keyword: keyword || undefined, page, pageSize });
      setRoles(r.items ?? []);
      setTotal(r.total ?? 0);
    } catch (e) {
      setRoles([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [keyword, page, pageSize]);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await listPermissionCatalog());
    } catch {
      setCatalog([]);
    }
  }, []);

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    setMatrixError('');
    try {
      setMatrix(await getPermissionMatrix());
    } catch (e) {
      setMatrix(null);
      setMatrixError(e instanceof Error ? e.message : String(e));
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    void loadRoles();
    void loadCatalog();
    void loadMatrix();
  }, [loadRoles, loadCatalog, loadMatrix]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadCatalog();
    void loadMatrix();
  }, [loadCatalog, loadMatrix]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  // ── 矩阵：单元格查找（后端可能回 snake_case，做一次容错）──
  const matrixCells = useCallback(
    (): Array<{ roleId: number; permissionId: number; granted: boolean }> => {
      const raw = matrix as unknown as { matrix?: Array<Record<string, unknown>> } | null;
      const cells: Array<{ roleId: number; permissionId: number; granted: boolean }> = [];
      for (const cell of raw?.matrix ?? []) {
        const roleId = Number(cell.roleId ?? cell.role_id);
        const permissionId = Number(cell.permissionId ?? cell.permission_id);
        if (!Number.isFinite(roleId) || !Number.isFinite(permissionId)) continue;
        cells.push({ roleId, permissionId, granted: Boolean(cell.granted) });
      }
      return cells;
    },
    [matrix],
  );

  const matrixMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of matrixCells()) m.set(`${c.roleId}:${c.permissionId}`, c.granted);
    return m;
  }, [matrixCells]);

  const grantedForRole = useCallback(
    (roleId: number): number[] =>
      matrixCells()
        .filter((c) => c.roleId === roleId && c.granted)
        .map((c) => c.permissionId),
    [matrixCells],
  );

  const toggleMatrixCell = async (roleId: number, permissionId: number, granted: boolean) => {
    try {
      const current = grantedForRole(roleId);
      const next = granted
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId];
      await assignPermissions({ type: 'role', targetId: roleId, permissionIds: next });
      Toast.success(granted ? '已撤销权限' : '已授予权限');
      await Promise.all([loadMatrix(), loadRoles()]);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // ── 详情 / 编辑 / 删除 ──
  const openDetail = async (role: AdminRole) => {
    try {
      setDetail(await getRoleDetail(role.id));
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openCreate = () => {
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEdit = async (role: AdminRole) => {
    setDraft({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      dataScope: role.dataScope,
      permissionIds: [],
    });
    try {
      const d = await getRoleDetail(role.id);
      const permissionIds = d.permissions.map((p) => p.id);
      setDraft((prev) => (prev ? { ...prev, permissionIds } : prev));
      formApi.current?.setValues({ permissionIds });
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const closeDraft = () => setDraft(null);
  const closeDetail = () => setDetail(null);

  const submit = async () => {
    const values = formApi.current?.getValues();
    if (!draft || !values) return;
    const name = String(values.name ?? '');
    const description = String(values.description ?? '');
    const dataScope = String(values.dataScope ?? 'SELF');
    const permissionIds = (values.permissionIds as number[] | undefined) ?? [];
    setSaving(true);
    try {
      if (draft.id === undefined) {
        const payload: CreateRolePayload = {
          code: String(values.code ?? ''),
          name,
          description,
          dataScope,
          permissionIds,
        };
        await createRole(payload);
        Toast.success('角色已创建');
      } else {
        await updateRole(draft.id, { name, description, dataScope, permissionIds });
        Toast.success('已保存');
      }
      closeDraft();
      await Promise.all([loadRoles(), loadMatrix()]);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (id: number, name: string) => {
    try {
      await deleteRole(id);
      Toast.success(`已删除 ${name}`);
      closeDraft();
      await Promise.all([loadRoles(), loadMatrix()]);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // ── KPI ──
  const builtinCount = roles.filter((r) => r.isBuiltin).length;
  const customCount = roles.length - builtinCount;
  const permissionTotalCount = useMemo(
    () =>
      catalog.length ? catalog.length : roles.reduce((sum, r) => sum + (r.permissionCount ?? 0), 0),
    [catalog, roles],
  );

  const roleColumns = useMemo(
    () => [
      {
        title: '编码',
        dataIndex: 'code',
        width: 200,
        render: (v: string) => <span className="mp-admin-mono">{v}</span>,
      },
      {
        title: '名称',
        dataIndex: 'name',
        width: 220,
        render: (_: unknown, row: AdminRole) => (
          <span className="mp-admin-cell">
            <span className="mp-admin-cell-main">
              <span className="mp-admin-cell-title">{row.name}</span>
              <span className="mp-admin-cell-sub">{row.description || '—'}</span>
            </span>
            {row.isBuiltin ? (
              <Tag size="small" color="purple" type="light">
                内置
              </Tag>
            ) : null}
          </span>
        ),
      },
      {
        title: '数据范围',
        dataIndex: 'dataScope',
        width: 160,
        render: (v: string) => (
          <Tag size="small" type="light">{DATA_SCOPE_LABEL[v] ?? v}</Tag>
        ),
      },
      {
        title: '权限数',
        dataIndex: 'permissionCount',
        width: 100,
        render: (v: number) => (
          <Tag size="small" color="blue" type="light">
            {v ?? 0}
          </Tag>
        ),
      },
      {
        title: '用户数',
        dataIndex: 'userCount',
        width: 100,
        render: (v: number) => (
          <Tag size="small" type="light">{v ?? 0}</Tag>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 180,
        ellipsis: true,
        render: (v: string) => <span className="mp-admin-faint">{formatDateTime(v, settings)}</span>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 220,
        render: (_: unknown, row: AdminRole) => (
          <span className="mp-admin-row-actions">
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Eye size={15} strokeWidth={1.5} />}
              onClick={() => void openDetail(row)}
            >
              查看
            </Button>
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              icon={<Pencil size={15} strokeWidth={1.5} />}
              onClick={() => void openEdit(row)}
            >
              编辑
            </Button>
            {row.isBuiltin ? (
              <Button theme="borderless" type="tertiary" size="small" disabled>
                删除
              </Button>
            ) : (
              <Popconfirm
                title={`确认删除 ${row.name}？`}
                content="该角色下的用户绑定关系也会一并解除。"
                okType="danger"
                okText="删除"
                cancelText="取消"
                onConfirm={() => void removeRole(row.id, row.name)}
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
            )}
          </span>
        ),
      },
    ],
    // openDetail / openEdit 为闭包内的稳定调用，依赖跟随其读取的状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings],
  );

  const matrixColumns = useMemo<AdminTableColumn[]>(() => {
    const permissions = matrix?.permissions ?? [];
    const permColumns: AdminTableColumn[] = permissions.map((p) => ({
      title: p.code,
      key: `perm-${p.id}`,
      width: 120,
      render: (_: unknown, row: MatrixRoleRow) => {
        const granted = matrixMap.get(`${row.id}:${p.id}`) === true;
        return (
          <Checkbox
            checked={granted}
            disabled={row.isBuiltin}
            onChange={() => void toggleMatrixCell(row.id, p.id, granted)}
            aria-label={`${row.name} · ${p.code}`}
          />
        );
      },
    }));
    return [
      {
        title: '角色 / 权限',
        dataIndex: 'name',
        key: 'role-name',
        width: 200,
        fixed: 'left',
        render: (_: unknown, row: MatrixRoleRow) => (
          <span className="mp-admin-cell">
            <span className="mp-admin-cell-title">{row.name}</span>
            {row.isBuiltin ? (
              <Tag size="small" color="purple" type="light">
                内置
              </Tag>
            ) : null}
          </span>
        ),
      },
      ...permColumns,
    ];
  }, [matrix, matrixMap]);

  const catalogOptions = useMemo(
    () => catalog.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [catalog],
  );

  return (
    <>
      <PageHeader
        title="权限管理"
        desc={`${total} 个角色 · ${permissionTotalCount} 项权限 · 数据范围决定可见数据的边界`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} onClick={refreshAll}>
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={openCreate}
            >
              新建角色
            </Button>
          </>
        }
      />

      <div className="mp-admin-kpis">
        <Card>
          <span className="mp-admin-kpi-label">角色总数</span>
          <div className="mp-admin-kpi-value">{total}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">权限总数</span>
          <div className="mp-admin-kpi-value">{permissionTotalCount}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">内置角色</span>
          <div className="mp-admin-kpi-value">{builtinCount}</div>
        </Card>
        <Card>
          <span className="mp-admin-kpi-label">自定义角色</span>
          <div className="mp-admin-kpi-value">{customCount}</div>
        </Card>
      </div>

      <Tabs activeKey={tab} onChange={(k) => setTab(k as TabKey)}>
        <Tabs.TabPane itemKey="roles" tab="角色">
          <FilterBar
            search={{ value: keyword, onChange: setKeyword, placeholder: '搜索角色编码 / 名称…' }}
          />
          <DataTablePro<AdminRole>
            columns={roleColumns}
            dataSource={roles}
            rowKey="id"
            loading={loading}
            pagination={{
          currentPage: page,
          pageSize,
          total,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
            onRow={(record) => ({ onDoubleClick: () => void openEdit(record) })}
            empty={
              error ? (
                <EmptyState illustration="failure" title="角色列表加载失败" desc={error} />
              ) : (
                <EmptyState
                  illustration="no-result"
                  title="没有匹配的角色"
                  desc="调整关键词，或新建一个角色。"
                />
              )
            }
          />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="catalog" tab="权限目录">
          <CatalogEditor
            catalog={catalog}
            roles={roles}
            onSave={async (roleId, permissionIds) => {
              try {
                await assignPermissions({ type: 'role', targetId: roleId, permissionIds });
                Toast.success('权限已保存');
                await Promise.all([loadRoles(), loadMatrix()]);
              } catch (e) {
                Toast.error(e instanceof Error ? e.message : String(e));
              }
            }}
            onRefresh={() => void loadCatalog()}
          />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="matrix" tab="权限矩阵">
          <DataTablePro<MatrixRoleRow>
            columns={matrixColumns}
            dataSource={matrix?.roles ?? []}
            rowKey="id"
            loading={matrixLoading}
            scroll={{ x: 'max-content', y: 520 }}
            empty={
              matrixError ? (
                <EmptyState illustration="failure" title="权限矩阵加载失败" desc={matrixError} />
              ) : (
                <EmptyState
                  illustration="no-content"
                  title="暂无权限矩阵"
                  desc="先创建角色与权限，矩阵会在这里逐格呈现。"
                />
              )
            }
          />
        </Tabs.TabPane>
      </Tabs>

      <SheetDetail
        title={draft?.id === undefined ? '新建角色' : `编辑角色 · ${draft?.name ?? ''}`}
        open={draft !== null}
        onClose={closeDraft}
        footer={
          <>
            {draft?.id !== undefined ? (
              <Popconfirm
                title="确认删除该角色？"
                content="该角色下的用户绑定关系也会一并解除，操作会写入审计日志。"
                okType="danger"
                okText="删除"
                cancelText="取消"
                onConfirm={() => {
                  if (draft?.id !== undefined) void removeRole(draft.id, draft.name);
                }}
              >
                <Button type="danger" icon={<Trash2 size={15} strokeWidth={1.5} />}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
            <Button onClick={closeDraft}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="mp-admin-form">
            <Form
              key={draft.id ?? 'new'}
              getFormApi={(api) => {
                formApi.current = api as unknown as FormApiLike;
              }}
              initValues={{
                code: draft.code,
                name: draft.name,
                description: draft.description,
                dataScope: draft.dataScope,
                permissionIds: draft.permissionIds,
              }}
              labelPosition="left"
              labelWidth={92}
            >
              <Form.Input
                field="code"
                label="角色编码"
                disabled={draft.id !== undefined}
                rules={[{ required: draft.id === undefined, message: '请输入角色编码' }]}
                placeholder="建议大写字母 + 下划线"
              />
              <Form.Input
                field="name"
                label="显示名"
                rules={[{ required: true, message: '请输入显示名' }]}
                placeholder="平台管理员"
              />
              <Form.TextArea field="description" label="描述" autosize={{ minRows: 2 }} />
              <Form.Select
                field="dataScope"
                label="数据范围"
                optionList={DATA_SCOPE_OPTIONS}
                placeholder="选择数据范围"
              />
              <Form.Select
                field="permissionIds"
                label="权限"
                multiple
                filter
                placeholder="选择权限"
                optionList={catalogOptions}
              />
            </Form>
            <span className="mp-admin-faint">
              数据范围决定该角色可见的数据边界；内置角色的权限不可修改。
            </span>
          </div>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={detail ? `角色详情 · ${detail.name}` : '角色详情'}
        open={detail !== null}
        onClose={closeDetail}
        footer={
          <>
            <Button onClick={closeDetail}>关闭</Button>
            {detail ? (
              <Button
                theme="solid"
                type="primary"
                icon={<Pencil size={15} strokeWidth={1.5} />}
                onClick={() => {
                  closeDetail();
                  void openEdit(detail);
                }}
              >
                编辑
              </Button>
            ) : null}
          </>
        }
      >
        {detail ? (
          <>
            <Descriptions
              column={1}
              size="small"
              data={[
                { key: '编码', value: <span className="mp-admin-mono">{detail.code}</span> },
                { key: '名称', value: detail.name },
                { key: '描述', value: detail.description || '—' },
                {
                  key: '数据范围',
                  value: <Tag type="light">{DATA_SCOPE_LABEL[detail.dataScope] ?? detail.dataScope}</Tag>,
                },
                { key: '内置', value: detail.isBuiltin ? '是' : '否' },
              ]}
            />
            <div className="mp-admin-section">
              <span className="mp-admin-section-label">权限（{detail.permissions.length}）</span>
              {detail.permissions.length === 0 ? (
                <span className="mp-admin-faint">该角色暂未授予任何权限。</span>
              ) : (
                <span className="mp-admin-chips">
                  {detail.permissions.map((p) => (
                    <Tag key={p.id} type="light">
                      {p.code}
                    </Tag>
                  ))}
                </span>
              )}
            </div>
          </>
        ) : (
          <EmptyState illustration="idle" title="加载中…" desc="正在读取角色详情。" />
        )}
      </SheetDetail>
    </>
  );
}
