import { Tabs } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface ModuleTab {
  key: string;
  label: string;
  /** 点击 tab 跳转的路由 */
  path: string;
  /** 该 tab 下需要高亮的其它路由（子页面 / 详情页），默认只匹配 path */
  matchPaths?: string[];
}

export interface ModuleTabsLayoutProps {
  tabs: ModuleTab[];
  children?: ReactNode;
  /** 内容区 padding（默认 20px 0 24px） */
  contentPadding?: string;
}

/**
 * 全局「一级 Tab + 内容」布局：顶部 Semi Tabs 栏，下方内容区。
 *
 * 用于架构中心、后台管理等「单级菜单 + 若干 tab 子页面」的模块。
 * 激活 tab 由 URL 推导（精确匹配 + 前缀匹配），子页面路由通过 matchPaths 归属到父 tab。
 */
export default function ModuleTabsLayout({ tabs, children, contentPadding = '20px 0 24px' }: ModuleTabsLayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeTab = (() => {
    let best: ModuleTab | undefined;
    let bestLen = -1;
    for (const t of tabs) {
      const candidates = [t.path, ...(t.matchPaths ?? [])];
      for (const p of candidates) {
        if (pathname === p || pathname.startsWith(p + '/')) {
          if (p.length > bestLen) {
            bestLen = p.length;
            best = t;
          }
        }
      }
    }
    return best ?? tabs[0];
  })();

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab.key}
        onChange={(key) => {
          const tab = tabs.find((t) => t.key === key);
          if (tab) navigate(tab.path);
        }}
        tabList={tabs.map((t) => ({ tab: t.label, itemKey: t.key }))}
        tabBarStyle={{ marginBottom: 0 }}
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: contentPadding }}>
        {children}
      </div>
    </div>
  );
}
