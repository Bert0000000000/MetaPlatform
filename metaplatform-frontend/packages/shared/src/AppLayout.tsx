import { useState, useEffect, type ReactNode } from 'react';
import { Nav, Layout, Dropdown, Badge, Toast } from '@douyinfe/semi-ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronsLeft, ChevronsRight, Settings, MessageCircle } from './icons';
import { useAuth } from './auth/AuthProvider';
import { createApiClient, apiPath } from './api';
import MateLogo from './components/MateLogo';
import { MODULE_MENU, flattenMenu } from './navigation';

export interface AppLayoutProps {
  module?: string;
  children?: ReactNode;
}

const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 64;

/** 二级菜单 itemKey：moduleKey__childKey（避免跨模块重复） */
function childItemKey(moduleKey: string, childKey: string) {
  return `${moduleKey}__${childKey}`;
}

/**
 * 平台框架布局：Semi Layout 官方「侧边栏布局」模板
 * ┌────────┬──────────────────────┐
 * │ Sider  │ Content              │
 * │ Logo   │  页面路由（Outlet）   │
 * │ Nav    │                      │
 * │ footer │                      │
 * └────────┴──────────────────────┘
 */
export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const client = createApiClient({ baseURL: apiPath('dashboard', '') });
    client
      .get<Array<{ read?: boolean }>>('/messages')
      .then((res) => {
        if (!cancelled) {
          setUnreadCount(res.data.filter((m) => !m.read).length);
        }
      })
      .catch(() => {
        // 后端不可达时静默（无红点）
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // 当前路径 → 匹配的页面菜单项（最长前缀）
  const flat = flattenMenu();
  const pathname = location.pathname;
  const matched = flat
    .filter((it) => pathname === it.path || pathname.startsWith(it.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const selectedKey = matched ? childItemKey(matched.moduleKey, matched.key) : undefined;
  const currentModuleKey = matched?.moduleKey;
  // 纯一级模块（无二级菜单，如工作台）：matched 为空时回落到模块自身
  const moduleFallback = !matched
    ? MODULE_MENU.find(
        (m) => pathname === m.path || pathname.startsWith(m.path + '/'),
      )
    : undefined;

  // 三级 Nav 结构：模块 → 分组（SubNav）→ 页面项
  const navItems = MODULE_MENU.map((m) => ({
    itemKey: m.key,
    text: m.label,
    icon: m.icon,
    items: m.children
      .filter((group) => !group.hidden)
      .map((group) => {
        if (group.children?.length) {
          return {
            itemKey: `${m.key}__${group.key}`,
            text: group.label,
            // 分组 SubNav 带缩进标记，让三级页面项与分组标题层级分明
            indent: true,
            items: group.children
              .filter((c) => c.path && !c.hidden)
              .map((c) => ({
                itemKey: childItemKey(m.key, c.key),
                text: c.label,
              })),
          };
        }
        return {
          itemKey: childItemKey(m.key, group.key),
          text: group.label,
        };
      }),
  }));

  return (
    <Layout hasSider className="v-app-layout" style={{ height: '100vh', background: 'var(--background)' }}>
      <Layout.Sider
        className="v-sider"
        style={{
          width,
          height: '100vh',
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Semi Layout.Sider 内部用 .semi-layout-sider-children 包装 children（height:100%），
            把它改成 flex column 才能让「菜单区 flex:1 + 按钮置底」生效 */}
        <style>{`
          .v-sider > .semi-layout-sider-children {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
          }
        `}</style>
        {/* Logo */}
        <div
          className="v-sidebar-logo"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '20px 0 12px' : '20px 20px 12px',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {collapsed ? (
            <MateLogo size={32} variant="color" />
          ) : (
            <>
              <MateLogo size={34} variant="color" />
              <span
                className="v-sidebar-logo-badge"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  lineHeight: 1.15,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>MetaPlatform</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: 2 }}>Ontology</span>
              </span>
            </>
          )}
        </div>

        {/* 一级菜单区域：菜单项 + 置底的「收起」按钮（同一区域内，用分隔线与菜单项隔开） */}
        <div
          className="v-sider-menu-area"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Semi Nav：一级 + 二级菜单（可滚动） */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <Nav
              items={navItems}
              selectedKeys={selectedKey ? [selectedKey] : []}
              openKeys={
                currentModuleKey
                  ? matched?.groupKey
                    ? [currentModuleKey, `${currentModuleKey}__${matched.groupKey}`]
                    : [currentModuleKey]
                  : []
              }
              isCollapsed={collapsed}
              limitIndent={false}
              onClick={({ itemKey }) => {
                const target = flat.find((it) => childItemKey(it.moduleKey, it.key) === itemKey);
                if (target) {
                  navigate(target.path);
                  return;
                }
                // 一级模块项：导航到模块默认路由
                const module = MODULE_MENU.find((m) => m.key === itemKey);
                if (module) navigate(module.path);
              }}
              style={{ borderRight: 'none', background: 'transparent', fontSize: 13 }}
              bodyStyle={{ paddingTop: 0 }}
            />
          </div>

          {/* 分隔线 + 置底的「收起」按钮：与菜单项同属一个区域，但通过分隔线视觉隔离 */}
          <div
            style={{
              flexShrink: 0,
              padding: collapsed ? '10px 8px' : '10px 12px 12px',
              borderTop: '1px solid var(--sidebar-border)',
              background: 'transparent',
            }}
          >
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? '展开菜单' : '收起菜单'}
              className="v-sider-collapse-btn"
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                padding: collapsed ? '8px' : '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {collapsed ? <ChevronsRight size={14} /> : (
                <>
                  <ChevronsLeft size={14} />
                  <span>收起</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Layout.Sider>

      <Layout style={{ height: '100vh', flex: 1, minWidth: 0, background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
        {/* Header：面包屑 + 用户区（官方侧边栏布局模板） */}
        <Layout.Header
          style={{
            height: 56,
            flexShrink: 0,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            background: 'var(--background)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* 页面标题：模块 / 分组 > 页面（最后一层为标题样式，同名层级去重） */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13, minWidth: 0 }}>
            {(() => {
              const moduleLabel = currentModuleKey
                ? (MODULE_MENU.find((m) => m.key === currentModuleKey)?.label ?? '')
                : moduleFallback?.label ?? 'Mate Platform';
              const groupLabel = matched?.groupKey
                ? (MODULE_MENU.find((m) => m.key === currentModuleKey)?.children.find(
                    (g) => g.key === matched.groupKey,
                  )?.label ?? '')
                : '';
              const crumbs: Array<{ label: string; path?: string }> = [];
              const modulePath = MODULE_MENU.find((m) => m.key === currentModuleKey)?.path;
              if (moduleLabel) crumbs.push({ label: moduleLabel, path: modulePath });
              if (groupLabel && groupLabel !== moduleLabel) {
                // 分组点击导航到该分组第一个页面项
                const groupFirstPath = MODULE_MENU.find((m) => m.key === currentModuleKey)
                  ?.children.find((g) => g.key === matched?.groupKey)
                  ?.children?.find((c) => c.path)?.path;
                crumbs.push({ label: groupLabel, path: groupFirstPath });
              }
              if (matched && matched.label !== moduleLabel && matched.label !== groupLabel) {
                crumbs.push({ label: matched.label, path: matched.path });
              }
              return (
                <>
                  {crumbs.map((crumb, i) => {
                    const isLast = i === crumbs.length - 1;
                    return (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                        {i > 0 && <span style={{ color: 'var(--muted-foreground)' }}>/</span>}
                        {!isLast && crumb.path ? (
                          <span
                            style={{
                              color: 'var(--muted-foreground)',
                              cursor: 'pointer',
                              transition: 'color .15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                            onClick={() => navigate(crumb.path as string)}
                          >
                            {crumb.label}
                          </span>
                        ) : (
                          <span
                            style={
                              isLast
                                ? { color: 'var(--foreground)', fontWeight: 600, fontSize: 16 }
                                : { color: 'var(--muted-foreground)' }
                            }
                          >
                            {crumb.label}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </>
              );
            })()}
          </div>

          {/* 用户头像（红点提醒）+ Dropdown 菜单：消息 / 主题 / 语言 / 退出 */}
          <Dropdown
            trigger="click"
            position="bottomRight"
            render={
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => navigate('/dashboard/messages')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MessageCircle style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                    消息中心
                    {unreadCount > 0 && (
                      <Badge count={unreadCount} style={{ transform: 'scale(0.8)' }} />
                    )}
                  </div>
                </Dropdown.Item>
                <Dropdown.Item onClick={() => navigate('/dashboard/settings')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Settings style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                    主题与语言设置
                  </div>
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <LogOut style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                    退出登录
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
              }}
              title={user?.realName ?? user?.username ?? '当前用户'}
            >
              <Badge dot={unreadCount > 0}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--muted)',
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                  }}
                >
                  <User style={{ width: 16, height: 16, color: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
                </div>
              </Badge>
              <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                {user?.realName ?? user?.username ?? '当前用户'}
              </span>
            </div>
          </Dropdown>

        </Layout.Header>

        <Layout.Content
          className="v-content"
          style={{
            padding: '24px 24px 32px',
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children ?? <Outlet />}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
