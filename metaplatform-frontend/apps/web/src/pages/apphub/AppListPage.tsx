/**
 * AppListPage —— 应用中心「我的应用」（DESIGN-SPEC §5 版式 C：卡片网格）。
 *
 * 版式：页头 + 模板市场入口 banner + 筛选栏 + 卡片网格（+ 虚线新建卡）。
 * 卡片字段全部来自后端 apphub 列表接口：名称 / 编码 / 分类 / 描述 / 版本 / 标签。
 * 接口未暴露「状态」与「使用次数」，卡片不显示这两项（不编造）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Card, Select, Spin, Tag, Typography, Toast, Popconfirm, Dropdown } from '@douyinfe/semi-ui';
import { CheckCircle2, FileText, LayoutGrid, MoreHorizontal, Pencil, Plus, RefreshCw, Store, Trash2 } from 'lucide-react';
import { listApps, deleteApp, listGroups } from '@/api/apphub/apps';
import AppDesignSheet from './DesignFlowPage';
import { EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import type { AppItem } from '@/api/apphub/types';
import './apps.css';

const SORT_OPTIONS = [
  { value: 'name_asc', label: '名称 A → Z' },
  { value: 'name_desc', label: '名称 Z → A' },
];

/**
 * 应用版本。src/api/apphub/apps.ts 的 mapApp 把后端 `version` 映射进了
 * `AppItem.updatedAt`（字段命名失真，但 API 层本批不动）。这里集中一处读取，
 * 将来 mapper 修正为真实 `version` 字段时只需改这里。
 */
function appVersion(app: AppItem): string {
  return app.updatedAt || '—';
}

export default function AppListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState<string | undefined>();
  const [sort, setSort] = useState('name_asc');

  const designOpen = searchParams.get('design') === '1';
  const designFromId = searchParams.get('from') ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listApps();
      setApps(res.items);
    } catch (e) {
      setApps([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    listGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [load]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const arr = apps.filter((a) => {
      const hitKeyword =
        !kw ||
        a.name.toLowerCase().includes(kw) ||
        a.code.toLowerCase().includes(kw) ||
        (a.description ?? '').toLowerCase().includes(kw);
      return hitKeyword && (!group || a.group === group);
    });
    return [...arr].sort((a, b) =>
      sort === 'name_desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );
  }, [apps, keyword, group, sort]);

  const openDesign = (from?: string) => {
    const next = new URLSearchParams();
    next.set('design', '1');
    if (from) next.set('from', from);
    setSearchParams(next);
  };

  const closeDesign = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('design');
    next.delete('from');
    setSearchParams(next);
  };

  const remove = async (app: AppItem) => {
    try {
      await deleteApp(app.appId);
      Toast.success('应用已删除');
      void load();
    } catch {
      Toast.error('删除失败');
    }
  };

  const openApp = (appId: string) => navigate(`/apps/mine?app=${encodeURIComponent(appId)}`);

  const renderCard = (app: AppItem) => (
    <Card key={app.appId} shadows="hover">
      <div className="mp-app-card-wrap">
        <div className="mp-app-head">
          <span className="mp-app-icon">
            {app.icon === 'FileTextOutlined' ? (
              <FileText size={18} strokeWidth={1.5} />
            ) : (
              <LayoutGrid size={18} strokeWidth={1.5} />
            )}
          </span>
          <div className="mp-app-head-main">
            <div className="mp-app-name" onClick={() => openApp(app.appId)}>
              {app.name}
            </div>
            <div className="mp-app-code">{app.code}</div>
          </div>
        </div>

        <p className="mp-app-desc">{app.description || '暂无描述'}</p>

        <div className="mp-app-meta">
          {app.group ? <Tag size="small">{app.group}</Tag> : null}
          <Tag size="small" color="blue">
            v{appVersion(app)}
          </Tag>
          <span className="mp-app-meta-item">{app.moduleCount} 标签</span>
        </div>
      </div>

      <Dropdown
        position="bottomRight"
        render={
          <Dropdown.Menu>
            <Dropdown.Item icon={<Pencil size={14} strokeWidth={1.5} />} onClick={() => openApp(app.appId)}>
              查看详情
            </Dropdown.Item>
            <Dropdown.Item icon={<Pencil size={14} strokeWidth={1.5} />} onClick={() => openDesign(app.appId)}>
              重新设计
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item>
              <Popconfirm
                title="卸载应用"
                content={`确定卸载「${app.name}」吗？`}
                onConfirm={() => void remove(app)}
              >
                <span>
                  <Trash2 size={14} strokeWidth={1.5} /> 卸载
                </span>
              </Popconfirm>
            </Dropdown.Item>
          </Dropdown.Menu>
        }
      >
        <Button theme="borderless" type="tertiary" icon={<MoreHorizontal size={16} strokeWidth={1.5} />} aria-label="更多操作" />
      </Dropdown>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="应用中心"
        desc={`${apps.length} 个已注册应用`}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => openDesign()}
            >
              创建应用
            </Button>
          </>
        }
      />

      <div className="mp-apps-banner">
        <span className="mp-apps-banner-icon">
          <Store size={18} strokeWidth={1.5} />
        </span>
        <div className="mp-apps-banner-main">
          <div className="mp-apps-banner-title">模板市场</div>
          <div className="mp-apps-banner-desc">安装现成模板，或用 AI 设计器从一句话生成应用骨架。</div>
        </div>
        <Button onClick={() => navigate('/apps/market')}>浏览模板市场</Button>
      </div>

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索应用名称、编码或描述…' }}
        filters={
          <>
            <Select value={group} onChange={(v) => setGroup(v as string | undefined)} placeholder="全部分类" showClear>
              {groups.map((g) => (
                <Select.Option key={g} value={g}>
                  {g}
                </Select.Option>
              ))}
            </Select>
            <Select value={sort} onChange={(v) => setSort(v as string)}>
              {SORT_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>
                  {o.label}
                </Select.Option>
              ))}
            </Select>
          </>
        }
        right={
          <Button
            theme="borderless"
            onClick={() => {
              setKeyword('');
              setGroup(undefined);
            }}
          >
            重置
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="应用列表加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && apps.length === 0 ? (
        <div className="mp-app-loading">
          <Spin size="middle" />
        </div>
      ) : visible.length === 0 && !loading ? (
        <EmptyState
          illustration={apps.length === 0 ? 'no-content' : 'no-result'}
          title={apps.length === 0 ? '还没有应用' : '没有匹配的应用'}
          desc={apps.length === 0 ? '从零创建一个应用，或去模板市场安装一个。' : '调整关键词或分类。'}
          actions={
            <>
              <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={() => openDesign()}>
                创建应用
              </Button>
              <Button onClick={() => navigate('/apps/market')}>前往模板市场</Button>
            </>
          }
        />
      ) : (
        <div className="mp-apps-grid">
          {visible.map(renderCard)}
          <button type="button" className="mp-apps-new" onClick={() => openDesign()}>
            <span className="mp-apps-new-icon">
              <Plus size={18} strokeWidth={1.5} />
            </span>
            创建应用
          </button>
        </div>
      )}

      <Card className="mp-apps-scenario" title="核心业务场景">
        <Typography.Paragraph type="tertiary">
          订单复核：处理高价值未支付订单，生成复核建议并在人工确认后创建跟进单。
        </Typography.Paragraph>
        <Button
          data-testid="apphub-open-order-review"
          theme="solid"
          type="primary"
          icon={<CheckCircle2 size={15} strokeWidth={1.5} />}
          onClick={() => navigate('/apps/order-review')}
        >
          打开订单复核
        </Button>
      </Card>

      <AppDesignSheet
        visible={designOpen}
        onClose={closeDesign}
        onCreated={openApp}
        editingId={designFromId}
      />
    </>
  );
}
