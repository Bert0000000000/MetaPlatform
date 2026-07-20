import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import * as Icons from '@ant-design/icons';
import { PLATFORM_MENU, type PlatformMenuItem } from '../config/platformMenu';
import { findActiveMenu, resolveMenuHref } from '../utils/menuMatcher';

export interface PlatformMenuProps {
  currentModule: string;
  currentAppUrl?: string;
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
  currentAppUrl?: string,
  onNavigate?: (path: string) => void
): ItemType[] {
  return items.map((item) => {
    const isExternalModule = item.key !== currentModule;
    const href = resolveMenuHref(item, isExternalModule ? item.appUrl : undefined);
    const label = isExternalModule && item.appUrl
      ? item.label
      : item.label;

    const base: any = {
      key: item.key,
      icon: renderIcon(item.icon),
      label,
      onClick: () => {
        if (isExternalModule && item.appUrl && item.path) {
          window.location.href = item.appUrl + item.path;
        } else if (item.path && onNavigate) {
          onNavigate(item.path);
        }
      },
    };

    if (item.children && item.children.length > 0) {
      return {
        ...base,
        children: toAntdItems(item.children, currentModule, currentAppUrl, onNavigate),
      };
    }
    return base;
  });
}

export function PlatformMenu({ currentModule, currentAppUrl, mode = 'inline' }: PlatformMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const active = useMemo(() => findActiveMenu(location.pathname), [location.pathname]);
  const selectedKeys = active?.moduleKey === currentModule ? [active.itemKey] : [];
  const openKeys = active?.moduleKey === currentModule ? active.openKeys : [currentModule];

  const items = useMemo(
    () => toAntdItems(PLATFORM_MENU, currentModule, currentAppUrl, (path) => navigate(path)),
    [currentModule, currentAppUrl, navigate]
  );

  return (
    <Menu
      mode={mode}
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      style={{ height: '100%', borderRight: 0 }}
      items={items}
    />
  );
}
