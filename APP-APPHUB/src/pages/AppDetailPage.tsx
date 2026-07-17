import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Tabs,
  Tag,
  Space,
  Input,
  Dropdown,
  Empty,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  DashboardOutlined,
  LayoutOutlined,
  AppstoreOutlined,
  SendOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { getApp, updateApp, deleteApp } from '@/api/apps';
import { listModules, createModule, updateModule, deleteModule } from '@/api/modules';
import AppForm from '@/components/AppForm';
import ModuleForm from '@/components/ModuleForm';
import type { AppItem, ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, AppStatus } from '@/types';
import type { MenuProps } from 'antd';

const STATUS_MAP: Record<AppStatus, { label: string; color: string }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'default' },
};

const MODULE_TYPE_COLORS: Record<string, string> = {
  FORM: 'blue',
  FLOW: 'purple',
  BOARD: 'cyan',
  PAGE: 'orange',
};

const MODULE_TYPE_ICONS: Record<string, React.ReactNode> = {
  FORM: <FileTextOutlined />,
  FLOW: <NodeIndexOutlined />,
  BOARD: <DashboardOutlined />,
  PAGE: <LayoutOutlined />,
};

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [moduleKeyword, setModuleKeyword] = useState('');
  const [appFormOpen, setAppFormOpen] = useState(false);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadApp = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const data = await getApp(appId);
      setApp(data);
      const res = await listModules(appId);
      setModules(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApp();
  }, [appId]);

  const handleUpdateApp = async (values: { name?: string; description?: string; icon?: string; group?: string }) => {
    if (!appId || !app) return;
    setSubmitting(true);
    try {
      await updateApp(appId, values);
      message.success('应用信息已更新');
      setAppFormOpen(false);
      loadApp();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!appId) return;
    await updateApp(appId, { status: 'PUBLISHED' });
    message.success('应用已发布');
    loadApp();
  };

  const handleOffline = async () => {
    if (!appId) return;
    await updateApp(appId, { status: 'OFFLINE' });
    message.success('应用已下线');
    loadApp();
  };

  const handleDeleteApp = async () => {
    if (!appId) return;
    await deleteApp(appId);
    message.success('应用已删除');
    navigate('/apps');
  };

  const handleCreateModule = async (values: ModuleCreateRequest) => {
    if (!appId) return;
    setSubmitting(true);
    try {
      await createModule({ ...values, appId });
      message.success('模块创建成功');
      setModuleFormOpen(false);
      loadApp();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateModule = async (values: ModuleUpdateRequest) => {
    if (!editingModule) return;
    setSubmitting(true);
    try {
      await updateModule(editingModule.moduleId, values);
      message.success('模块更新成功');
      setEditingModule(null);
      setModuleFormOpen(false);
      loadApp();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModule = async (module: ModuleItem) => {
    await deleteModule(module.moduleId);
    message.success('模块已删除');
    loadApp();
  };

  const moreItems: MenuProps['items'] = [
    {
      key: 'offline',
      icon: <CloudUploadOutlined />,
      label: <span onClick={handleOffline}>下线应用</span>,
      disabled: app?.status !== 'PUBLISHED',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定删除应用「${app?.name}」吗？删除后所有模块数据将永久删除。`}
          onConfirm={handleDeleteApp}
        >
          <span>删除应用</span>
        </Popconfirm>
      ),
      disabled: app?.status === 'PUBLISHED',
    },
  ];

  const moduleActions = (module: ModuleItem): MenuProps['items'] => [
    {
      key: 'edit',
      label: '编辑模块',
      onClick: () => {
        setEditingModule(module);
        setModuleFormOpen(true);
      },
    },
    {
      key: 'delete',
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定删除模块「${module.name}」吗？`}
          onConfirm={() => handleDeleteModule(module)}
        >
          <span>删除模块</span>
        </Popconfirm>
      ),
    },
  ];

  const filteredModules = modules.filter(
    (m) => !moduleKeyword || m.name.toLowerCase().includes(moduleKeyword.toLowerCase())
  );

  const formatTime = (v: string) => {
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 更新`;
  };

  if (!app) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps')} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card
        loading={loading}
        title={
          <Space>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: '#f0f5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              <AppstoreOutlined />
            </div>
            <div>
              <Typography.Text strong style={{ fontSize: 18, display: 'block' }}>
                {app.name}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {app.code}
              </Typography.Text>
            </div>
            <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setAppFormOpen(true)}>
              编辑
            </Button>
            {app.status !== 'PUBLISHED' && (
              <Button type="primary" icon={<SendOutlined />} onClick={handlePublish}>
                发布
              </Button>
            )}
            <Dropdown menu={{ items: moreItems }}>
              <Button icon={<MoreOutlined />}>更多操作</Button>
            </Dropdown>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="modules"
          items={[
            {
              key: 'modules',
              label: '模块列表',
              children: (
                <div>
                  <Space style={{ marginBottom: 16 }}>
                    <Input.Search
                      placeholder="搜索模块名称"
                      allowClear
                      onSearch={setModuleKeyword}
                      style={{ width: 240 }}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingModule(null);
                        setModuleFormOpen(true);
                      }}
                    >
                      创建模块
                    </Button>
                  </Space>

                  {filteredModules.length === 0 ? (
                    <Empty description="还没有模块，点击创建第一个模块吧" />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                      {filteredModules.map((module) => (
                        <Card
                          key={module.moduleId}
                          hoverable
                          onClick={() => {
                            if (module.type === 'FORM') {
                              navigate(`/apps/${appId}/modules/${module.moduleId}/form-designer`);
                            } else if (module.type === 'FLOW') {
                              navigate(`/apps/${appId}/modules/${module.moduleId}/flow-designer`);
                            } else {
                              message.info('该类型设计器待实现');
                            }
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Space>
                              {MODULE_TYPE_ICONS[module.type]}
                              <div>
                                <Typography.Text strong>{module.name}</Typography.Text>
                                <div>
                                  <Tag color={MODULE_TYPE_COLORS[module.type]}>
                                    {module.type === 'FORM' ? '表单' : module.type === 'FLOW' ? '流程' : module.type === 'BOARD' ? '看板' : '页面'}
                                  </Tag>
                                </div>
                              </div>
                            </Space>
                            <span onClick={(e) => e.stopPropagation()}>
                              <Dropdown menu={{ items: moduleActions(module) }}>
                                <Button type="text" icon={<MoreOutlined />} />
                              </Dropdown>
                            </span>
                          </div>
                          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                            {module.description || '-'}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                            {formatTime(module.updatedAt)}
                          </Typography.Text>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <div>
                  <Typography.Text strong>应用名称：</Typography.Text>
                  <div>{app.name}</div>
                  <Typography.Text strong>应用编码：</Typography.Text>
                  <div>{app.code}</div>
                  <Typography.Text strong>应用描述：</Typography.Text>
                  <div>{app.description || '-'}</div>
                  <Typography.Text strong>应用分组：</Typography.Text>
                  <div>{app.group || '未分组'}</div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <AppForm
        open={appFormOpen}
        title="编辑应用"
        initial={app}
        groups={[]}
        onOk={handleUpdateApp}
        onCancel={() => setAppFormOpen(false)}
        confirmLoading={submitting}
      />

      <ModuleForm
        open={moduleFormOpen}
        title={editingModule ? '编辑模块' : '创建模块'}
        initial={editingModule}
        onOk={(values) => {
          if (editingModule) {
            return handleUpdateModule(values as ModuleUpdateRequest);
          }
          return handleCreateModule(values as ModuleCreateRequest);
        }}
        onCancel={() => {
          setModuleFormOpen(false);
          setEditingModule(null);
        }}
        confirmLoading={submitting}
      />
    </div>
  );
}
