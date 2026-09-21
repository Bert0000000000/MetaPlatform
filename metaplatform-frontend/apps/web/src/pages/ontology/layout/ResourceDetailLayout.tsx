import type { ReactNode } from 'react';
import { Tabs } from '@douyinfe/semi-ui';
import { PageHeader } from '@/components/skeleton';

export interface ResourceDetailTab {
  key: string;
  label: string;
}

export interface ResourceDetailLayoutProps {
  title: string;
  desc?: string;
  /** 右上动作区（如：编辑 / 发版 / 回滚）。 */
  actions?: ReactNode;
  /** 局部 Tab（一行封顶，设计规格 §2.1 资源详情级约束）。 */
  tabs?: ResourceDetailTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  children: ReactNode;
}

/**
 * 资源详情页布局（ADR-0069 §2.1 第三级导航）。
 *
 * <p>单个资源（ObjectType / ActionType / Function…）的详情容器：标题行 + **至多一行**
 * 局部 Tab。Tab 的状态由调用方持有（IA2-2 起详情 Tab 进 URL，本组件不猜路由形态）。
 *
 * <p>IA2-1 先落组件（设计规格 §8.1 文件清单），IA2-2 的
 * `ObjectTypeDetailPage` 首个接入方——在接入前它不出现在任何路由里。
 */
export default function ResourceDetailLayout({
  title,
  desc,
  actions,
  tabs,
  activeTab,
  onTabChange,
  children,
}: ResourceDetailLayoutProps) {
  return (
    <div className="mp-onto-resource-detail">
      <PageHeader title={title} desc={desc} actions={actions} />
      {tabs && tabs.length > 0 ? (
        <Tabs
          type="button"
          activeKey={activeTab ?? tabs[0].key}
          tabList={tabs.map((t) => ({ tab: t.label, itemKey: t.key }))}
          onChange={(key) => onTabChange?.(key)}
        />
      ) : null}
      <div className="mp-onto-resource-detail-body">{children}</div>
    </div>
  );
}
