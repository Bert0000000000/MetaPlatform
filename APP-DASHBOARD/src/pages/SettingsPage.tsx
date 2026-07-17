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
} from '@ant-design/icons';
import {
  getSettings,
  updateSettings,
  getApiTokens,
  createApiToken,
  revokeApiToken,
  getActiveSessions,
  revokeSession,
} from '@/api/settings';
import type { UserSettings, ApiToken, ActiveSession, ThemeMode } from '@/types';

const WIDGET_OPTIONS = [
  { label: '指标面板', value: 'metrics' },
  { label: '待办审批', value: 'approvals' },
  { label: '数字员工状态', value: 'workers' },
  { label: '通知消息', value: 'notifications' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [form] = Form.useForm<UserSettings>();

  const load = async () => {
    const [s, t, sess] = await Promise.all([getSettings(), getApiTokens(), getActiveSessions()]);
    setSettings(s);
    setTokens(t);
    setSessions(sess);
    form.setFieldsValue(s);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSavePreferences = async (values: UserSettings) => {
    await updateSettings(values);
    setSettings(values);
    message.success('设置已保存');
  };

  const handleThemeChange = async (theme: ThemeMode) => {
    await updateSettings({ theme });
    setSettings((prev) => (prev ? { ...prev, theme } : prev));
    message.success(`已切换到${theme === 'dark' ? '深色' : '浅色'}主题`);
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
    { title: 'Token', dataIndex: 'token', key: 'token', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '最后使用', dataIndex: 'lastUsedAt', key: 'lastUsedAt', render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ApiToken) => (
        <Popconfirm title="确认撤销此 Token？" onConfirm={() => handleRevokeToken(record.id)}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>撤销</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card>
      <Tabs
        items={[
          {
            key: 'preferences',
            label: <span><GlobalOutlined /> 偏好设置</span>,
            children: (
              <Form form={form} layout="vertical" onFinish={handleSavePreferences} style={{ maxWidth: 500 }}>
                <Form.Item name="language" label="语言">
                  <Select>
                    <Select.Option value="zh-CN">简体中文</Select.Option>
                    <Select.Option value="en-US">English</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="timezone" label="时区">
                  <Select>
                    <Select.Option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</Select.Option>
                    <Select.Option value="UTC">UTC</Select.Option>
                    <Select.Option value="America/New_York">America/New_York</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="defaultPage" label="默认首页">
                  <Select>
                    <Select.Option value="/dashboard">工作台</Select.Option>
                    <Select.Option value="/notifications">消息中心</Select.Option>
                    <Select.Option value="/deliverables">历史交付物</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">保存</Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'theme',
            label: <span><BgColorsOutlined /> 主题</span>,
            children: (
              <div style={{ maxWidth: 400 }}>
                <Typography.Title level={5}>主题模式</Typography.Title>
                <Space>
                  <Button
                    type={settings?.theme === 'light' ? 'primary' : 'default'}
                    onClick={() => handleThemeChange('light')}
                  >
                    浅色模式
                  </Button>
                  <Button
                    type={settings?.theme === 'dark' ? 'primary' : 'default'}
                    onClick={() => handleThemeChange('dark')}
                  >
                    深色模式
                  </Button>
                </Space>
              </div>
            ),
          },
          {
            key: 'layout',
            label: <span><LayoutOutlined /> 布局定制</span>,
            children: (
              <Form form={form} layout="vertical" onFinish={handleSavePreferences} style={{ maxWidth: 500 }}>
                <Form.Item name="layout" label="工作台组件排列">
                  <Select mode="multiple" options={WIDGET_OPTIONS} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">保存布局</Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'tokens',
            label: <span><KeyOutlined /> API Token</span>,
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreatedToken(null); setTokenModalOpen(true); }}>
                    创建 Token
                  </Button>
                </Space>
                <Table rowKey="id" columns={tokenColumns} dataSource={tokens} pagination={false} size="small" />
              </div>
            ),
          },
          {
            key: 'sessions',
            label: <span><SafetyOutlined /> 会话管理</span>,
            children: (
              <List
                dataSource={sessions}
                renderItem={(s) => (
                  <List.Item
                    actions={
                      s.current
                        ? [<Tag key="current" color="green">当前会话</Tag>]
                        : [
                            <Popconfirm key="revoke" title="确认注销此会话？" onConfirm={() => handleRevokeSession(s.id)}>
                              <Button type="link" danger size="small">注销</Button>
                            </Popconfirm>,
                          ]
                    }
                  >
                    <List.Item.Meta
                      title={s.device}
                      description={`IP: ${s.ip} · 位置: ${s.location} · 最后活跃: ${new Date(s.lastActiveAt).toLocaleString('zh-CN')}`}
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
        footer={<Button type="primary" onClick={() => setCreatedToken(null)}>完成</Button>}
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
