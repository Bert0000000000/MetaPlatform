import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Form,
  Popconfirm,
  Select,
  Tag,
  Toast,
  Upload,
} from '@douyinfe/semi-ui';
import { Download, Plus, RefreshCw, Upload as UploadIcon } from 'lucide-react';
import {
  createUser,
  deleteUser,
  importUsers,
  listRoles,
  listUserLoginLogs,
  listUsers,
  resetUserPassword,
  setUserStatus,
  updateUser,
  usersExportUrl,
  type CreateUserPayload,
  type ListUsersParams,
} from '@/api/admin';
import { apiClient } from '@/api/client';
import type { AdminLoginLog, AdminRole, AdminUser, UserStatus } from '@/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import './admin.css';

const PAGE_SIZE = 20;

/** 只用到 getValues：用最小结构类型承接 Semi 的 formApi，避免深路径 import 与泛型噪声。 */
interface FormApiLike {
  getValues: () => Record<string, unknown>;
}

const STATUS_META: Record<UserStatus, { label: string; color: 'green' | 'grey' | 'red' }> = {
  ACTIVE: { label: '活跃', color: 'green' },
  INACTIVE: { label: '已禁用', color: 'grey' },
  LOCKED: { label: '已锁定', color: 'red' },
};

/** 抽屉形态：新建（无 id）/ 编辑（有 id）。 */
interface Draft {
  id?: number;
  username: string;
  realName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  status: UserStatus;
  isSuperAdmin: boolean;
  roleIds: number[];
}

const EMPTY_DRAFT: Draft = {
  username: '',
  realName: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  status: 'ACTIVE',
  isSuperAdmin: false,
  roleIds: [],
};

/**
 * 平台管理 · 用户与权限（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 抽屉表单）。
 * 数据面沿用 src/api/admin/*，服务端分页。
 *
 * 说明：原型抽屉里的「启用 MFA」开关没有对应后端字段（CreateUserPayload /
 * UpdateUserPayload 都没有 mfa），这里不画假开关；跨租户语义由真实的 isSuperAdmin 承载。
 */
export default function UsersPage() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [roleId, setRoleId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AdminLoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const formApi = useRef<FormApiLike | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params: ListUsersParams = {
      keyword: keyword || undefined,
      status,
      roleId,
      page,
      pageSize,
    };
    try {
      const res = await listUsers(params);
      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [keyword, status, roleId, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listRoles({ pageSize: 200 })
      .then((r) => setRoles(r.items ?? []))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [keyword, status, roleId]);

  const roleName = useCallback(
    (id: number) => roles.find((r) => r.id === id)?.name ?? `#${id}`,
    [roles],
  );

  const openCreate = () => {
    setDraft({ ...EMPTY_DRAFT });
    setLogs([]);
  };

  const openEdit = useCallback(async (user: AdminUser) => {
    setDraft({
      id: user.id,
      username: user.username,
      realName: user.realName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      department: user.department ?? '',
      position: user.position ?? '',
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      roleIds: user.roleIds ?? [],
    });
    setLogsLoading(true);
    try {
      const res = await listUserLoginLogs(user.id, 1, 10);
      setLogs(res.items ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const closeDrawer = () => setDraft(null);

  const submit = async () => {
    const values = formApi.current?.getValues() as unknown as Draft | undefined;
    if (!draft || !values) return;
    setSaving(true);
    try {
      if (draft.id === undefined) {
        const payload: CreateUserPayload = {
          username: values.username,
          realName: values.realName || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          department: values.department || undefined,
          position: values.position || undefined,
          status: values.status,
          isSuperAdmin: values.isSuperAdmin,
          roleIds: values.roleIds,
        };
        const created = await createUser(payload);
        Toast.success(`已创建 ${created.username}，初始密码 ${created.initialPassword}`);
      } else {
        await updateUser(draft.id, {
          realName: values.realName || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          department: values.department || undefined,
          position: values.position || undefined,
          status: values.status,
          isSuperAdmin: values.isSuperAdmin,
          roleIds: values.roleIds,
        });
        Toast.success('已保存');
      }
      closeDrawer();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: AdminUser) => {
    const next: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await setUserStatus(user.id, next);
      Toast.success(next === 'ACTIVE' ? '已启用' : '已禁用');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const resetPassword = async (id: number) => {
    try {
      const r = await resetUserPassword(id);
      Toast.success(`临时密码：${r.temporaryPassword}`);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const removeUser = async (id: number) => {
    try {
      await deleteUser(id);
      Toast.success('已删除');
      closeDrawer();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  /** 导出走鉴权 blob（裸 window.open 不带 Bearer，会被 401 挡掉）。 */
  const exportUsers = async () => {
    try {
      const res = await apiClient.get<Blob>(usersExportUrl(), { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('已导出清单');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const importFile = async (file: File) => {
    try {
      const r = await importUsers(file);
      Toast.success(`导入完成：新增 ${r.created}，跳过 ${r.skipped}`);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '用户',
        dataIndex: 'username',
        width: 260,
        render: (_: unknown, row: AdminUser) => (
          <span className="mp-admin-cell">
            <Avatar size="extra-small" color="blue">
              {(row.realName ?? row.username).slice(0, 1)}
            </Avatar>
            <span className="mp-admin-cell-main">
              <span className="mp-admin-cell-title">{row.realName ?? row.username}</span>
              <span className="mp-admin-cell-sub">{row.email ?? `@${row.username}`}</span>
            </span>
          </span>
        ),
      },
      {
        title: '角色',
        dataIndex: 'roleIds',
        width: 240,
        render: (_: unknown, row: AdminUser) => (
          <span className="mp-admin-chips">
            {(row.roleIds ?? []).slice(0, 3).map((id) => (
              <Tag key={id} size="small" type="light">
                {roleName(id)}
              </Tag>
            ))}
            {(row.roleIds ?? []).length > 3 ? (
              <Tag size="small" type="light">
                +{row.roleIds.length - 3}
              </Tag>
            ) : null}
            {row.isSuperAdmin ? (
              <Tag color="amber" size="small" type="light">
                超级管理员
              </Tag>
            ) : null}
          </span>
        ),
      },
      {
        title: '部门',
        dataIndex: 'department',
        width: 150,
        ellipsis: true,
        render: (v: string | null | undefined) => <span className="mp-admin-muted">{v || '—'}</span>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: UserStatus) => (
          <Tag color={STATUS_META[v]?.color ?? 'grey'} size="small" type="light">
            {STATUS_META[v]?.label ?? v}
          </Tag>
        ),
      },
      {
        title: '最近登录',
        dataIndex: 'lastLoginAt',
        width: 200,
        ellipsis: true,
        render: (_: unknown, row: AdminUser) => (
          <span className="mp-admin-faint">
            {row.lastLoginAt
              ? `${row.lastLoginAt}${row.lastLoginIp ? ` · ${row.lastLoginIp}` : ''}`
              : '从未登录'}
          </span>
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 150,
        render: (_: unknown, row: AdminUser) => (
          <span className="mp-admin-row-actions">
            <Button theme="borderless" type="primary" size="small" onClick={() => void openEdit(row)}>
              编辑
            </Button>
            <Button theme="borderless" type="tertiary" size="small" onClick={() => void toggleStatus(row)}>
              {row.status === 'ACTIVE' ? '禁用' : '启用'}
            </Button>
          </span>
        ),
      },
    ],
    [openEdit, roleName],
  );

  return (
    <>
      <PageHeader
        title="用户与权限"
        desc={
          roles.length
            ? `${total} 名用户 · ${roles.length} 个角色 · 身份由 Keycloak 提供`
            : `${total} 名用户 · 身份由 Keycloak 提供`
        }
        actions={
          <>
            <Upload
              accept=".csv"
              showUploadList={false}
              action="#"
              beforeUpload={({ file }) => {
                const instance = file.fileInstance;
                if (instance) void importFile(instance);
                return false;
              }}
            >
              <Button icon={<UploadIcon size={15} strokeWidth={1.5} />}>批量导入</Button>
            </Upload>
            <Button icon={<Download size={15} strokeWidth={1.5} />} onClick={() => void exportUsers()}>
              导出清单
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={openCreate}
            >
              新建用户
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索用户名、邮箱…' }}
        filters={
          <>
            <Select
              value={roleId === undefined ? '' : String(roleId)}
              onChange={(v) => setRoleId(v ? Number(v) : undefined)}
              placeholder="全部角色"
            >
              <Select.Option value="">全部角色</Select.Option>
              {roles.map((r) => (
                <Select.Option key={r.id} value={String(r.id)}>
                  {r.name}
                </Select.Option>
              ))}
            </Select>
            <Select value={status} onChange={(v) => setStatus(v as UserStatus | '')} placeholder="全部状态">
              <Select.Option value="">全部状态</Select.Option>
              {(Object.keys(STATUS_META) as UserStatus[]).map((s) => (
                <Select.Option key={s} value={s}>
                  {STATUS_META[s].label}
                </Select.Option>
              ))}
            </Select>
          </>
        }
        right={
          <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
            刷新
          </Button>
        }
      />

      <DataTablePro<AdminUser>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
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
            <EmptyState illustration="failure" title="用户列表加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的用户"
              desc="调整关键词或筛选条件，或新建一个用户。"
            />
          )
        }
      />

      <SheetDetail
        title={draft?.id === undefined ? '新建用户' : `编辑用户 · ${draft?.username ?? ''}`}
        open={draft !== null}
        onClose={closeDrawer}
        footer={
          <>
            {draft?.id !== undefined ? (
              <>
                <Button onClick={() => void resetPassword(draft.id as number)}>重置密码</Button>
                <Popconfirm
                  title="确认删除该用户？"
                  content="删除后该账号立即失效，操作会写入审计日志。"
                  onConfirm={() => void removeUser(draft.id as number)}
                >
                  <Button type="danger">删除</Button>
                </Popconfirm>
              </>
            ) : null}
            <Button onClick={closeDrawer}>取消</Button>
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
                username: draft.username,
                realName: draft.realName,
                email: draft.email,
                phone: draft.phone,
                department: draft.department,
                position: draft.position,
                status: draft.status,
                isSuperAdmin: draft.isSuperAdmin,
                roleIds: draft.roleIds,
              }}
              labelPosition="left"
              labelWidth={92}
            >
              <Form.Input
                field="username"
                label="用户名"
                disabled={draft.id !== undefined}
                rules={[{ required: draft.id === undefined, message: '请输入用户名' }]}
                placeholder="zhang.san"
              />
              <Form.Input field="realName" label="姓名" placeholder="张三" />
              <Form.Input field="email" label="邮箱" placeholder="zhang.san@metaplatform.io" />
              <Form.Input field="phone" label="手机" placeholder="选填" />
              <Form.Input field="department" label="部门" placeholder="平台组" />
              <Form.Input field="position" label="职位" placeholder="选填" />
              <Form.Select field="status" label="状态">
                {(Object.keys(STATUS_META) as UserStatus[]).map((s) => (
                  <Select.Option key={s} value={s}>
                    {STATUS_META[s].label}
                  </Select.Option>
                ))}
              </Form.Select>
              <Form.Select field="roleIds" label="角色" multiple placeholder="选择角色">
                {roles.map((r) => (
                  <Select.Option key={r.id} value={r.id}>
                    {r.name}
                  </Select.Option>
                ))}
              </Form.Select>
              <Form.Switch
                field="isSuperAdmin"
                label="超级管理员"
                extraText="isSuperAdmin · 可跨租户管理，仅平台管理员可授予"
              />
            </Form>

            {draft.id !== undefined ? (
              <div className="mp-admin-section">
                <span className="mp-admin-section-label">最近登录记录</span>
                {logsLoading ? (
                  <span className="mp-admin-faint">加载中…</span>
                ) : logs.length === 0 ? (
                  <span className="mp-admin-faint">暂无登录记录</span>
                ) : (
                  <ul className="mp-admin-list">
                    {logs.map((log) => (
                      <li key={log.id} className="mp-admin-list-item">
                        <span>
                          {log.result === 'SUCCESS'
                            ? '登录成功'
                            : `登录失败${log.failureReason ? ` · ${log.failureReason}` : ''}`}
                          {log.ip ? ` · ${log.ip}` : ''}
                        </span>
                        <span className="mp-admin-list-time">{log.occurredAt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetDetail>
    </>
  );
}
