/**
 * 菜单匹配工具
 *
 * 根据当前 pathname 反查所属模块、当前菜单项及其展开路径。
 */

import { PLATFORM_MENU, type PlatformMenuItem, type PlatformModuleMenu } from '../config/platformMenu';

export interface ActiveMenuResult {
  moduleKey: string;
  itemKey: string;
  openKeys: string[];
}

interface MenuPath {
  item: PlatformMenuItem;
  moduleKey: string;
  module: PlatformModuleMenu;
}

function collectPaths(modules: Record<string, PlatformModuleMenu>): MenuPath[] {
  const result: MenuPath[] = [];
  for (const module of Object.values(modules)) {
    for (const item of module.items) {
      result.push({ item, moduleKey: module.key, module });
    }
  }
  return result;
}

function pathMatches(path: string, pathname: string): boolean {
  if (path === '/') {
    return pathname === '/';
  }
  // 支持 /concepts/:id 形式（仅末尾段）
  if (path.endsWith('/:id')) {
    const prefix = path.slice(0, -4);
    return pathname.startsWith(prefix + '/') && pathname.slice(prefix.length + 1).split('/').length === 1;
  }
  return pathname === path || pathname.startsWith(path + '/');
}

export function findActiveMenu(pathname: string): ActiveMenuResult | null {
  const allPaths = collectPaths(PLATFORM_MENU);
  // 精确匹配优先
  let matched = allPaths.find(({ item }) => item.path === pathname);
  if (!matched) {
    // 最长前缀匹配
    const candidates = allPaths
      .filter(({ item }) => item.path && pathMatches(item.path, pathname))
      .sort((a, b) => (b.item.path?.length || 0) - (a.item.path?.length || 0));
    matched = candidates[0];
  }
  if (!matched) return null;
  return {
    moduleKey: matched.moduleKey,
    itemKey: matched.item.key,
    openKeys: [matched.moduleKey],
  };
}

export function resolveMenuHref(item: PlatformMenuItem): string {
  if (!item.path) return '#';
  if (item.appUrl) {
    return item.appUrl + item.path;
  }
  return item.path;
}
