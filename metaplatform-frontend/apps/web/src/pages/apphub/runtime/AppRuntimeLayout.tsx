import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Nav, Layout, Tag } from '@douyinfe/semi-ui';
import { ArrowLeft, Boxes } from 'lucide-react';
import type { RenderNode } from '@/api/apphub/types';
import { NODE_ICONS } from './treeUtils';

/**
 * 应用运行时「应用壳」：全屏独立布局（不套平台 AppLayout），复用 global.css 主题 token。
 * 顶栏：返回平台 + 应用名/版本；侧边栏：Semi Nav 渲染应用的 render_tree（应用内菜单）；
 * 内容区：由父组件（AppRuntimePage）按选中节点的 node_type 渲染好后作为 children 传入。
 */
interface AppRuntimeLayoutProps {
  appName: string;
  version?: string;
  tree: RenderNode[];
  selectedKey: string;
  onSelect: (key: string) => void;
  isDemo?: boolean;
  children: ReactNode;
}

type NavItem = {
  itemKey: string;
  text: string;
  icon: ReactNode;
  items?: NavItem[];
};

/** RenderNode 树 → Semi Nav items，key 用 DFS index 路径，与 flattenLeaves 一致 */
function toNavItems(nodes: RenderNode[], prefix: string): NavItem[] {
  return nodes.map((n, i) => {
    const key = prefix ? `${prefix}-${i}` : `${i}`;
    const Icon = NODE_ICONS[n.node_type] || Boxes;
    const icon = <Icon size={16} strokeWidth={1.5} />;
    if (n.children && n.children.length > 0) {
      return { itemKey: key, text: n.title, icon, items: toNavItems(n.children, key) };
    }
    return { itemKey: key, text: n.title, icon };
  });
}

/** 收集所有分组节点 key，用于默认全展开 */
function collectOpenKeys(nodes: RenderNode[], prefix: string): string[] {
  const keys: string[] = [];
  nodes.forEach((n, i) => {
    const key = prefix ? `${prefix}-${i}` : `${i}`;
    if (n.children && n.children.length > 0) {
      keys.push(key);
      keys.push(...collectOpenKeys(n.children, key));
    }
  });
  return keys;
}

export default function AppRuntimeLayout({
  appName,
  version,
  tree,
  selectedKey,
  onSelect,
  isDemo,
  children,
}: AppRuntimeLayoutProps) {
  const navigate = useNavigate();
  const navItems = toNavItems(tree, '');
  const openKeys = collectOpenKeys(tree, '');

  return (
    <Layout hasSider style={{ height: '100vh', background: 'var(--background)' }}>
      <Layout.Sider style={{ width: 240, height: '100vh', background: 'var(--sidebar)' }}>
        {/* 应用标识 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 20px 12px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Boxes size={20} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {appName}
          </span>
        </div>

        {/* 应用内菜单 */}
        <div style={{ height: 'calc(100vh - 66px)', overflowY: 'auto', overflowX: 'hidden' }}>
          <Nav
            items={navItems}
            selectedKeys={selectedKey ? [selectedKey] : []}
            openKeys={openKeys}
            limitIndent={false}
            onClick={({ itemKey }) => onSelect(itemKey as string)}
            style={{ borderRight: 'none', background: 'transparent', fontSize: 13 }}
          />
        </div>
      </Layout.Sider>

      <Layout style={{ height: '100vh', flex: 1, minWidth: 0, background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
        <Layout.Header
          style={{
            height: 56,
            flexShrink: 0,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/apps')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--semi-color-text-2)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={16} /> 返回平台
          </button>
          {version && <Tag size="small" color="blue">v{version}</Tag>}
        </Layout.Header>

        <Layout.Content
          style={{
            padding: 'var(--mate-content-padding)',
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            background: 'var(--background)',
          }}
        >
          {isDemo && (
            <div
              style={{
                marginBottom: 16,
                padding: '8px 14px',
                borderRadius: 'var(--radius)',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                color: 'var(--semi-color-text-2)',
                fontSize: 12,
              }}
            >
              演示模式：该应用后端尚未返回 render_tree，当前展示内置示例内容。
            </div>
          )}
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
