/**
 * AppListPage - 应用中心「已安装应用」列表
 * --------------------------------------------------
 * 布局（Semi 全宽单列表 + 筛选）：
 * ┌──────────────────────────────────────────────┐
 * │ Header: 「应用中心」 + 创建按钮(右上)         │
 * │ 筛选条: 搜索 / 分组 / 状态 / 排序             │
 * ├──────────────────────────────────────────────┤
 * │ Card 网格（已安装应用：DESIGNING + PUBLISHED）│
 * └──────────────────────────────────────────────┘
 *
 * 模板市场已迁到云市场，此页只展示已安装应用。
 * 点击卡片进入 AppDetailPage；点击「创建应用」进入 DesignFlowPage 全屏抽屉
 * （3 步：基本信息 / 业务对象 + 菜单 + 表单 + 流程 + 权限 / 发布配置）。
 */
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Tag,
  Typography,
  Toast,
  Popconfirm,
  Dropdown,
  Input,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  PlusOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  FileTextOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { listApps, deleteApp, listGroups } from '@/api/apphub/apps';
import AppDesignSheet from './DesignFlowPage';
import { PageRoot } from '@mate/shared';
import type { AppItem, AppStatus } from '@/api/apphub/types';

const STATUS_MAP: Record<AppStatus, { label: string; color: TagColor }> = {
  DESIGNING: { label: '设计中', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  OFFLINE: { label: '已下线', color: 'grey' },
};

const SORT_OPTIONS = [
  { value: 'updated_desc', label: '最近更新' },
  { value: 'updated_asc', label: '最旧更新' },
  { value: 'name_asc', label: '名称 A → Z' },
  { value: 'name_desc', label: '名称 Z → A' },
];

export default function AppListPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const designOpen = searchParams.get('design') === '1';
  const designFromId = searchParams.get('from') ?? undefined;
  const [group, setGroup] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [sort, setSort] = useState<string>('updated_desc');
  const [groups, setGroups] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      // 仅展示已安装应用（已发布 + 设计中），下线的收纳隐藏
      const res = await listApps({ keyword, group });
      const installed = res.items.filter((a) => a.status === 'DESIGNING' || a.status === 'PUBLISHED');
      setApps(installed);
    } catch {
      Toast.error('加载应用列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    listGroups().then(setGroups).catch(() => setGroups([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedApps = useMemo(() => {
    const arr = [...apps];
    arr.sort((a, b) => {
      switch (sort) {
        case 'updated_asc':
          return a.updatedAt.localeCompare(b.updatedAt);
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
    return arr;
  }, [apps, sort]);

  const handleDelete = async (app: AppItem) => {
    try {
      await deleteApp(app.appId);
      Toast.success('应用已删除');
      load();
    } catch {
      Toast.error('删除失败');
    }
  };

  const formatTime = (v: string) => {
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 更新`;
  };

  const stats = useMemo(() => {
    const total = apps.length;
    const published = apps.filter((a) => a.status === 'PUBLISHED').length;
    const designing = apps.filter((a) => a.status === 'DESIGNING').length;
    return { total, published, designing };
  }, [apps]);

  return (
    <>
      <AppDesignSheet
        visible={designOpen}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete('design');
          next.delete('from');
          setSearchParams(next);
        }}
        onCreated={(appId) => navigate(`/apps/${appId}`)}
        editingId={designFromId}
      />
      <PageRoot>
        <div style={{ padding: '24px 32px 32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Typography.Title heading={3} style={{ margin: 0 }}>
            应用中心
          </Typography.Title>
          <Typography.Text type="tertiary" style={{ fontSize: 13, marginTop: 4 }}>
            管理已安装的应用：进入设计、查看运行状态、发布新版本
          </Typography.Text>
        </div>
        <Button
          theme="solid"
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setSearchParams({ design: '1' })}
        >
          创建应用
        </Button>
      </div>

      {/* 统计 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Card style={{ flex: 1, padding: '14px 20px' }}>
          <Typography.Text type="tertiary" size="small">已安装应用</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{stats.total}</div>
        </Card>
        <Card style={{ flex: 1, padding: '14px 20px' }}>
          <Typography.Text type="tertiary" size="small">已发布</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--semi-color-success)' }}>
            {stats.published}
          </div>
        </Card>
        <Card style={{ flex: 1, padding: '14px 20px' }}>
          <Typography.Text type="tertiary" size="small">设计中</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--semi-color-primary)' }}>
            {stats.designing}
          </div>
        </Card>
      </div>

      {/* 筛选 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          padding: '12px 16px',
          background: 'var(--card)',
          borderRadius: 6,
          border: '1px solid var(--border)',
        }}
      >
        <FilterOutlined style={{ color: 'var(--muted-foreground)' }} />
        <Input
          placeholder="搜索应用名称或编码"
          showClear
          value={keyword}
          onChange={(v) => setKeyword(v)}
          style={{ width: 240 }}
        />
        <Select
          placeholder="应用分组"
          showClear
          style={{ width: 160 }}
          value={group}
          onChange={(v) => setGroup(v as string | undefined)}
        >
          {groups.map((g) => (
            <Select.Option key={g} value={g}>
              {g}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="应用状态"
          showClear
          style={{ width: 160 }}
          value={status}
          onChange={(v) => setStatus(v as string | undefined)}
        >
          <Select.Option value="DESIGNING">设计中</Select.Option>
          <Select.Option value="PUBLISHED">已发布</Select.Option>
        </Select>
        <Select
          value={sort}
          onChange={(v) => setSort(v as string)}
          style={{ width: 140 }}
        >
          {SORT_OPTIONS.map((o) => (
            <Select.Option key={o.value} value={o.value}>
              {o.label}
            </Select.Option>
          ))}
        </Select>
        <Button
          theme="borderless"
          onClick={() => {
            setKeyword('');
            setGroup(undefined);
            setStatus(undefined);
          }}
        >
          重置
        </Button>
      </div>

      {/* 应用列表 */}
      {loading && sortedApps.length === 0 ? (
        <Empty description="正在加载应用..." />
      ) : sortedApps.length === 0 ? (
        <Empty
          description="暂无已安装应用"
          style={{ padding: '48px 0' }}
        >
          <Space spacing={12} style={{ marginTop: 16 }}>
            <Button
              theme="solid"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSearchParams({ design: '1' })}
            >
              从零创建
            </Button>
            <Button
              icon={<SearchOutlined />}
              onClick={() => navigate('/marketplace')}
            >
              前往云市场安装
            </Button>
          </Space>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {sortedApps.map((app) => (
            <Card
              key={app.appId}
              shadows="hover"
              className="app-list-card"
              title={
                <Space>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: 'var(--semi-color-primary-light-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {app.icon === 'FileTextOutlined' ? (
                      <FileTextOutlined style={{ color: 'var(--semi-color-primary)' }} />
                    ) : (
                      <AppstoreOutlined style={{ color: 'var(--semi-color-primary)' }} />
                    )}
                  </div>
                  <div>
                    <Typography.Text strong>{app.name}</Typography.Text>
                    <div>
                      <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                        {app.code}
                      </Typography.Text>
                    </div>
                  </div>
                </Space>
              }
              headerExtraContent={
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    position="bottomRight"
                    render={
                      <Dropdown.Menu>
                        <Dropdown.Item
                          icon={<EditOutlined />}
                          onClick={() => navigate(`/apps/${app.appId}`)}
                        >
                          查看详情
                        </Dropdown.Item>
                        <Dropdown.Item
                          icon={<EditOutlined />}
                          onClick={() => setSearchParams({ design: '1', from: app.appId })}
                        >
                          重新设计
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item>
                          <Popconfirm
                            title="卸载应用"
                            content={`确定卸载「${app.name}」吗？卸载后可在云市场重新安装。`}
                            onConfirm={() => handleDelete(app)}
                          >
                            <span style={{ color: 'var(--semi-color-danger)' }}>
                              <DeleteOutlined /> 卸载
                            </span>
                          </Popconfirm>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    }
                  >
                    <Button
                      theme="borderless"
                      icon={<MoreOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                </div>
              }
            >
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/apps/${app.appId}`)}
              >
                <Typography.Text type="tertiary" ellipsis style={{ maxWidth: 260, fontSize: 13 }}>
                  {app.description || '暂无描述'}
                </Typography.Text>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <Space spacing={12}>
                    <Tag color={STATUS_MAP[app.status].color}>{STATUS_MAP[app.status].label}</Tag>
                    <Typography.Text type="tertiary" size="small">
                      {String(app.moduleCount)} 模块
                    </Typography.Text>
                  </Space>
                  <Typography.Text type="tertiary" size="small">
                    {formatTime(app.updatedAt)}
                  </Typography.Text>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
    </PageRoot>

    <AppDesignSheet
        visible={designOpen}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete('design');
          next.delete('from');
          setSearchParams(next);
        }}
        onCreated={(appId) => navigate(`/apps/${appId}`)}
        editingId={designFromId}
      />

    </>
  );
}
