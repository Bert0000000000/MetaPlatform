import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { MENU_TABS, type MenuKey } from "@/config/menu";
import { MenuTabs } from "@/components/MenuTabs";
import { Construction } from "lucide-react";

export interface MenuPageProps {
  menuKey: MenuKey;
  basePath: string;
  activeKey?: string;
  children?: ReactNode;
}

/**
 * 通用菜单页面：顶部 Tab 切换 + 内容区域
 */
export function MenuPage({ menuKey, basePath, activeKey, children }: MenuPageProps) {
  const tabs = MENU_TABS[menuKey];
  if (!tabs) return null;

  return (
    <div className="flex flex-col h-full">
      <MenuTabs basePath={basePath} tabs={tabs} activeKey={activeKey} />
      <div className="flex-1 overflow-y-auto p-6">
        {children ?? <Outlet />}
      </div>
    </div>
  );
}

export function PlaceholderContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-4"><Construction className="size-10" /></div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        {description}
      </p>
    </div>
  );
}