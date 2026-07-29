import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { SubTabs, Breadcrumb, type SubTabItem } from '@mate/shared';
import { useAppTabs } from '../store/appTabs';

export interface AppHeaderProps {
  /** 当前应用的 id（slug） */
  appId: string;
  /** 应用名称（用于 tab 显示） */
  appName: string;
  /** 当前子页面名（用于面包屑第三层，如"数据建模"、"表单设计器"等） */
  currentLabel?: string;
  /** 应用子 tab 列表（不含"应用列表"） */
  subTabs: SubTabItem[];
}

/**
 * 应用模块顶部 header：
 * - 顶部 SubTabs：本应用名称（可关闭）+ 各子功能 tab
 * - 下方 Breadcrumb：应用中心 / 应用名 / 当前页
 */
export default function AppHeader({ appId, appName, currentLabel, subTabs }: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { tabs, activeId, openTab, closeTab } = useAppTabs();

  // Ensure this app tab is registered when the prop appId changes
  useEffect(() => {
    if (!tabs.some((t) => t.id === appId)) {
      openTab({ id: appId, name: appName });
    } else if (activeId !== appId) {
      openTab({ id: appId, name: appName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, appName]);

  // Find the active sub tab label from the matching sub tab path
  const activeSubLabel = useMemo(() => {
    if (currentLabel) return currentLabel;
    let bestLen = -1;
    let label = '';
    subTabs.forEach((t) => {
      if (location.pathname === t.path || location.pathname.startsWith(t.path + '/')) {
        if (t.path.length > bestLen) {
          bestLen = t.path.length;
          label = t.label;
        }
      }
    });
    return label;
  }, [currentLabel, subTabs, location.pathname]);

  const appItem: SubTabItem = {
    label: appName,
    path: `/apps/detail`,
    activePath: '__never',
    closable: true,
    icon: <LayoutGrid style={{ width: 14, height: 14 }} />,
  };

  const items: SubTabItem[] = [appItem, ...subTabs];

  return (
    <>
      <SubTabs
        items={items}
        activePath={location.pathname}
        onClose={(item) => {
          // Closing the app tab: navigate back to apps list and remove from open tabs
          if (item.path === '/apps/detail') {
            closeTab(appId, () => navigate('/apps'));
          }
        }}
      />
      <Breadcrumb
        items={[
          { label: '应用中心', onClick: () => navigate('/apps') },
          { label: appName, onClick: () => navigate('/apps/detail') },
          ...(activeSubLabel ? [{ label: activeSubLabel }] : []),
        ]}
        padding="16px 0 20px 0"
      />
    </>
  );
}