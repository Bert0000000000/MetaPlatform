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
  Popconfirm,
  Toast,
} from '@douyinfe/semi-ui';
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
  PlayCircleOutlined,
  SendOutlined,
  CloudUploadOutlined,
  ShareAltOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { Search } from 'lucide-react';
import { getApp, updateApp, deleteApp } from '@/api/apphub/apps';
import { createShortlink } from '@/api/apphub/shortlink';
import { listModules, createModule, updateModule, deleteModule } from '@/api/apphub/modules';
import { QRCodeSVG } from 'qrcode.react';
import AppForm from './components/AppForm';
import ModuleForm from './components/ModuleForm';
import './apps.css';
import ReleaseRecordPage from './ReleaseRecordPage';
import type { AppItem, ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, AppStatus, Shortlink } from '@/api/apphub/types';

const STATUS_MAP: Record<AppStatus, { label: string; color: 'blue' | 'green' | 'grey' }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'grey' },
};

const MODULE_TYPE_COLORS: Record<string, 'blue' | 'purple' | 'cyan' | 'orange'> = {
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

export default function AppDetailPage({ appId: appIdProp }: { appId?: string }) {
  const { appId: routeAppId } = useParams<{ appId: string }>();
  const appId = appIdProp || routeAppId;
  const navigate = useNavigate();
  const [app, setApp] = useState<AppItem | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [moduleKeyword, setModuleKeyword] = useState('');
  const [appFormOpen, setAppFormOpen] = useState(false);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shortlink, setShortlink] = useState<Shortlink | null>(null);
  const [shortlinkLoading, setShortlinkLoading] = useState(false);

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
      Toast.success('应用信息已更新');
      setAppFormOpen(false);
      loadApp();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!appId) return;
    await updateApp(appId, { status: 'PUBLISHED' });
    Toast.success('应用已发布');
    loadApp();
  };

  const handleOffline = async () => {
    if (!appId) return;
    await updateApp(appId, { status: 'OFFLINE' });
    Toast.success('应用已下线');
    loadApp();
  };

  const handleDeleteApp = async () => {
    if (!appId) return;
    await deleteApp(appId);
    Toast.success('应用已删除');
    navigate('/apps/mine');
  };

  const handleCreateModule = async (values: ModuleCreateRequest) => {
    if (!appId) return;
    setSubmitting(true);
    try {
      await createModule({ ...values, appId });
      Toast.success('模块创建成功');
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
      Toast.success('模块更新成功');
      setEditingModule(null);
      setModuleFormOpen(false);
      loadApp();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModule = async (module: ModuleItem) => {
    await deleteModule(module.moduleId);
    Toast.success('模块已删除');
    loadApp();
  };

  const handleCreateShortlink = async () => {
    if (!appId) return;
    setShortlinkLoading(true);
    try {
      const sl = await createShortlink(appId);
      setShortlink(sl);
      Toast.success('短链已生成');
    } catch {
      Toast.error('短链生成失败');
    } finally {
      setShortlinkLoading(false);
    }
  };

  const handleCopyShortlink = () => {
    if (!shortlink) return;
    const url = `${window.location.origin}/s/${shortlink.code}`;
    navigator.clipboard?.writeText(url);
    Toast.success('短链已复制');
  };

  const moreMenu = (
    <Dropdown.Menu>
      <Dropdown.Item
        icon={<CloudUploadOutlined />}
        disabled={app?.status !== 'PUBLISHED'}
        onClick={handleOffline}
      >
        下线应用
      </Dropdown.Item>
      <Dropdown.Divider />
      {app?.status === 'PUBLISHED' ? (
        <Dropdown.Item icon={<DeleteOutlined />} disabled>
          删除应用
        </Dropdown.Item>
      ) : (
        <Popconfirm
          title="确认删除"
          content={`确定删除应用「${app?.name}」吗？删除后所有模块数据将永久删除。`}
          onConfirm={handleDeleteApp}
        >
          <Dropdown.Item icon={<DeleteOutlined />}>
            删除应用
          </Dropdown.Item>
        </Popconfirm>
      )}
    </Dropdown.Menu>
  );

  const moduleActions = (module: ModuleItem): React.ReactNode => (
    <Dropdown.Menu>
      <Dropdown.Item
        icon={<EditOutlined />}
        onClick={() => {
          setEditingModule(module);
          setModuleFormOpen(true);
        }}
      >
        编辑模块
      </Dropdown.Item>
      <Dropdown.Divider />
      <Popconfirm
        title="确认删除"
        content={`确定删除模块「${module.name}」吗？`}
        onConfirm={() => handleDeleteModule(module)}
      >
        <Dropdown.Item icon={<DeleteOutlined />}>
          删除模块
        </Dropdown.Item>
      </Popconfirm>
    </Dropdown.Menu>
  );

  const filteredModules = modules.filter(
    (m) => !moduleKeyword || m.name.toLowerCase().includes(moduleKeyword.toLowerCase())
  );

  const formatTime = (v: string) => {
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 更新`;
  };

  if (!app) {
    return <div className="mp-text-center mp-p-8">加载中...</div>;
  }

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps/mine')} className="mp-mb-4">
        返回列表
      </Button>

      <Card
        loading={loading}
        title={
          <Space>
            <div
              className="mp-justify-center mp-text-xl mp-flex-center mp-rounded mp-app-avatar-48"
            >
              <AppstoreOutlined />
            </div>
            <div>
              <Typography.Text strong className="mp-block mp-text-lg">
                {app.name}
              </Typography.Text>
              <Typography.Text type="tertiary" className="mp-text-sm">
                {app.code}
              </Typography.Text>
            </div>
            <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
          </Space>
        }
        headerExtraContent={
          <Space>
            <Button theme="solid" type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(`/s/${app.code}`)}>
              打开应用
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setAppFormOpen(true)}>
              编辑
            </Button>
            {app.status !== 'PUBLISHED' && (
              <Button theme="solid" type="primary" icon={<SendOutlined />} onClick={handlePublish}>
                发布
              </Button>
            )}
            <Dropdown trigger="click" position="bottomRight" render={moreMenu}>
              <Button icon={<MoreOutlined />}>更多操作</Button>
            </Dropdown>
          </Space>
        }
      >
        <Tabs defaultActiveKey="modules">
          <Tabs.TabPane
            tab="模块列表"
            itemKey="modules"
            children={
              <div>
                <Space className="mp-mb-4">
                  <Input
                    showClear
                    prefix={<Search size={16} />}
                    placeholder="搜索模块名称"
                    onEnterPress={(e) => setModuleKeyword((e.target as HTMLInputElement).value)}
                    className="mp-w-240"
                  />
                  <Button
                    theme="solid"
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
                  <div className="mp-gap-4 mp-grid mp-app-grid-auto-240">
                    {filteredModules.map((module) => (
                      <div
                        key={module.moduleId}
                        onClick={() => {
                          if (module.type === 'FORM') {
                            navigate(`/apps/mine?app=${appId}&module=${module.moduleId}&tab=form-designer`);
                          } else if (module.type === 'FLOW') {
                            navigate(`/apps/mine?app=${appId}&module=${module.moduleId}&tab=flow-designer`);
                          } else {
                            Toast.info('该类型设计器待实现');
                          }
                        }}
                        className="mp-clickable"
                      >
                        <Card shadows="hover">
                          <div className="mp-flex mp-justify-between mp-items-start" >
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
                              <Dropdown trigger="click" position="bottomRight" render={moduleActions(module)}>
                                <Button theme="borderless" icon={<MoreOutlined />} />
                              </Dropdown>
                            </span>
                          </div>
                          <Typography.Text type="tertiary" className="mp-mt-2 mp-text-sm mp-block" >
                            {module.description || '-'}
                          </Typography.Text>
                          <Typography.Text type="tertiary" className="mp-mt-2 mp-text-sm mp-block" >
                            {formatTime(module.updatedAt)}
                          </Typography.Text>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
          />
          <Tabs.TabPane
            tab="基本信息"
            itemKey="basic"
            children={
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
            }
          />
          <Tabs.TabPane
            tab="发布记录"
            itemKey="releases"
            children={appId ? <ReleaseRecordPage appId={appId} /> : <Empty description="应用 ID 无效" />}
          />
          <Tabs.TabPane
            tab={
              <span>
                <ShareAltOutlined /> 短链分享
              </span>
            }
            itemKey="shortlink"
            children={
              app.status === 'PUBLISHED' ? (
                <div className="mp-app-max-480">
                  <Typography.Paragraph type="tertiary">
                    为已发布的应用生成短链，便于快速访问与分享。访问短链无需登录鉴权（自决权限）。
                  </Typography.Paragraph>
                  <Space vertical spacing="medium" className="mp-w-full">
                    <Button
                      theme="solid"
                      type="primary"
                      icon={<ShareAltOutlined />}
                      onClick={handleCreateShortlink}
                      loading={shortlinkLoading}
                    >
                      生成短链
                    </Button>
                    {shortlink && (
                      <Card>
                        <Space vertical spacing="tight" className="mp-w-full">
                          <div>
                            <Typography.Text type="tertiary">短链 Code：</Typography.Text>
                            <Typography.Text copyable code>
                              {shortlink.code}
                            </Typography.Text>
                          </div>
                          <div>
                            <Typography.Text type="tertiary">访问链接：</Typography.Text>
                            <Typography.Text link={{ href: `/s/${shortlink.code}`, target: '_blank' }}>
                              {`${window.location.origin}/s/${shortlink.code}`}
                            </Typography.Text>
                          </div>
                          <Button size="small" icon={<CopyOutlined />} onClick={handleCopyShortlink}>
                            复制链接
                          </Button>
                          <div className="mp-text-center mp-mt-2">
                            <QRCodeSVG
                              value={`${window.location.origin}/s/${shortlink.code}`}
                              size={160}
                              level="M"
                              marginSize={4}
                            />
                            <Typography.Text type="tertiary" className="mp-mt-1 mp-block" >
                              扫码访问
                            </Typography.Text>
                          </div>
                        </Space>
                      </Card>
                    )}
                  </Space>
                </div>
              ) : (
                <Empty description="应用发布后可生成短链" />
              )
            }
          />
        </Tabs>
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
