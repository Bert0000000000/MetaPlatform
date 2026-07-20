import { PLATFORM_MENU, type PlatformMenuItem } from '../config/platformMenu';

export interface ActiveMenuResult {
  moduleKey: string;
  itemKey: string;
  openKeys: string[];
}

function collectPaths(
  items: PlatformMenuItem[],
  parents: string[] = []
): Array<{ item: PlatformMenuItem; moduleKey: string; openKeys: string[] }> {
  const result: Array<{ item: PlatformMenuItem; moduleKey: string; openKeys: string[] }> = [];
  for (const item of items) {
    const isModule = parents.length === 0;
    const moduleKey = isModule ? item.key : parents[0];
    const openKeys = isModule ? [item.key] : [...parents, item.key];
    if (item.children && item.children.length > 0) {
      result.push(...collectPaths(item.children, openKeys));
    } else if (item.path) {
      result.push({ item, moduleKey, openKeys });
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
  // 1. 精确匹配优先
  let matched = allPaths.find(({ item }) => item.path === pathname);
  if (!matched) {
    // 2. 最长前缀匹配
    const candidates = allPaths
      .filter(({ item }) => item.path && pathMatches(item.path, pathname))
      .sort((a, b) => (b.item.path?.length || 0) - (a.item.path?.length || 0));
    matched = candidates[0];
  }
  if (!matched) return null;
  return {
    moduleKey: matched.moduleKey,
    itemKey: matched.item.key,
    openKeys: matched.openKeys,
  };
}

export function resolveMenuHref(item: PlatformMenuItem, currentAppUrl?: string): string {
  if (!item.path) return '#';
  if (item.external && item.appUrl) {
    return item.appUrl + item.path;
  }
  return item.path;
}
