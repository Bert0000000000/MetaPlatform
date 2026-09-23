import { Avatar, Badge, Breadcrumb, Button, Dropdown, Input, Tabs, Tag } from '@douyinfe/semi-ui';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Layers, LogOut, Search, Settings } from 'lucide-react';
import { useAuth } from '@mate/shared';
import { DOMAINS, resolveDomain, resolveDomainTab, resolveSubTab } from './domains';
import { useShell } from './ShellContext';

const ENV_LABEL =
  (import.meta.env.VITE_ENV_LABEL as string | undefined) ?? (import.meta.env.PROD ? 'PRODUCTION' : 'DEV');

/**
 * 顶栏（DESIGN-SPEC §3）：面包屑 ∥ ⌘K 入口 · 环境徽标 · 通知 · 布局切换 · 用户。
 * 顶栏一级导航模式（模式 B）时，8 个域以横向 tab 呈现，rail 隐藏（显隐由 CSS 控制）。
 */
export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCommandOpen, navMode, toggleNavMode } = useShell();
  const { user, logout } = useAuth();

  const domain = resolveDomain(location.pathname);
  const tab = domain ? resolveDomainTab(domain, location.pathname) : undefined;
  const sub = domain ? resolveSubTab(domain, location.pathname) : undefined;

  const crumbs = [
    domain ? { name: domain.label, path: domain.path } : { name: 'Mate Platform' },
    ...(tab && tab.label !== domain?.label ? [{ name: tab.label, path: tab.path }] : []),
    ...(sub && sub.sub.label !== tab?.label ? [{ name: sub.sub.label }] : []),
  ];

  const displayName = user?.realName ?? user?.username ?? '当前用户';

  return (
    <>
      <Tabs
        className="mp-topnav"
        type="line"
        activeKey={domain?.key ?? ''}
        tabList={DOMAINS.map((d) => ({ tab: d.label, itemKey: d.key, icon: d.icon }))}
        onChange={(key) => {
          const target = DOMAINS.find((d) => d.key === key);
          if (target) navigate(target.path);
        }}
      />

      <Breadcrumb
        className="mp-crumbs"
        compact
        routes={crumbs}
        onClick={(item) => {
          const path = (item as { path?: string }).path;
          if (path) navigate(path);
        }}
      />

      <div className="mp-topbar-right">
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
