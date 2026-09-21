import { Tabs } from '@douyinfe/semi-ui';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveDomain, resolveDomainTab, resolveSubTab } from './domains';

/**
 * 页内 tab 行（DESIGN-SPEC §3）：主 tab 用 Semi Tabs type="line"（44px 通栏 sticky），
 * 多子项域再补一行胶囊（Semi Tabs type="button"）。切换即路由。
 * 全局只有这一处横向切换控件 + 一处工作区 segmented，符合「控件预算纪律」。
 *
 * ADR-0069：`navigationMode: 'workspace'` 的域（本体）自带左侧工作区导航，
 * 本组件对其不渲染——判断走 Domain 配置，不做路径字符串特判。
 */
export default function PageTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const domain = resolveDomain(location.pathname);
  if (!domain || domain.navigationMode === 'workspace') return null;

  const activeTab = resolveDomainTab(domain, location.pathname);
  const sub = resolveSubTab(domain, location.pathname);
  const children = activeTab?.children ?? [];

  return (
    <div className="mp-pagetabs">
      <Tabs
        className="mp-pagetabs-line"
        type="line"
        activeKey={activeTab?.key ?? ''}
        tabList={domain.tabs.map((t) => ({
          tab: t.count ? `${t.label} · ${t.count}` : t.label,
          itemKey: t.key,
        }))}
        onChange={(key) => {
          const target = domain.tabs.find((t) => t.key === key);
          if (target) navigate(target.path);
        }}
      />

      {children.length > 1 && (
        <Tabs
          className="mp-subtabs"
          type="button"
          activeKey={sub?.sub.key ?? children[0].key}
          tabList={children.map((c) => ({ tab: c.label, itemKey: c.key }))}
          onChange={(key) => {
            const target = children.find((c) => c.key === key);
            if (target) navigate(target.path);
          }}
        />
      )}
    </div>
  );
}
