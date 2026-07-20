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
    const handleClick = () => {
      if (isExternalModule && item.appUrl && item.path) {
        window.location.href = item.appUrl + item.path;
      } else if (item.path && onNavigate) {
        onNavigate(item.path);
      }
    };

    if (item.children && item.children.length > 0) {
      return {
        key: item.key,
        icon: renderIcon(item.icon),
        label: item.label,
        children: toAntdItems(item.children, currentModule, onNavigate),
        onClick: handleClick,
      } as ItemType;
    }

    return {
      key: item.key,
      icon: renderIcon(item.icon),
      label: item.label,
      onClick: handleClick,
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
