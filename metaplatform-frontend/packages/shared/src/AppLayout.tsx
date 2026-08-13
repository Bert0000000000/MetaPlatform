import { useState, type ReactNode } from 'react';
import { Nav, Layout } from '@douyinfe/semi-ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronsLeft, ChevronsRight } from './icons';
import { useAuth } from './auth/AuthProvider';
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

  // 三级 Nav 结构：模块 → 分组（SubNav）→ 页面项
  const navItems = MODULE_MENU.map((m) => ({
    itemKey: m.key,
    text: m.label,
    icon: m.icon,
    items: m.children.map((group) => {
      if (group.children?.length) {
        return {
          itemKey: `${m.key}__${group.key}`,
          text: group.label,
          // 分组 SubNav 带缩进标记，让三级页面项与分组标题层级分明
          indent: true,
          items: group.children
            .filter((c) => c.path)
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
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}
      >
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

        {/* Semi Nav：一级 + 二级菜单 */}
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

        {/* footer：折叠 + 用户 + 退出 */}
        <div
          className="v-sider-footer"
          style={{
            padding: collapsed ? '16px 0 0' : '16px 12px 0',
            borderTop: '1px solid var(--sidebar-border)',
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? '展开菜单' : '收起菜单'}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: collapsed ? '6px' : '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
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
      </Layout.Sider>

      <Layout style={{ height: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
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
                : 'Mate Platform';
              const groupLabel = matched?.groupKey
                ? (MODULE_MENU.find((m) => m.key === currentModuleKey)?.children.find(
                    (g) => g.key === matched.groupKey,
                  )?.label ?? '')
                : '';
              const crumbs: string[] = [];
              if (moduleLabel) crumbs.push(moduleLabel);
              if (groupLabel && groupLabel !== moduleLabel) crumbs.push(groupLabel);
              if (matched && matched.label !== moduleLabel && matched.label !== groupLabel) {
                crumbs.push(matched.label);
              }
              return (
                <>
                  {crumbs.map((crumb, i) => {
                    const isLast = i === crumbs.length - 1;
                    return (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                        {i > 0 && <span style={{ color: 'var(--muted-foreground)' }}>/</span>}
                        <span
                          style={
                            isLast
                              ? { color: 'var(--foreground)', fontWeight: 600, fontSize: 16 }
                              : { color: 'var(--muted-foreground)' }
                          }
                        >
                          {crumb}
                        </span>
                      </span>
                    );
                  })}
                </>
              );
            })()}
          </div>

          {/* 用户信息 + 退出 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--sidebar-foreground)',
                fontSize: 13,
              }}
              title={user?.realName ?? user?.username ?? '当前用户'}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--muted)',
                  flexShrink: 0,
                }}
              >
                <User style={{ width: 16, height: 16, color: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
              </div>
              <span>{user?.realName ?? user?.username ?? '当前用户'}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="退出登录"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <LogOut style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
              退出登录
            </button>
          </div>
        </Layout.Header>

        <Layout.Content
          className="v-content"
          style={{
            padding: '0 24px',
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
