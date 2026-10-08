import { Avatar, Badge, Breadcrumb, Button, Dropdown, Input, Tabs, Tag } from '@douyinfe/semi-ui';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Layers, LogOut, MessageSquare, Search, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '@mate/shared';
import { DOMAINS, navigationBreadcrumb, primaryDomains, resolveDomain } from './domains';
import { useShell } from './ShellContext';

const ENV_LABEL =
  (import.meta.env.VITE_ENV_LABEL as string | undefined) ?? (import.meta.env.PROD ? 'PRODUCTION' : 'DEV');

/**
 * 顶栏（DESIGN-SPEC §3）：面包屑 ∥ ⌘K 入口 · 环境徽标 · 通知 · 布局切换 · 用户。
 * 顶栏一级导航模式时，七入口以横向 tab 呈现，rail 隐藏（显隐由 CSS 控制）。
 */
export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCommandOpen, openCopilot, navMode, toggleNavMode } = useShell();
  const { user, logout } = useAuth();

  const domain = resolveDomain(location.pathname);
  const displayCrumbs = navigationBreadcrumb(location.pathname);

  const displayName = user?.realName ?? user?.username ?? '当前用户';

  return (
    <>
      <button type="button" className="mp-platform-brand" onClick={() => navigate('/home')} aria-label="MetaPlatform 工作台">
        <span className="mp-platform-brand-mark"><Layers size={19} strokeWidth={1.5} /></span>
        <span className="mp-platform-brand-name">MetaPlatform</span>
      </button>
      <Tabs
        className="mp-topnav"
        type="line"
        activeKey={domain?.key ?? ''}
        tabList={primaryDomains().map((d) => ({ tab: d.label, itemKey: d.key, icon: d.icon }))}
        onChange={(key) => {
          const target = DOMAINS.find((d) => d.key === key);
          if (target) navigate(target.path);
        }}
      />

      <Breadcrumb
        className="mp-crumbs"
        aria-label={domain?.key === 'ontology' ? '本体上下文' : '工作区上下文'}
        compact
        routes={displayCrumbs}
        onClick={(item) => {
          const path = (item as { path?: string }).path;
          if (path) navigate(path);
        }}
      />

      <div className="mp-topbar-right">
        <Button theme="borderless" type="tertiary" icon={<Sparkles size={17} />}
          aria-label="打开 SuperAI Copilot" title="SuperAI Copilot" onClick={openCopilot} />
        <Button theme="borderless" type="tertiary" icon={<MessageSquare size={17} />}
          aria-label="打开 SuperAI 会话" title="SuperAI 完整会话"
          onClick={() => navigate(DOMAINS.find(entry => entry.key === 'superai')!.path)} />
        <Input
          className="mp-searchbar"
          prefix={<Search size={15} strokeWidth={1.5} />}
          suffix={<span className="mp-kbd">Ctrl K</span>}
          placeholder="搜索对象、员工、应用…"
          readonly
          aria-label="打开命令面板"
          onClick={() => setCommandOpen(true)}
          onFocus={() => setCommandOpen(true)}
        />

        <Tag className="mp-env-chip" color="amber" type="light">
          {ENV_LABEL}
        </Tag>

        <Button
          theme="borderless"
          type="tertiary"
          icon={
            <Badge dot>
              <Bell size={17} strokeWidth={1.5} />
            </Badge>
          }
          aria-label="通知"
          onClick={() => navigate('/home/todos')}
        />

        <Button
          theme="borderless"
          type="tertiary"
          icon={<Layers size={17} strokeWidth={1.5} />}
          aria-label="切换导航布局"
          title={navMode === 'side' ? '切换为顶栏导航' : '切换为侧栏导航'}
          onClick={toggleNavMode}
        />

        <Dropdown
          trigger="click"
          position="bottomRight"
          render={
            <Dropdown.Menu>
              <Dropdown.Item
                onClick={() => {
                  navigate('/home/me');
                }}
              >
                <span className="mp-menu-item">
                  <Settings size={14} strokeWidth={1.5} />
                  主题与语言设置
                </span>
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
              >
                <span className="mp-menu-item">
                  <LogOut size={14} strokeWidth={1.5} />
                  退出登录
                </span>
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <span className="mp-user" title={displayName}>
            <Avatar size="extra-small" color="blue">
              {displayName.slice(0, 1)}
            </Avatar>
            <span className="mp-user-name">{displayName}</span>
          </span>
        </Dropdown>
      </div>
    </>
  );
}
