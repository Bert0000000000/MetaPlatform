import { useLocation, useSearchParams } from 'react-router-dom';
import { Boxes, Store, FileText, Sparkles } from 'lucide-react';
import { PageRoot, SubTabs } from '@mate/shared';
import AppListPage from './AppListPage';
import AppDetailPage from './AppDetailPage';
import AppLifecyclePage from './AppLifecyclePage';
import VersionManagementPage from './VersionManagementPage';
import ReleaseRecordPage from './ReleaseRecordPage';
import FormDesignerPage from './FormDesignerPage';
import FlowDesignerPage from './FlowDesignerPage';
import PageDesignerPage from './PageDesignerPage';
import MarketPage from './MarketPage';
import TemplateDetailPage from './TemplateDetailPage';
import MarketplacePage from './MarketplacePage';
import MarketplaceDetailPage from './MarketplaceDetailPage';
import MyTemplatesPage from './MyTemplatesPage';
import TemplateSubmitPage from './TemplateSubmitPage';
import AIDesignerPage from './AIDesignerPage';

type TabKey = 'list' | 'market' | 'my-templates' | 'ai-designer';

const TABS: Array<{ key: TabKey; label: string; path: string; icon: typeof Boxes }> = [
  { key: 'list', label: '我的应用', path: '/apps', icon: Boxes },
  { key: 'market', label: '模板市场', path: '/apps?tab=market', icon: Store },
  { key: 'my-templates', label: '我的模板', path: '/apps?tab=my-templates', icon: FileText },
  { key: 'ai-designer', label: 'AI 设计器', path: '/apps?tab=ai-designer', icon: Sparkles },
];

function resolveTab(raw: string | null): TabKey {
  if (raw === 'market' || raw === 'my-templates' || raw === 'ai-designer') return raw;
  return 'list';
}

export default function ApphubShellPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const activeTab = resolveTab(searchParams.get('tab'));
  const appId = searchParams.get('app');
  const tid = searchParams.get('tid');
  const vid = searchParams.get('vid');
  const moduleId = searchParams.get('module');
  const mp = searchParams.get('mp');
  const submit = searchParams.get('submit');

  const subTabs = TABS.map((t) => ({
    label: t.label,
    path: t.path,
    activePath: activeTab === t.key ? '/apps' : `/apps?tab=${t.key}`,
  }));

  const switchTab = (key: TabKey) => {
    if (key === activeTab) return;
    const next = new URLSearchParams();
    if (key !== 'list') next.set('tab', key);
    setSearchParams(next, { replace: false });
  };

  // 根据参数分发到具体 page
  const renderBody = () => {
    // 我的应用 + 选中应用 → 详情/子项
    if (activeTab === 'list' && appId) {
      if (vid) return <ReleaseRecordPage />;
      if (moduleId) {
        // module-level 路径细分由 page 内部读 path 区分；
        // 我们用 ?tab=form-designer|flow-designer 决定，Shell 不做 dispatch
        return <div data-app-module-fallback />;
      }
      // 默认进应用详情
      return <AppDetailPage />;
    }
    if (activeTab === 'list' && !appId) return <AppListPage />;
    // 模板市场
    if (activeTab === 'market') {
      if (mp === '1' && tid) return <MarketplaceDetailPage />;
      if (mp === '1') return <MarketplacePage />;
      if (tid) return <TemplateDetailPage />;
      return <MarketPage />;
    }
    // 我的模板
    if (activeTab === 'my-templates') {
      if (submit === '1') return <TemplateSubmitPage />;
      return <MyTemplatesPage />;
    }
    // AI 设计器
    if (activeTab === 'ai-designer') return <AIDesignerPage />;
    return <AppListPage />;
  };

  // 详情子 tab：应用详情内嵌模块/基本信息/发布/短链 tab 由 AppDetailPage 自己管
  // 这里只在选中应用时给一个二级 subtab 让用户能切到 lifecycle / versions / form-designer / flow-designer
  const showAppSubtabs = activeTab === 'list' && !!appId;
  const appSubtab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('mp'); next.delete('tid'); next.delete('vid'); next.delete('module'); next.delete('submit');
    next.set('app', appId || '');
    if (key === 'detail') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: false });
  };

  const stickyHeader = (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 64,
        padding: '0 24px',
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
        <SubTabs
          items={subTabs}
          activePath={activeTab === 'list' ? '/apps' : `/apps?tab=${activeTab}`}
          embedded
        />
      </div>
    </div>
  );

  return (
    <PageRoot header={stickyHeader}>
      {showAppSubtabs && (
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'detail', label: '详情' },
            { key: 'lifecycle', label: '生命周期' },
            { key: 'versions', label: '版本' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => appSubtab(t.key)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'transparent',
                color: (activeTab === t.key || (t.key === 'detail' && !searchParams.get('tab'))) ? 'var(--primary)' : 'var(--muted-foreground)',
                fontSize: 13,
                fontWeight: (activeTab === t.key || (t.key === 'detail' && !searchParams.get('tab'))) ? 600 : 500,
                cursor: 'pointer',
                borderBottom: (activeTab === t.key || (t.key === 'detail' && !searchParams.get('tab'))) ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {renderBody()}
    </PageRoot>
  );
}
