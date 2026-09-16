import { Layout } from '@douyinfe/semi-ui';
import { Outlet, useLocation } from 'react-router-dom';
import IconRail from './IconRail';
import TopBar from './TopBar';
import PageTabs from './PageTabs';
import CommandPalette from './CommandPalette';
import CopilotDock from './CopilotDock';
import { ShellProvider, useShell } from './ShellContext';
import { resolveDomain } from './domains';
import './shell.css';

/**
 * 应用壳 v2（DESIGN-SPEC §3）：Semi Layout 承载。
 * ┌──┬──────────────────────────────┐
 * │R │ Header：面包屑 ∥ ⌘K · 环境 · 通知 · 布局切换 · 用户
 * │A ├──────────────────────────────┤
 * │I │ PageTabs（主 tab + 子 tab 胶囊）
 * │L │ Outlet（页内内容）
 * └──┴──────────────────────────────┘ + CopilotDock（右，可收起）+ CommandPalette（⌘K）
 *
 * 布局模式（side|top）挂在 #app 的 data-nav 上，由 CSS 控制 rail / 顶栏横排的显隐。
 */
function ShellFrame() {
  const location = useLocation();
  const { navMode, copilotOpen } = useShell();
  const domain = resolveDomain(location.pathname);

  return (
    <div
      id="app"
      className="mp-app"
      data-nav={navMode}
      data-copilot={copilotOpen ? 'open' : 'closed'}
    >
      <Layout hasSider className="mp-shell">
        <Layout.Sider className="mp-rail-sider">
          <IconRail active={domain} />
        </Layout.Sider>

        <Layout className="mp-main">
          <Layout.Header className="mp-topbar">
            <TopBar />
          </Layout.Header>

          <Layout.Content className="mp-content">
            <PageTabs />
            <div className="mp-page">
              <Outlet />
            </div>
          </Layout.Content>
        </Layout>

        <CopilotDock />
      </Layout>

      <CommandPalette />
    </div>
  );
}

export default function AppShell() {
  return (
    <ShellProvider>
      <ShellFrame />
    </ShellProvider>
  );
}
