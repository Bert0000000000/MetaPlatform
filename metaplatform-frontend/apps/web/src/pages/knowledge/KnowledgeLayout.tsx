import type { ReactNode } from 'react';
import { AIAssistantTrigger, AIAssistantWorkspace, ModuleTabsLayout, PageRoot, type ModuleTab, usePageAssistant } from '@mate/shared';

/** 知识库 4 个 tab（侧边栏只保留一级「知识库」，二级移到内容区） */
export const KNOWLEDGE_TABS: ModuleTab[] = [
  { key: 'list', label: '知识库列表', path: '/knowledge' },
  { key: 'docs', label: '文档管理', path: '/knowledge/docs' },
  { key: 'test', label: '检索测试', path: '/knowledge/test' },
  { key: 'config', label: '检索配置', path: '/knowledge/config' },
];

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  const assistant = usePageAssistant({
    employeeId: 'knowledge-governor',
    employeeName: '知识治理数字员工',
    employeeDescription: '帮助你管理知识库、文档索引和检索质量',
    moduleLabel: 'Knowledge Base',
    welcomeMessage: '你好，我是知识治理数字员工。可以协助你维护知识资产和检索配置。',
    suggestions: ['检查知识库索引状态', '分析最近的检索质量', '规划文档治理规则'],
  });

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: 48, padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
      <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
    </div>
  );

  return (
    <PageRoot header={header}>
      <AIAssistantWorkspace assistant={assistant}>
        <ModuleTabsLayout tabs={KNOWLEDGE_TABS}>{children}</ModuleTabsLayout>
      </AIAssistantWorkspace>
    </PageRoot>
  );
}
