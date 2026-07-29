import { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Typography,
  message,
  Popconfirm,
  List,
  Divider,
  Radio,
  Avatar,
  Descriptions,
  Empty,
  Spin,
} from 'antd';
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

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: '浅色', icon: <SunOutlined /> },
  { value: 'dark', label: '深色', icon: <MoonOutlined /> },
  { value: 'system', label: '跟随系统', icon: <DesktopOutlined /> },
];

const DATA_SCOPE_LABEL: Record<string, string> = {
  ALL: '全部数据',
  DEPT: '本部门',
  DEPT_AND_SUB: '本部门及子部门',
  SELF: '仅本人',
  CUSTOM: '自定义',
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

export default function SettingsPage() {
  const { settings, resolvedTheme, updateSettings, setTheme } = useSettings();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [preferencesForm] = Form.useForm<UserSettings>();
  const [layoutForm] = Form.useForm<UserSettings>();

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

  // 挂载时并行加载：tokens / sessions / profile / permissions，避免空白 tab。
  // 单个请求失败由全局 axios 拦截器统一报错，不影响其他 tab。
  useEffect(() => {
    loadTokensAndSessions();
    loadProfile();
    loadPermissions();
  }, []);

  useEffect(() => {
    preferencesForm.setFieldsValue(settings);
    layoutForm.setFieldsValue(settings);
  }, [settings, preferencesForm, layoutForm]);

  const handleSavePreferences = async (values: Partial<UserSettings>) => {
    await updateSettings(values);
    message.success('设置已保存并即时生效');
  };

  const handleThemeChange = async (next: ThemeMode) => {
    await setTheme(next);
    const label = next === 'system' ? '跟随系统' : next === 'dark' ? '深色' : '浅色';
    message.success(`已切换到「${label}」主题，全局即时生效`);
  };

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      message.warning('请输入 Token 名称');
      return;
    }
    const token = await createApiToken(newTokenName);
    setCreatedToken(token.token);
    setTokens((prev) => [token, ...prev]);
    setTokenModalOpen(false);
    setNewTokenName('');
    message.success('Token 创建成功');
  };

  const handleRevokeToken = async (id: string) => {
    await revokeApiToken(id);
    setTokens((prev) => prev.filter((t) => t.id !== id));
    message.success('Token 已撤销');
  };

  const handleRevokeSession = async (id: string) => {
    await revokeSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    message.success('会话已注销');
  };

  const tokenColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: 'Token',
      dataIndex: 'token',
      key: 'token',
      render: (v: string) => (
        <Typography.Text code style={{ maxWidth: 240, display: 'inline-block' }} ellipsis>
          {v}
        </Typography.Text>
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
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
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

  return (
    <Card>
      <Tabs
        items={[
          {
            key: 'profile',
            label: (
              <span>
                <UserOutlined /> 个人信息
              </span>
            ),
            children: (
              <Spin spinning={profileLoading}>
                {profile ? (
                  <div style={{ maxWidth: 720 }}>
                    <Space size="large" align="center" style={{ marginBottom: 24 }}>
                      <Avatar size={72} icon={<UserOutlined />} src={undefined} style={{ backgroundColor: '#1677ff' }}>
                        {initials}
                      </Avatar>
                      <div>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                          {displayName}
                        </Typography.Title>
                        <Typography.Text type="secondary">{profile.email}</Typography.Text>
                      </div>
                    </Space>
                    <Descriptions
                      column={2}
                      bordered
                      size="middle"
                      labelStyle={{ width: 140 }}
                      items={[
                        { label: '用户 ID', children: profile.id },
                        { label: '用户名', children: profile.username },
                        { label: '真实姓名', children: profile.realName || '-' },
                        { label: '邮箱', children: profile.email },
                        { label: '租户', children: profile.tenantId },
                        {
                          label: '角色',
                          children:
                            profile.roles.length > 0 ? (
                              <Space wrap>
                                {profile.roles.map((r) => (
                                  <Tag color="blue" key={r}>
                                    {r}
                                  </Tag>
                                ))}
                              </Space>
                            ) : (
                              <Typography.Text type="secondary">无</Typography.Text>
                            ),
                        },
                        {
                          label: '部门',
                          children:
                            profile.departments.length > 0 ? (
                              <Space direction="vertical" size={0}>
                                {profile.departments.map((d) => (
                                  <Space key={d.departmentId} size={4}>
                                    <Typography.Text>{d.departmentName || d.departmentId}</Typography.Text>
                                    {d.isPrimary && (
                                      <Tag color="green" style={{ marginLeft: 4 }}>
                                        主部门
                                      </Tag>
                                    )}
                                  </Space>
                                ))}
                              </Space>
                            ) : (
                              <Typography.Text type="secondary">无</Typography.Text>
                            ),
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <Empty description="暂无用户信息" />
                )}
                <Divider />
                <Button icon={<IdcardOutlined />} onClick={loadProfile}>
                  重新加载个人信息
                </Button>
              </Spin>
            ),
          },
          {
            key: 'preferences',
            label: (
              <span>
                <GlobalOutlined /> 偏好设置
              </span>
            ),
            children: (
              <>
                <Form
                  form={preferencesForm}
                  layout="vertical"
                  onFinish={handleSavePreferences}
                  style={{ maxWidth: 560 }}
                >
                  <Form.Item name="language" label="语言">
                    <Select options={LANGUAGE_OPTIONS} />
                  </Form.Item>
                  <Form.Item name="timezone" label="时区">
                    <Select options={TIMEZONE_OPTIONS} />
                  </Form.Item>
                  <Form.Item name="dateFormat" label="日期格式">
                    <Select options={DATE_FORMAT_OPTIONS} />
                  </Form.Item>
                  <Form.Item name="defaultPage" label="默认首页">
                    <Select options={DEFAULT_PAGE_OPTIONS} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      保存设置
                    </Button>
                  </Form.Item>
                </Form>
                <Divider>实时预览</Divider>
                <Space direction="vertical" style={{ maxWidth: 560, width: '100%' }}>
                  <Typography.Text type="secondary">
                    当前语言: {settings.language} · 时区: {settings.timezone}
                  </Typography.Text>
                  <Typography.Text>
                    日期示例: <Typography.Text strong>{formatDateTime(previewDate, settings)}</Typography.Text>
                  </Typography.Text>
                </Space>
              </>
            ),
          },
          {
            key: 'theme',
            label: (
              <span>
                <BgColorsOutlined /> 主题
              </span>
            ),
            children: (
              <div style={{ maxWidth: 480 }}>
                <Typography.Title level={5}>主题模式</Typography.Title>
                <Form.Item label="选择主题" style={{ marginBottom: 16 }}>
                  <Radio.Group
                    value={settings.theme}
                    onChange={(e) => handleThemeChange(e.target.value as ThemeMode)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    {THEME_OPTIONS.map((opt) => (
                      <Radio.Button key={opt.value} value={opt.value}>
                        <Space size={4}>
                          {opt.icon}
                          {opt.label}
                        </Space>
                      </Radio.Button>
                    ))}
                  </Radio.Group>
                </Form.Item>
                <Typography.Paragraph type="secondary">
                  当前实际主题：
                  <Tag color={resolvedTheme === 'dark' ? 'geekblue' : 'gold'}>
                    {resolvedTheme === 'dark' ? '深色' : '浅色'}
                  </Tag>
                  {settings.theme === 'system' && '（跟随系统，OS 切换将自动响应）'}
                </Typography.Paragraph>
                <Typography.Paragraph type="secondary">
                  主题切换会立即生效，并通过 ConfigProvider 同步到所有 Ant Design 组件；
                  偏好同时持久化到 localStorage 与后端，下次登录自动恢复。
                </Typography.Paragraph>
              </div>
            ),
          },
          {
            key: 'permissions',
            label: (
              <span>
                <SafetyOutlined /> 权限查看
              </span>
            ),
            children: (
              <Spin spinning={permissionsLoading}>
                {permissions ? (
                  <div style={{ maxWidth: 900 }}>
                    <Descriptions
                      column={2}
                      size="small"
                      bordered
                      style={{ marginBottom: 16 }}
                      items={[
                        { label: '用户 ID', children: permissions.userId },
                        { label: '租户', children: permissions.tenantId },
                        {
                          label: '角色',
                          children:
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
                              <Typography.Text type="secondary">无角色</Typography.Text>
                            ),
                        },
                        {
                          label: '权限编码数',
                          children: permissions.permissionCodes.length,
                        },
                      ]}
                    />
                    {permissionGroups.length === 0 ? (
                      <Empty description="当前用户未关联任何权限" />
                    ) : (
                      <List
                        dataSource={permissionGroups}
                        renderItem={(group) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Tag color="purple">{group.resourceType}</Tag>
                                  <Typography.Text type="secondary">
                                    {group.items.length} 项权限
                                  </Typography.Text>
                                </Space>
                              }
                              description={
                                <Table
                                  rowKey="permissionId"
                                  size="small"
                                  pagination={false}
                                  dataSource={group.items}
                                  columns={[
                                    {
                                      title: '权限编码',
                                      dataIndex: 'permissionCode',
                                      key: 'permissionCode',
                                      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
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
                                 scroll={{ x: 'max-content' }}/>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    )}
                    <Divider />
                    <Button icon={<SafetyOutlined />} onClick={loadPermissions}>
                      重新加载权限
                    </Button>
                  </div>
                ) : (
                  <Empty description="暂无权限数据，可点击下方按钮重新加载" />
                )}
              </Spin>
            ),
          },
          {
            key: 'layout',
            label: (
              <span>
                <LayoutOutlined /> 布局定制
              </span>
            ),
            children: (
              <Form
                form={layoutForm}
                layout="vertical"
                onFinish={handleSavePreferences}
                style={{ maxWidth: 560 }}
              >
                <Form.Item
                  name="layout"
                  label="工作台组件排列"
                  help="按选择顺序展示，拖动可调整顺序（暂未实现）"
                >
                  <Select mode="multiple" options={WIDGET_OPTIONS} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    保存布局
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'tokens',
            label: (
              <span>
                <KeyOutlined /> API Token
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setCreatedToken(null);
                      setTokenModalOpen(true);
                    }}
                  >
                    创建 Token
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  columns={tokenColumns}
                  dataSource={tokens}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无 Token' }} scroll={{ x: 'max-content' }} />
              </div>
            ),
          },
          {
            key: 'sessions',
            label: (
              <span>
                <SafetyOutlined /> 会话管理
              </span>
            ),
            children: (
              <List
                dataSource={sessions}
                locale={{ emptyText: '暂无活动会话' }}
                renderItem={(s) => (
                  <List.Item
                    actions={
                      s.current
                        ? [<Tag key="current" color="green">当前会话</Tag>]
                        : [
                            <Popconfirm
                              key="revoke"
                              title="确认注销此会话？"
                              onConfirm={() => handleRevokeSession(s.id)}
                            >
                              <Button type="link" danger size="small">
                                注销
                              </Button>
                            </Popconfirm>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      title={s.device}
                      description={`IP: ${s.ip} · 位置: ${s.location} · 最后活跃: ${formatDateTime(
                        s.lastActiveAt,
                        settings,
                      )}`}
                    />
                  </List.Item>
                )}
              />
            ),
          },
        ]}
      />

      <Modal
        title="创建 API Token"
        open={tokenModalOpen}
        onCancel={() => setTokenModalOpen(false)}
        onOk={handleCreateToken}
      >
        <Input
          placeholder="Token 名称，如：CI/CD Token"
          value={newTokenName}
          onChange={(e) => setNewTokenName(e.target.value)}
        />
      </Modal>

      <Modal
        title="Token 已创建"
        open={!!createdToken}
        onCancel={() => setCreatedToken(null)}
        footer={
          <Button type="primary" onClick={() => setCreatedToken(null)}>
            完成
          </Button>
        }
      >
        <Typography.Text>请复制保存以下 Token，关闭后将不再显示：</Typography.Text>
        <Input.Search
          value={createdToken || ''}
          readOnly
          enterButton={<CopyOutlined />}
          onSearch={() => {
            if (createdToken) {
              navigator.clipboard.writeText(createdToken);
              message.success('已复制到剪贴板');
            }
          }}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </Card>
  );
}
