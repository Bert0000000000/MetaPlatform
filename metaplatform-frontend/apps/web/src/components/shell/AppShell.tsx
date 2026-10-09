import { Layout } from '@douyinfe/semi-ui';
import { Outlet, useLocation } from 'react-router-dom';
import IconRail from './IconRail';
import TopBar from './TopBar';
import WorkspaceNavigation from './WorkspaceNavigation';
import CommandPalette from './CommandPalette';
import CopilotDock from './CopilotDock';
import { ShellProvider, useShell } from './ShellContext';
import { resolveDomain } from './domains';
import './shell.css';

/** Seven product entries → workspace groups → current-group pages → resource detail tabs.
 * Semi Layout retains full-height descendants and the existing Copilot/command palette.
 * Persisted side/top mode controls the primary entry surface through data-nav.
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
      data-workspace={domain?.navigationMode === 'workspace'}
    >
      <Layout hasSider className="mp-shell">
        <Layout.Sider className="mp-rail-sider semi-always-dark">
          <IconRail active={domain} />
        </Layout.Sider>

        <Layout className="mp-main">
          <Layout.Header className="mp-topbar">
            <TopBar />
          </Layout.Header>

          <Layout.Content className="mp-content">
            <WorkspaceNavigation>
              <Outlet />
            </WorkspaceNavigation>
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
