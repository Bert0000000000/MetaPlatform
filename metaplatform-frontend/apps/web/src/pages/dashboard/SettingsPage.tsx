import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  RadioGroup,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Copy, Monitor, Moon, Plus, RefreshCw, Sun, Trash2 } from 'lucide-react';
import {
  createApiToken,
  getActiveSessions,
  getApiTokens,
  revokeApiToken,
  revokeSession,
} from '@/api/settings';
import { getCurrentUser, getCurrentUserPermissions } from '@/api/user';
import type {
  ActiveSession,
  ApiToken,
  ThemeMode,
  UserPermissionDetail,
  UserPermissions,
  UserProfile,
  UserSettings,
} from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { formatDateTime } from '@/utils/datetime';
import { DataTablePro, EmptyState, PageHeader, SheetDetail } from '@/components/skeleton';
import './home.css';

const { Text } = Typography;

const WIDGET_OPTIONS = [
  { label: '指标面板', value: 'metrics' },
  { label: '待办审批', value: 'approvals' },
  { label: '数字员工状态', value: 'workers' },
  { label: '通知消息', value: 'notifications' },
];

const LANGUAGE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const TIMEZONE_OPTIONS = [
  { label: 'Asia/Shanghai (UTC+8)', value: 'Asia/Shanghai' },
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York (UTC-5)', value: 'America/New_York' },
  { label: 'Europe/London (UTC+0)', value: 'Europe/London' },
  { label: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo' },
];

const DATE_FORMAT_OPTIONS = [
  { label: '2026-07-18 14:30:25 (YYYY-MM-DD HH:mm:ss)', value: 'YYYY-MM-DD HH:mm:ss' },
  { label: '2026/07/18 14:30 (YYYY/MM/DD HH:mm)', value: 'YYYY/MM/DD HH:mm' },
  { label: '18/07/2026 14:30:25 (DD/MM/YYYY HH:mm:ss)', value: 'DD/MM/YYYY HH:mm:ss' },
  { label: 'Jul 18, 2026 2:30 PM', value: 'MMM DD, YYYY h:mm A' },
];

const DEFAULT_PAGE_OPTIONS = [
  { label: '工作台', value: '/dashboard' },
  { label: '消息中心', value: '/notifications' },
  { label: '历史交付物', value: '/deliverables' },
];

/** 主题选择：走 Semi RadioGroup 的 card 形态（官方卡片单选），不自绘缩略图。 */
const THEME_OPTIONS = [
  {
    value: 'light',
    label: (
      <>
        <Sun size={14} strokeWidth={1.5} /> 浅色
      </>
    ),
    extra: '明亮清爽，适合白天使用',
  },
  {
    value: 'dark',
    label: (
      <>
        <Moon size={14} strokeWidth={1.5} /> 深色
      </>
    ),
    extra: '护眼沉浸，适合夜间使用',
  },
  {
    value: 'system',
    label: (
      <>
        <Monitor size={14} strokeWidth={1.5} /> 跟随系统
      </>
    ),
    extra: '随操作系统自动切换',
  },
];

const DATA_SCOPE_LABEL: Record<string, string> = {
  ALL: '全部数据',
  DEPT: '本部门',
  DEPT_AND_SUB: '本部门及子部门',
  SELF: '仅本人',
  CUSTOM: '自定义',
};

/** 权限分组表的列与分组无关，提到模块级，避免每次渲染重建。 */
const PERMISSION_COLUMNS = [
  {
    title: '权限编码',
    dataIndex: 'permissionCode',
    key: 'permissionCode',
    width: 260,
    render: (v: string) => <Text code>{v}</Text>,
  },
  { title: '名称', dataIndex: 'permissionName', key: 'permissionName', width: 220 },
  {
    title: '操作',
    dataIndex: 'actions',
    key: 'actions',
    width: 240,
    render: (actions: string[]) => (
      <Space wrap>
        {actions.map((a) => (
          <Tag key={a} type="light">
            {a}
          </Tag>
        ))}
      </Space>
    ),
  },
  {
    title: '效果',
    dataIndex: 'effect',
    key: 'effect',
    width: 100,
    render: (effect: string) => (
      <Tag color={effect === 'DENY' ? 'red' : 'green'} type="light">
        {effect}
      </Tag>
    ),
  },
];

/** 将权限按 resourceType 分组，便于按模块展示。 */
function groupPermissionsByResource(
  permissions: UserPermissionDetail[],
): Array<{ resourceType: string; items: UserPermissionDetail[] }> {
  const map = new Map<string, UserPermissionDetail[]>();
  for (const p of permissions) {
    const key = p.resourceType || 'OTHER';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resourceType, items]) => ({ resourceType, items }));
}

/**
 * 我的 · 个人中心（DESIGN-SPEC §5 版式 E：页头 + 分区卡片 + 表格 + 抽屉表单）。
 *
 * 数据全部来自 src/api/settings + src/api/user，与旧页一一对应：
 *  - 个人资料   = getCurrentUser()
 *  - 权限与角色 = getCurrentUserPermissions()
 *  - API 令牌   = getApiTokens / createApiToken / revokeApiToken（新建走 SheetDetail 表单）
 *  - 活动会话   = getActiveSessions / revokeSession
 *  - 外观/语言/偏好 = SettingsContext（setTheme / updateSettings），
 *    body[theme-mode] 仍是主题的唯一事实源，本页不直接改 DOM。
 */
export default function SettingsPage() {
  const { settings, resolvedTheme, updateSettings, setTheme } = useSettings();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [regionForm] = Form.useForm<UserSettings>();
  const [prefsForm] = Form.useForm<UserSettings>();
  const [tokenForm] = Form.useForm<{ name: string }>();

  const loadTokensAndSessions = async () => {
    setSecurityLoading(true);
    try {
      const [t, sess] = await Promise.all([getApiTokens(), getActiveSessions()]);
      setTokens(t);
      setSessions(sess);
    } finally {
      setSecurityLoading(false);
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      setProfile(await getCurrentUser());
    } finally {
      setProfileLoading(false);
    }
  };

  const loadPermissions = async () => {
    setPermissionsLoading(true);
    try {
      setPermissions(await getCurrentUserPermissions());
    } finally {
      setPermissionsLoading(false);
    }
  };

  // 挂载时并行加载 tokens / sessions / profile / permissions，避免分区空白。
  // 单个请求失败由全局 axios 拦截器统一报错，不影响其他分区。
  useEffect(() => {
    void loadTokensAndSessions();
    void loadProfile();
    void loadPermissions();
  }, []);

  useEffect(() => {
    regionForm.setValues(settings);
    prefsForm.setValues(settings);
  }, [settings, regionForm, prefsForm]);

  const reloadAll = () => {
    void loadTokensAndSessions();
    void loadProfile();
    void loadPermissions();
  };

  const handleSavePreferences = async (values: Partial<UserSettings>) => {
    await updateSettings(values);
    Toast.success('设置已保存并即时生效');
  };

  const handleThemeChange = async (next: ThemeMode) => {
    await setTheme(next);
    const label = next === 'system' ? '跟随系统' : next === 'dark' ? '深色' : '浅色';
    Toast.success(`已切换到「${label}」主题，全局即时生效`);
  };

  const handleCreateToken = async (values: { name?: string }) => {
    const name = values.name?.trim();
    if (!name) {
      Toast.warning('请输入 Token 名称');
      return;
    }
    setCreating(true);
    try {
      const token = await createApiToken(name);
      setCreatedToken(token.token);
      setTokens((prev) => [token, ...prev]);
      setTokenSheetOpen(false);
      tokenForm.reset();
      Toast.success('Token 创建成功');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    await revokeApiToken(id);
    setTokens((prev) => prev.filter((t) => t.id !== id));
    Toast.success('Token 已撤销');
  };

  const handleRevokeSession = async (id: string) => {
    await revokeSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    Toast.success('会话已注销');
  };

  const copyToken = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => Toast.success('已复制到剪贴板'));
  };

  const tokenColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: 'Token',
      dataIndex: 'token',
      key: 'token',
      width: 220,
      ellipsis: true,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (v: string) => formatDateTime(v, settings),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 200,
      render: (v?: string) => (v ? formatDateTime(v, settings) : '—'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: ApiToken) => (
        <Popconfirm title="确认撤销此 Token？" onConfirm={() => void handleRevokeToken(record.id)}>
          <Button
            theme="borderless"
            type="danger"
            size="small"
            icon={<Trash2 size={14} strokeWidth={1.5} />}
          >
            撤销
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const previewDate = new Date().toISOString();
  const displayName = profile?.realName || profile?.username || '—';
  const initials = displayName.charAt(0).toUpperCase();
  const permissionGroups = permissions ? groupPermissionsByResource(permissions.permissions) : [];
  const busy = profileLoading || permissionsLoading || securityLoading;

  return (
    <>
      <PageHeader
        title="我的"
        desc="账号资料、外观与区域偏好、API 令牌与活动会话。"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={busy}
            onClick={reloadAll}
          >
            刷新
          </Button>
        }
      />

      <div className="mp-home-col">
        <Card
          title="个人资料"
          loading={profileLoading}
          headerExtraContent={
            <Button size="small" icon={<RefreshCw size={14} strokeWidth={1.5} />} onClick={() => void loadProfile()}>
              重新加载
            </Button>
          }
        >
          {profile ? (
            <div className="mp-home-col">
              <div className="mp-home-agent">
                <Avatar size="large" color="indigo">
                  {initials}
                </Avatar>
                <div className="mp-home-agent-main">
                  <div className="mp-home-agent-name">{displayName}</div>
                  <div className="mp-home-agent-type">{profile.email}</div>
                </div>
              </div>
              <Descriptions
                column={2}
                size="small"
                data={[
                  { key: '用户 ID', value: profile.id },
                  { key: '用户名', value: profile.username },
                  { key: '真实姓名', value: profile.realName || '—' },
                  { key: '邮箱', value: profile.email },
                  { key: '租户', value: profile.tenantId },
                  {
                    key: '角色',
                    value:
                      profile.roles.length > 0 ? (
                        <Space wrap>
                          {profile.roles.map((r) => (
                            <Tag color="blue" type="light" key={r.roleId}>
                              {r.roleName}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Text type="secondary">无</Text>
                      ),
                  },
                  {
                    key: '部门',
                    value:
                      profile.departments.length > 0 ? (
                        <Space vertical align="start">
                          {profile.departments.map((d) => (
                            <Space key={d.departmentId} wrap>
                              <Text>{d.departmentName || d.departmentId}</Text>
                              {d.isPrimary ? (
                                <Tag color="green" type="light">
                                  主部门
                                </Tag>
                              ) : null}
                            </Space>
                          ))}
                        </Space>
                      ) : (
                        <Text type="secondary">无</Text>
                      ),
                  },
                ]}
              />
            </div>
          ) : (
            <EmptyState illustration="no-content" title="暂无用户信息" desc="重新加载后可获取当前账号资料。" />
          )}
        </Card>

        <Card title="外观">
          <div className="mp-home-col">
            <RadioGroup
              type="card"
              value={settings.theme}
              onChange={(e) => void handleThemeChange(e.target.value as ThemeMode)}
              options={THEME_OPTIONS}
            />
            <Text type="secondary">
              当前生效：{resolvedTheme === 'dark' ? '深色' : '浅色'}
              {settings.theme === 'system' ? '（跟随系统，OS 切换将自动响应）' : ''}。偏好持久化到本地与后端，
              下次登录自动恢复。
            </Text>
          </div>
        </Card>

        <Card
          title="语言与区域"
          headerExtraContent={
            <Button theme="solid" type="primary" size="small" onClick={() => void regionForm.submitForm()}>
              保存设置
            </Button>
          }
        >
          <div className="mp-home-col">
            <Form form={regionForm} onSubmit={handleSavePreferences}>
              <Form.Select field="language" label="界面语言" optionList={LANGUAGE_OPTIONS} />
              <Form.Select field="timezone" label="时区" optionList={TIMEZONE_OPTIONS} />
              <Form.Select field="dateFormat" label="日期格式" optionList={DATE_FORMAT_OPTIONS} />
            </Form>
            <Text type="secondary">
              日期示例：<Text strong>{formatDateTime(previewDate, settings)}</Text>
            </Text>
          </div>
        </Card>

        <Card
          title="使用偏好"
          headerExtraContent={
            <Button theme="solid" type="primary" size="small" onClick={() => void prefsForm.submitForm()}>
              保存偏好
            </Button>
          }
        >
          <Form form={prefsForm} onSubmit={handleSavePreferences}>
            <Form.Select
              field="defaultPage"
              label="默认首页"
              extraText="登录后优先进入的页面"
              optionList={DEFAULT_PAGE_OPTIONS}
            />
            <Form.Select
              field="layout"
              label="工作台组件排列"
              extraText="按选择顺序展示（拖动排序暂未实现）"
              multiple
              optionList={WIDGET_OPTIONS}
            />
          </Form>
        </Card>

        <Card
          title="权限与角色"
          loading={permissionsLoading}
          headerExtraContent={
            <Button
              size="small"
              icon={<RefreshCw size={14} strokeWidth={1.5} />}
              onClick={() => void loadPermissions()}
            >
              重新加载
            </Button>
          }
        >
          {permissions ? (
            <div className="mp-home-col">
              <Descriptions
                column={2}
                size="small"
                data={[
                  { key: '用户 ID', value: permissions.userId },
                  { key: '租户', value: permissions.tenantId },
                  {
                    key: '角色',
                    value:
                      permissions.roles.length > 0 ? (
                        <Space wrap>
                          {permissions.roles.map((r) => (
                            <Tag color="blue" type="light" key={r.roleId}>
                              {r.roleName}
                              <Text type="secondary" size="small">
                                {` (${DATA_SCOPE_LABEL[r.dataScope] || r.dataScope})`}
                              </Text>
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Text type="secondary">无角色</Text>
                      ),
                  },
                  { key: '权限编码数', value: permissions.permissionCodes.length },
                ]}
              />

              {permissionGroups.length === 0 ? (
                <EmptyState illustration="no-access" title="当前用户未关联任何权限" />
              ) : (
                <div className="mp-home-col">
                  {permissionGroups.map((group) => (
                    <div className="mp-home-col" key={group.resourceType}>
                      <Space>
                        <Tag color="purple" type="light">
                          {group.resourceType}
                        </Tag>
                        <Text type="secondary">{group.items.length} 项权限</Text>
                      </Space>
                      <DataTablePro
                        rowKey="permissionId"
                        columnSettings={false}
                        columns={PERMISSION_COLUMNS}
                        dataSource={group.items}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState illustration="no-access" title="暂无权限数据" desc="重新加载后可获取权限聚合。" />
          )}
        </Card>

        <Card
          title="API 令牌"
          headerExtraContent={
            <Button
              theme="solid"
              type="primary"
              size="small"
              icon={<Plus size={14} strokeWidth={1.5} />}
              onClick={() => {
                setCreatedToken(null);
                tokenForm.reset();
                setTokenSheetOpen(true);
              }}
            >
              创建 Token
            </Button>
          }
        >
          <DataTablePro
            rowKey="id"
            loading={securityLoading}
            columns={tokenColumns}
            dataSource={tokens}
            empty={
              <EmptyState
                illustration="no-content"
                title="暂无 API 令牌"
                desc="创建令牌后，可在此查看最后使用时间并随时撤销。"
              />
            }
          />
        </Card>

        <Card title="活动会话">
          {sessions.length === 0 ? (
            <EmptyState illustration="no-content" title="暂无活动会话" desc="当前账号没有其他登录中的设备。" />
          ) : (
            <List
              dataSource={sessions}
              split={false}
              renderItem={(s: ActiveSession) => (
                <List.Item
                  main={
                    <div className="mp-home-agent-main">
                      <div className="mp-home-agent-name">{s.device}</div>
                      <div className="mp-home-agent-type">
                        IP: {s.ip} · 位置: {s.location} · 最后活跃: {formatDateTime(s.lastActiveAt, settings)}
                      </div>
                    </div>
                  }
                  extra={
                    s.current ? (
                      <Tag color="green" type="light">
                        当前会话
                      </Tag>
                    ) : (
                      <Popconfirm title="确认注销此会话？" onConfirm={() => void handleRevokeSession(s.id)}>
                        <Button
                          theme="borderless"
                          type="danger"
                          size="small"
                          icon={<Trash2 size={14} strokeWidth={1.5} />}
                        >
                          注销
                        </Button>
                      </Popconfirm>
                    )
                  }
                />
              )}
            />
          )}
        </Card>
      </div>

      <SheetDetail
        title="创建 API Token"
        open={tokenSheetOpen}
        onClose={() => setTokenSheetOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setTokenSheetOpen(false)}>取消</Button>
            <Button
              theme="solid"
              type="primary"
              loading={creating}
              onClick={() => void tokenForm.submitForm()}
            >
              创建
            </Button>
          </Space>
        }
      >
        <Form form={tokenForm} onSubmit={handleCreateToken}>
          <Form.Input
            field="name"
            label="Token 名称"
            placeholder="如：CI/CD Token"
            rules={[{ required: true, message: '请输入 Token 名称' }]}
          />
        </Form>
      </SheetDetail>

      <Modal
        title="Token 已创建"
        visible={!!createdToken}
        onCancel={() => setCreatedToken(null)}
        footer={
          <Button theme="solid" type="primary" onClick={() => setCreatedToken(null)}>
            完成
          </Button>
        }
      >
        <div className="mp-home-col">
          <Text>请复制保存以下 Token，关闭后将不再显示：</Text>
          <Input
            value={createdToken ?? ''}
            readonly
            suffix={
              <Button
                theme="borderless"
                size="small"
                icon={<Copy size={14} strokeWidth={1.5} />}
                onClick={() => {
                  if (createdToken) copyToken(createdToken);
                }}
              >
                复制
              </Button>
            }
          />
        </div>
      </Modal>
    </>
  );
}
