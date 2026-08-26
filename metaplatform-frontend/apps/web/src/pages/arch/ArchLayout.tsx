import type { ReactNode } from 'react';
import { AIAssistantTrigger, AIAssistantWorkspace, ModuleTabsLayout, PageRoot, type ModuleTab, usePageAssistant } from '@mate/shared';

/**
 * 架构中心 6 个 tab 子页面（单级菜单，顶部 Tab 导航）。
 * 每个 tab 对应一个分区；子页面/详情页通过 matchPaths 归属到父 tab 高亮。
 */
export const ARCH_TABS: ModuleTab[] = [
  {
    key: 'business',
    label: '业务架构',
    path: '/arch/business',
    matchPaths: ['/arch/capabilities', '/arch/value-streams', '/arch/processes', '/arch/org-roles'],
  },
  {
    key: 'application',
    label: '应用架构',
    path: '/arch/applications',
    matchPaths: ['/arch/tech-debt'],
  },
  {
    key: 'data',
    label: '数据架构',
    path: '/arch/data',
    matchPaths: ['/arch/data/flows', '/arch/data/assets', '/arch/data/standards', '/arch/data/entities'],
  },
  {
    key: 'technology',
    label: '技术架构',
    path: '/arch/tech',
    matchPaths: ['/arch/tech-components', '/arch/tech-stacks', '/arch/deployment-topologies', '/arch/tech-radar'],
  },
  {
    key: 'governance',
    label: '架构治理',
    path: '/arch/principles',
    matchPaths: ['/arch/reviews', '/arch/review-templates'],
  },
  {
    key: 'ontology-mapping',
    label: 'Ontology联动',
    path: '/arch/ontology-mapping',
  },
];

/** 架构中心布局：全局 ModuleTabsLayout + 6 个 tab，内容为具体页面 */
export default function ArchLayout({ children }: { children: ReactNode }) {
  const assistant = usePageAssistant({
    employeeId: 'architecture-planner',
    employeeName: '架构规划数字员工',
    employeeDescription: '帮助你分析业务能力、应用关系和架构治理状态',
    moduleLabel: 'Architecture Center',
    welcomeMessage: '你好，我是架构规划数字员工。可以协助你分析能力地图和架构资产。',
    suggestions: ['帮我分析当前业务架构', '找出应用架构的关键依赖', '检查架构治理风险'],
  });

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: 48, padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
      <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
    </div>
  );

  return (
    <PageRoot header={header}>
      <AIAssistantWorkspace assistant={assistant}>
        <ModuleTabsLayout tabs={ARCH_TABS}>{children}</ModuleTabsLayout>
      </AIAssistantWorkspace>
    </PageRoot>
  );
}
