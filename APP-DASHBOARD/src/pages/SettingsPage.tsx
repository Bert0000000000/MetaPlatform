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
  Switch,
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
} from '@ant-design/icons';
import {
  getApiTokens,
  createApiToken,
  revokeApiToken,
  getActiveSessions,
  revokeSession,
} from '@/api/settings';
import type { ApiToken, ActiveSession, ThemeMode, UserSettings } from '@/types';
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

export default function SettingsPage() {
  const { settings, updateSettings, setTheme } = useSettings();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [preferencesForm] = Form.useForm<UserSettings>();
  const [layoutForm] = Form.useForm<UserSettings>();

  const load = async () => {
    const [t, sess] = await Promise.all([getApiTokens(), getActiveSessions()]);
    setTokens(t);
    setSessions(sess);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    preferencesForm.setFieldsValue(settings);
    layoutForm.setFieldsValue(settings);
  }, [settings, preferencesForm, layoutForm]);

  const handleSavePreferences = async (values: Partial<UserSettings>) => {
    await updateSettings(values);
    message.success('设置已保存');
  };

  const handleThemeToggle = async (checked: boolean) => {
    const next: ThemeMode = checked ? 'dark' : 'light';
    await setTheme(next);
    message.success(`已切换到${next === 'dark' ? '深色' : '浅色'}主题`);
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

  const isDark = settings.theme === 'dark';
  const previewDate = new Date().toISOString();

  return (
    <Card>
      <Tabs
        items={[
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
                <Space orientation="vertical" style={{ maxWidth: 560, width: '100%' }}>
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
              <div style={{ maxWidth: 400 }}>
                <Typography.Title level={5}>主题模式</Typography.Title>
                <Space style={{ marginBottom: 16 }}>
                  <SunOutlined style={{ color: isDark ? undefined : '#faad14' }} />
                  <Switch
                    checked={isDark}
                    onChange={handleThemeToggle}
                    checkedChildren="深色"
                    unCheckedChildren="浅色"
                  />
                  <MoonOutlined style={{ color: isDark ? '#1677ff' : undefined }} />
                </Space>
                <Typography.Paragraph type="secondary">
                  切换主题会立即生效，并自动保存到本地。下次登录时将自动恢复上次使用的主题。
                </Typography.Paragraph>
                <Button
                  type={isDark ? 'default' : 'primary'}
                  onClick={() => setTheme('light')}
                  style={{ marginRight: 8 }}
                >
                  浅色模式
                </Button>
                <Button
                  type={isDark ? 'primary' : 'default'}
                  onClick={() => setTheme('dark')}
                >
                  深色模式
                </Button>
              </div>
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
                  locale={{ emptyText: '暂无 Token' }}
                />
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
