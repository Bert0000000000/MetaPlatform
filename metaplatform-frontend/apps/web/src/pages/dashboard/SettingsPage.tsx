import { useEffect, useState, type ReactNode } from 'react';
import {
  Card,
  Nav,
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Typography,
  Toast,
  Popconfirm,
  List,
  Divider,
  Avatar,
  Descriptions,
  Empty,
  Spin,
} from '@douyinfe/semi-ui';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  LayoutOutlined,
  BgColorsOutlined,
  GlobalOutlined,
  KeyOutlined,
  SafetyOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  UserOutlined,
  IdcardOutlined,
  CheckCircleFilled,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getApiTokens,
  createApiToken,
  revokeApiToken,
  getActiveSessions,
  revokeSession,
} from '@/api/settings';
import { getCurrentUser, getCurrentUserPermissions } from '@/api/user';
import type {
  ApiToken,
  ActiveSession,
  ThemeMode,
  UserSettings,
  UserProfile,
  UserPermissions,
  UserPermissionDetail,
} from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { formatDateTime } from '@/utils/datetime';

const { Text, Title, Paragraph } = Typography;

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

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: ReactNode; desc: string }> = [
  { value: 'light', label: '浅色', icon: <SunOutlined />, desc: '明亮清爽，适合白天使用' },
  { value: 'dark', label: '深色', icon: <MoonOutlined />, desc: '护眼沉浸，适合夜间使用' },
  { value: 'system', label: '跟随系统', icon: <DesktopOutlined />, desc: '随操作系统自动切换' },
];

const DATA_SCOPE_LABEL: Record<string, string> = {
  ALL: '全部数据',
  DEPT: '本部门',
  DEPT_AND_SUB: '本部门及子部门',
  SELF: '仅本人',
  CUSTOM: '自定义',
};

/** 左侧分区导航：清晰分组，替代原先挤在一行的 7 个横向 Tab。 */
const NAV_ITEMS = [
  { itemKey: 'appearance', text: '外观', icon: <BgColorsOutlined /> },
  { itemKey: 'region', text: '语言与区域', icon: <GlobalOutlined /> },
  { itemKey: 'preferences', text: '偏好', icon: <LayoutOutlined /> },
  { itemKey: 'profile', text: '个人资料', icon: <UserOutlined /> },
  { itemKey: 'permissions', text: '权限', icon: <IdcardOutlined /> },
  { itemKey: 'security', text: '安全', icon: <SafetyOutlined /> },
];

const NAV_META: Record<string, { title: string; desc: string }> = {
  appearance: { title: '外观', desc: '自定义平台主题外观，切换即时生效并持久化。' },
  region: { title: '语言与区域', desc: '设置界面语言、时区与日期显示格式。' },
  preferences: { title: '偏好', desc: '配置登录后的默认首页与工作台组件排列。' },
  profile: { title: '个人资料', desc: '查看当前账号的基本信息与所属组织。' },
  permissions: { title: '权限', desc: '查看当前账号被授予的角色与数据权限。' },
  security: { title: '安全', desc: '管理 API 访问令牌与已登录的活动会话。' },
};

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

/** 分区标题：统一的内容区头部。 */
function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Title heading={4} style={{ margin: 0 }}>
        {title}
      </Title>
      {desc && (
        <Paragraph type="secondary" style={{ margin: '6px 0 0', maxWidth: 640 }}>
          {desc}
        </Paragraph>
      )}
    </div>
  );
}

/** 主题缩略图里的迷你窗口：模拟侧边栏 + 内容块。 */
function MiniWindow({ bg, panel, border }: { bg: string; panel: string; border: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: 6,
        display: 'flex',
        gap: 4,
      }}
    >
      <div style={{ width: 18, background: panel, borderRadius: 4, opacity: 0.95 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 8, background: panel, borderRadius: 2, opacity: 0.95 }} />
        <div style={{ flex: 1, background: panel, borderRadius: 3, opacity: 0.55 }} />
      </div>
    </div>
  );
}

/** 主题模式的可视化缩略图。 */
function ThemeThumbnail({ mode }: { mode: ThemeMode }) {
  const box: React.CSSProperties = { display: 'flex', gap: 6, height: 92 };
  if (mode === 'system') {
    return (
      <div style={box}>
        <MiniWindow bg="#eef0f3" panel="#ffffff" border="#e2e5ea" />
        <MiniWindow bg="#1c1d21" panel="#2b2c31" border="#33353a" />
      </div>
    );
  }
  const light = mode === 'light';
  return (
    <div style={box}>
      <MiniWindow
        bg={light ? '#eef0f3' : '#1c1d21'}
        panel={light ? '#ffffff' : '#2b2c31'}
        border={light ? '#e2e5ea' : '#33353a'}
      />
    </div>
  );
}

/** 可选主题卡片：选中态高亮 + 勾选标记。 */
function ThemeCard({
  option,
  active,
  onClick,
}: {
  option: (typeof THEME_OPTIONS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        flex: '1 1 160px',
        maxWidth: 224,
        cursor: 'pointer',
        outline: 'none',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: 12,
        background: 'var(--card)',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: active ? '0 0 0 1px var(--primary)' : 'none',
      }}
    >
      <ThemeThumbnail mode={option.value} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            color: active ? 'var(--primary)' : 'var(--muted-foreground)',
          }}
        >
          {option.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
            {option.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
            {option.desc}
          </div>
        </div>
        {active && (
          <CheckCircleFilled style={{ color: 'var(--primary)', fontSize: 16 }} />
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, resolvedTheme, updateSettings, setTheme } = useSettings();
  const [active, setActive] = useState<string>('appearance');
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [regionForm] = Form.useForm<UserSettings>();
  const [prefsForm] = Form.useForm<UserSettings>();

  const loadTokensAndSessions = async () => {
    const [t, sess] = await Promise.all([getApiTokens(), getActiveSessions()]);
    setTokens(t);
    setSessions(sess);
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const data = await getCurrentUser();
      setProfile(data);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const data = await getCurrentUserPermissions();
      setPermissions(data);
    } finally {
      setPermissionsLoading(false);
    }
  };

  // 挂载时并行加载：tokens / sessions / profile / permissions，避免空白分区。
  // 单个请求失败由全局 axios 拦截器统一报错，不影响其他分区。
  useEffect(() => {
    loadTokensAndSessions();
    loadProfile();
    loadPermissions();
  }, []);

  useEffect(() => {
    regionForm.setValues(settings);
    prefsForm.setValues(settings);
  }, [settings, regionForm, prefsForm]);

  const handleSavePreferences = async (values: Partial<UserSettings>) => {
    await updateSettings(values);
    Toast.success('设置已保存并即时生效');
  };

  const handleThemeChange = async (next: ThemeMode) => {
    await setTheme(next);
    const label = next === 'system' ? '跟随系统' : next === 'dark' ? '深色' : '浅色';
    Toast.success(`已切换到「${label}」主题，全局即时生效`);
  };

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      Toast.warning('请输入 Token 名称');
      return;
    }
    const token = await createApiToken(newTokenName);
    setCreatedToken(token.token);
    setTokens((prev) => [token, ...prev]);
    setTokenModalOpen(false);
    setNewTokenName('');
    Toast.success('Token 创建成功');
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

  const tokenColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: 'Token',
      dataIndex: 'token',
      key: 'token',
      render: (v: string) => (
        <Text code style={{ maxWidth: 240, display: 'inline-block' }} ellipsis>
          {v}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v, settings),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (v?: string) => (v ? formatDateTime(v, settings) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ApiToken) => (
        <Popconfirm title="确认撤销此 Token？" onConfirm={() => handleRevokeToken(record.id)}>
          <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>
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
  const currentMeta = NAV_META[active] ?? NAV_META.appearance;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', width: 'auto', margin: '0 -24px' }}>
      {/* 左侧分区导航 */}
      <div
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px 8px' }}>
          <Title heading={5} style={{ margin: 0 }}>
            设置
          </Title>
        </div>
        <Nav
          items={NAV_ITEMS}
          selectedKeys={[active]}
          onClick={({ itemKey }) => setActive(String(itemKey))}
          style={{
            width: '100%',
            padding: 8,
            borderRight: 'none',
            background: 'transparent',
            fontSize: 13,
          }}
          bodyStyle={{ paddingTop: 4 }}
        />
      </div>

      {/* 右侧内容区 */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 36px' }}>
        <SectionHeader title={currentMeta.title} desc={currentMeta.desc} />

        {active === 'appearance' && (
          <Card
            style={{ maxWidth: 760, width: '100%' }}
            title="主题模式"
            headerExtraContent={
              <Text type="secondary" size="small">
                当前：
                <Tag color={resolvedTheme === 'dark' ? 'indigo' : 'yellow'} style={{ marginLeft: 4 }}>
                  {resolvedTheme === 'dark' ? '深色' : '浅色'}
                </Tag>
              </Text>
            }
          >
            <div style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 16 }}>
              选择偏好的配色主题，切换后立即应用到所有平台组件。
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {THEME_OPTIONS.map((opt) => (
                <ThemeCard
                  key={opt.value}
                  option={opt}
                  active={settings.theme === opt.value}
                  onClick={() => handleThemeChange(opt.value)}
                />
              ))}
            </div>
            <Divider margin={20} />
            <Text type="secondary" size="small">
              偏好同时持久化到本地与后端，下次登录自动恢复
              {settings.theme === 'system' ? '（跟随系统，OS 切换将自动响应）' : ''}。
            </Text>
          </Card>
        )}

        {active === 'region' && (
          <Card
            style={{ maxWidth: 720, width: '100%' }}
            title="语言与区域"
            headerExtraContent={
              <Button theme="solid" type="primary" htmlType="submit" onClick={() => regionForm.submitForm()}>
                保存设置
              </Button>
            }
          >
            <Form
              form={regionForm}
              onSubmit={handleSavePreferences}
              labelPosition="left"
              style={{ maxWidth: 480 }}
            >
              <Form.Select field="language" label="界面语言" optionList={LANGUAGE_OPTIONS} />
              <Form.Select field="timezone" label="时区" optionList={TIMEZONE_OPTIONS} />
              <Form.Select field="dateFormat" label="日期格式" optionList={DATE_FORMAT_OPTIONS} />
            </Form>
            <Divider margin={20} />
            <Space vertical spacing={6} style={{ width: '100%' }}>
              <Text type="secondary">
                当前语言: {settings.language} · 时区: {settings.timezone}
              </Text>
              <Text>
                日期示例: <Text strong>{formatDateTime(previewDate, settings)}</Text>
              </Text>
            </Space>
          </Card>
        )}

        {active === 'preferences' && (
          <Card
            style={{ maxWidth: 720, width: '100%' }}
            title="使用偏好"
            headerExtraContent={
              <Button theme="solid" type="primary" onClick={() => prefsForm.submitForm()}>
                保存偏好
              </Button>
            }
          >
            <Form
              form={prefsForm}
              onSubmit={handleSavePreferences}
              labelPosition="left"
              style={{ maxWidth: 480 }}
            >
              <Form.Select
                field="defaultPage"
                label="默认首页"
                extraText="登录后优先进入的页面"
                optionList={DEFAULT_PAGE_OPTIONS}
              />
              <Form.Select
                field="layout"
                label="工作台组件排列"
                extraText="按选择顺序展示，拖动可调整顺序（暂未实现）"
                multiple
                optionList={WIDGET_OPTIONS}
              />
            </Form>
          </Card>
        )}

        {active === 'profile' && (
          <Spin spinning={profileLoading}>
            {profile ? (
              <Card
                style={{ maxWidth: 720, width: '100%' }}
                title="账号信息"
                headerExtraContent={
                  <Button icon={<ReloadOutlined />} onClick={loadProfile} size="small">
                    重新加载
                  </Button>
                }
              >
                <Space spacing="loose" align="center" style={{ marginBottom: 24 }}>
                  <Avatar size="extra-large" style={{ backgroundColor: 'var(--primary)' }}>
                    {initials}
                  </Avatar>
                  <div>
                    <Title heading={4} style={{ margin: 0 }}>
                      {displayName}
                    </Title>
                    <Text type="secondary">{profile.email}</Text>
                  </div>
                </Space>
                <Descriptions
                  column={2}
                  size="medium"
                  data={[
                    { key: '用户 ID', value: profile.id },
                    { key: '用户名', value: profile.username },
                    { key: '真实姓名', value: profile.realName || '-' },
                    { key: '邮箱', value: profile.email },
                    { key: '租户', value: profile.tenantId },
                    {
                      key: '角色',
                      value:
                        profile.roles.length > 0 ? (
                          <Space wrap>
                            {profile.roles.map((r) => (
                              <Tag color="blue" key={r.roleId}>
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
                          <Space vertical spacing={0}>
                            {profile.departments.map((d) => (
                              <Space key={d.departmentId} spacing={4}>
                                <Text>{d.departmentName || d.departmentId}</Text>
                                {d.isPrimary && (
                                  <Tag color="green" style={{ marginLeft: 4 }}>
                                    主部门
                                  </Tag>
                                )}
                              </Space>
                            ))}
                          </Space>
                        ) : (
                          <Text type="secondary">无</Text>
                        ),
                    },
                  ]}
                  style={{ width: '100%' }}
                />
              </Card>
            ) : (
              <Empty description="暂无用户信息" />
            )}
          </Spin>
        )}

        {active === 'permissions' && (
          <Spin spinning={permissionsLoading}>
            {permissions ? (
              <Card
                style={{ width: '100%' }}
                title="权限与角色"
                headerExtraContent={
                  <Button icon={<ReloadOutlined />} onClick={loadPermissions} size="small">
                    重新加载
                  </Button>
                }
              >
                <Descriptions
                  column={2}
                  size="small"
                  style={{ marginBottom: 16, width: '100%' }}
                  data={[
                    { key: '用户 ID', value: permissions.userId },
                    { key: '租户', value: permissions.tenantId },
                    {
                      key: '角色',
                      value:
                        permissions.roles.length > 0 ? (
                          <Space wrap>
                            {permissions.roles.map((r) => (
                              <Tag color="blue" key={r.roleId}>
                                {r.roleName}
                                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                                  ({DATA_SCOPE_LABEL[r.dataScope] || r.dataScope})
                                </span>
                              </Tag>
                            ))}
                          </Space>
                        ) : (
                          <Text type="secondary">无角色</Text>
                        ),
                    },
                    {
                      key: '权限编码数',
                      value: permissions.permissionCodes.length,
                    },
                  ]}
                />
                {permissionGroups.length === 0 ? (
                  <Empty description="当前用户未关联任何权限" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                    {permissionGroups.map((group) => (
                      <div key={group.resourceType}>
                        <div style={{ marginBottom: 8 }}>
                          <Space>
                            <Tag color="purple">{group.resourceType}</Tag>
                            <Text type="secondary">{group.items.length} 项权限</Text>
                          </Space>
                        </div>
                        <Table
                          rowKey="permissionId"
                          size="small"
                          pagination={false}
                          style={{ width: '100%' }}
                          dataSource={group.items}
                          columns={[
                            {
                              title: '权限编码',
                              dataIndex: 'permissionCode',
                              key: 'permissionCode',
                              render: (v: string) => <Text code>{v}</Text>,
                            },
                            { title: '名称', dataIndex: 'permissionName', key: 'permissionName' },
                            {
                              title: '操作',
                              dataIndex: 'actions',
                              key: 'actions',
                              render: (actions: string[]) => (
                                <Space wrap>
                                  {actions.map((a) => (
                                    <Tag key={a}>{a}</Tag>
                                  ))}
                                </Space>
                              ),
                            },
                            {
                              title: '效果',
                              dataIndex: 'effect',
                              key: 'effect',
                              render: (effect: string) => (
                                <Tag color={effect === 'DENY' ? 'red' : 'green'}>{effect}</Tag>
                              ),
                            },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Empty description="暂无权限数据" />
            )}
          </Spin>
        )}

        {active === 'security' && (
          <div>
            <Card
              title="API Token"
              headerExtraContent={
                <Button
                  theme="solid"
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setCreatedToken(null);
                    setTokenModalOpen(true);
                  }}
                >
                  创建 Token
                </Button>
              }
              bodyStyle={{ paddingTop: 12 }}
            >
              <Table
                rowKey="id"
                columns={tokenColumns}
                dataSource={tokens}
                pagination={false}
                size="small"
                empty="暂无 Token"
              />
            </Card>

            <Card title="活动会话" bodyStyle={{ paddingTop: 12 }} style={{ marginTop: 20 }}>
              {sessions.length === 0 ? (
                <Empty description="暂无活动会话" />
              ) : (
                <List
                  dataSource={sessions}
                  renderItem={(s) => (
                    <List.Item
                      main={
                        <div>
                          <Text strong>{s.device}</Text>
                          <div style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                            IP: {s.ip} · 位置: {s.location} · 最后活跃:{' '}
                            {formatDateTime(s.lastActiveAt, settings)}
                          </div>
                        </div>
                      }
                      extra={
                        s.current ? (
                          <Tag color="green">当前会话</Tag>
                        ) : (
                          <Popconfirm
                            title="确认注销此会话？"
                            onConfirm={() => handleRevokeSession(s.id)}
                          >
                            <Button theme="borderless" type="danger" size="small">
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
        )}
      </div>

      <Modal
        title="创建 API Token"
        visible={tokenModalOpen}
        onCancel={() => setTokenModalOpen(false)}
        onOk={handleCreateToken}
      >
        <Input
          placeholder="Token 名称，如：CI/CD Token"
          value={newTokenName}
          onChange={(v) => setNewTokenName(v)}
        />
      </Modal>

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
        <Text>请复制保存以下 Token，关闭后将不再显示：</Text>
        <Input
          value={createdToken || ''}
          readonly
          onEnterPress={() => {
            if (createdToken) {
              navigator.clipboard.writeText(createdToken);
              Toast.success('已复制到剪贴板');
            }
          }}
          suffix={
            <Button
              theme="borderless"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                if (createdToken) {
                  navigator.clipboard.writeText(createdToken);
                  Toast.success('已复制到剪贴板');
                }
              }}
            >
              复制
            </Button>
          }
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}
