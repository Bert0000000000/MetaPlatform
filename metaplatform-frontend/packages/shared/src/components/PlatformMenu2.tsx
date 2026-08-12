import { Nav } from '@douyinfe/semi-ui';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

type SemiNavItem = NonNullable<React.ComponentProps<typeof Nav>['items']>[number];

/**
 * 平台通用多级菜单（一级/二级…）。基于 Semi Nav，封装平台导航语义：
 * - items 支持嵌套 children（二级菜单自动缩进渲染）
 * - 自动按当前路由选中/展开
 * - 点击导航到 `path`；子项 path 缺省时仅为分组（不可点）
 */
export interface PlatformMenu2Item {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  path?: string;
  children?: PlatformMenu2Item[];
}

export interface PlatformMenu2Props {
  items: PlatformMenu2Item[];
  /** 展开根路径前缀，用于高亮/展开（如 '/agents'） */
  rootPath?: string;
  collapsed?: boolean;
  style?: React.CSSProperties;
}

function buildNavTree(items: PlatformMenu2Item[]): SemiNavItem[] {
  return items.map((item) => ({
    itemKey: item.key,
    icon: item.icon,
    text: item.label,
    items: item.children?.length ? buildNavTree(item.children) : undefined,
  }));
}

/** 扁平化所有项以支持按 key/path 反查 */
function flatten(items: PlatformMenu2Item[]): PlatformMenu2Item[] {
  const out: PlatformMenu2Item[] = [];
  const walk = (list: PlatformMenu2Item[]) => {
    for (const it of list) {
      out.push(it);
      if (it.children?.length) walk(it.children);
    }
  };
  walk(items);
  return out;
}

export default function PlatformMenu2({ items, rootPath, collapsed = false, style }: PlatformMenu2Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const flat = useMemo(() => flatten(items), [items]);

  const selectedKeys = useMemo(() => {
    const pathname = location.pathname;
    const hit = flat
      .filter((it) => it.path && (pathname === it.path || pathname.startsWith(it.path + '/')))
      .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0];
    if (hit) return [hit.key];
    return rootPath ? [rootPath] : [];
  }, [location.pathname, flat, rootPath]);

  const openKeys = useMemo(() => {
    const pathname = location.pathname;
    return flat
      .filter((it) => it.children?.length && it.path && (pathname === it.path || pathname.startsWith(it.path + '/')))
      .map((it) => it.key);
  }, [location.pathname, flat]);

  return (
    <Nav
      items={buildNavTree(items)}
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      isCollapsed={collapsed}
      onClick={({ itemKey }) => {
        const target = flat.find((it) => it.key === itemKey);
        if (target?.path) navigate(target.path);
      }}
      style={{ borderRight: 'none', background: 'transparent', fontSize: 13, ...style }}
    />
  );
}
