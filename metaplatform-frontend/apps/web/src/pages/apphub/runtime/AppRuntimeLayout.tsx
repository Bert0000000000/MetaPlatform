import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Nav, Layout, Tag } from '@douyinfe/semi-ui';
import { ArrowLeft, Boxes } from 'lucide-react';
import type { RenderNode } from '@/api/apphub/types';
import { NODE_ICONS } from './treeUtils';
import '../apps.css';

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
    <Layout hasSider className="mp-apprt-root">
      <Layout.Sider className="mp-w-240 mp-apprt-sider">
        {/* 应用标识 */}
        <div className="mp-flex-center mp-gap-2 mp-apprt-brand">
          <div
            className="mp-justify-center mp-shrink-0 mp-flex-center mp-rounded mp-apprt-logo"
          >
            <Boxes size={20} strokeWidth={1.5} />
          </div>
          <span className="mp-hidden mp-text-lg mp-text-1 mp-nowrap mp-ellipsis-text mp-apprt-name">
            {appName}
          </span>
        </div>

        {/* 应用内菜单 */}
        <div className="mp-overflow-y-auto mp-apprt-menu">
          <Nav
            items={navItems}
            selectedKeys={selectedKey ? [selectedKey] : []}
            openKeys={openKeys}
            limitIndent={false}
            onClick={({ itemKey }) => onSelect(itemKey as string)}
            className="mp-text-body mp-apprt-nav"
          />
        </div>
      </Layout.Sider>

      <Layout className="mp-flex mp-flex-1 mp-flex-col mp-apprt-root">
        <Layout.Header
          className="mp-justify-between mp-border mp-shrink-0 mp-flex-center mp-bg-1 mp-apprt-header"
        >
          <button
            type="button"
            onClick={() => navigate('/apps/mine')}
            className="mp-inline-flex mp-items-center mp-clickable mp-gap-1 mp-text-body mp-text-2 mp-border-none mp-apprt-back"
          >
            <ArrowLeft size={16} /> 返回平台
          </button>
          {version && <Tag size="small" color="blue">v{version}</Tag>}
        </Layout.Header>

        <Layout.Content
          className="mp-overflow-auto mp-min-h-0 mp-flex-1 mp-apprt-content"
        >
          {isDemo && (
            <div
              className="mp-border mp-rounded mp-mb-4 mp-text-sm mp-text-2 mp-py-2 mp-px-3 mp-bg-fill-0"
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
