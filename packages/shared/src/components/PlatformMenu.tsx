import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import * as Icons from '@ant-design/icons';
import { PLATFORM_MENU, type PlatformMenuItem } from '../config/platformMenu';
import { findActiveMenu } from '../utils/menuMatcher';

export interface PlatformMenuProps {
  currentModule: string;
  mode?: 'inline' | 'vertical';
}

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return undefined;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : undefined;
}

function toAntdItems(
  items: PlatformMenuItem[],
  currentModule: string,
  onNavigate?: (path: string) => void
): ItemType[] {
  return items.map((item) => {
    const isExternalModule = item.key !== currentModule;

    // 叶子菜单：点击后在本应用内导航或跨应用跳转。
    if (!item.children || item.children.length === 0) {
      const handleClick = () => {
        if (isExternalModule && item.appUrl && item.path) {
          window.location.href = item.appUrl + item.path;
        } else if (item.path && onNavigate) {
          onNavigate(item.path);
        }
      };
      return {
        key: item.key,
        icon: renderIcon(item.icon),
        label: item.label,
        onClick: handleClick,
      } as ItemType;
    }

    // 含子菜单的节点（一级模块或三级分组）：
    // - 外部模块：点击标题跳转到该模块首页
    // - 当前模块：不绑定点击事件，让 antd 仅处理展开/折叠
    const handleTitleClick = isExternalModule
      ? () => {
          if (item.appUrl && item.path) {
            window.location.href = item.appUrl + item.path;
          }
        }
      : undefined;

    return {
      key: item.key,
      icon: renderIcon(item.icon),
      label: item.label,
      children: toAntdItems(item.children, currentModule, onNavigate),
      onTitleClick: handleTitleClick,
    } as ItemType;
  });
}

export function PlatformMenu({ currentModule, mode = 'inline' }: PlatformMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const active = useMemo(() => findActiveMenu(location.pathname), [location.pathname]);
  const selectedKeys = active?.moduleKey === currentModule ? [active.itemKey] : [];
  const routeOpenKeys = useMemo(
    () => (active?.moduleKey === currentModule ? active.openKeys : [currentModule]),
    [active, currentModule]
  );

  const [openKeys, setOpenKeys] = useState<string[]>(routeOpenKeys);

  useEffect(() => {
    setOpenKeys((prev) => {
      // 仅在路由驱动的展开项真正变化时才更新，避免数组引用变化导致无限渲染
      if (prev.length === routeOpenKeys.length && prev.every((k, i) => k === routeOpenKeys[i])) {
        return prev;
      }
      return routeOpenKeys;
    });
  }, [routeOpenKeys]);

  const items = useMemo(
    () => toAntdItems(PLATFORM_MENU, currentModule, (path) => navigate(path)),
    [currentModule, navigate]
  );

  return (
    <Menu
      mode={mode}
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
      style={{ height: '100%', borderRight: 0 }}
      items={items}
    />
  );
}
