import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs } from '@douyinfe/semi-ui';
import { AIAssistantTrigger, AIAssistantWorkspace, usePageAssistant } from '@mate/shared';
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
import './apps.css';

type TabKey = 'mine' | 'market' | 'templates' | 'designer';

/**
 * 主 tab 由路径决定（DESIGN-SPEC §3：页内主 tab 切换即路由，tab 行由壳渲染）。
 * `?tab=` 只承担「应用详情内的二级视图」，与主 tab 不再共用一套语义。
 */
function tabFromPath(pathname: string): TabKey {
  if (pathname.startsWith('/apps/market')) return 'market';
  if (pathname.startsWith('/apps/templates')) return 'templates';
  if (pathname.startsWith('/apps/designer')) return 'designer';
  return 'mine';
}

/** 应用详情内的二级视图（`/apps/mine?app=x&tab=...`）。 */
const APP_SUB_VIEWS = [
  { key: 'detail', label: '详情' },
  { key: 'lifecycle', label: '生命周期' },
  { key: 'versions', label: '版本' },
];

export default function ApphubShellPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = tabFromPath(pathname);
  const appId = searchParams.get('app');
  const tid = searchParams.get('tid');
  const vid = searchParams.get('vid');
  const moduleId = searchParams.get('module');
  const pageId = searchParams.get('page');
  const mp = searchParams.get('mp');
  const submit = searchParams.get('submit');
  const requestedTab = searchParams.get('tab');
  const appDetailTab = appId ? (requestedTab ?? 'detail') : undefined;

  const assistant = usePageAssistant({
    employeeId: 'application-designer',
    employeeName: '应用设计数字员工',
    employeeDescription: '帮助你设计应用、模块和页面，并检查发布准备状态',
    moduleLabel: 'AppHub',
    welcomeMessage: '你好，我是应用设计数字员工。可以协助你规划应用和页面。',
    suggestions: ['帮我规划一个业务应用', '检查当前应用的发布准备度', '设计一个数据看板页面'],
  });

  /** 详情二级视图切换：保留 app 上下文，只改 `?tab=`。 */
  const switchAppView = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('mp');
    next.delete('tid');
    next.delete('vid');
    next.delete('module');
    next.delete('page');
    next.delete('submit');
    next.set('app', appId ?? '');
    if (key === 'detail') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: false });
  };

  const renderBody = () => {
    if (requestedTab === 'page' && pageId) {
      return <PageDesignerPage pageId={pageId} />;
    }

    if (tab === 'mine') {
      if (!appId) return <AppListPage />;
      if (vid) return <ReleaseRecordPage appId={appId} />;
      if (moduleId && appDetailTab === 'form-designer') {
        return <FormDesignerPage appId={appId} moduleId={moduleId} />;
      }
      if (moduleId && appDetailTab === 'flow-designer') {
        return <FlowDesignerPage appId={appId} moduleId={moduleId} />;
      }
      if (appDetailTab === 'lifecycle') return <AppLifecyclePage appId={appId} />;
      if (appDetailTab === 'versions') return <VersionManagementPage appId={appId} />;
      return <AppDetailPage appId={appId} />;
    }

    if (tab === 'market') {
      if (mp === '1' && tid) return <MarketplaceDetailPage />;
      if (mp === '1') return <MarketplacePage />;
      if (tid) return <TemplateDetailPage />;
      return <MarketPage />;
    }

    if (tab === 'templates') {
      if (submit === '1') return <TemplateSubmitPage />;
      return <MyTemplatesPage />;
    }

    return <AIDesignerPage />;
  };

  const showAppViews = tab === 'mine' && !!appId && !vid && !moduleId && requestedTab !== 'page';

  return (
    <div className="mp-apps-shell">
      <AIAssistantWorkspace assistant={assistant}>
        <div className="mp-apps-shell-main">
          {showAppViews ? (
            <Tabs
              className="mp-app-subtabs"
              type="button"
              activeKey={appDetailTab ?? 'detail'}
              tabList={APP_SUB_VIEWS.map((v) => ({ tab: v.label, itemKey: v.key }))}
              onChange={switchAppView}
            />
          ) : null}
          {renderBody()}
        </div>
      </AIAssistantWorkspace>

      <div className="mp-apps-ai-dock">
        <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
      </div>
    </div>
  );
}
