import type { ReactNode } from 'react';
import { ModuleTabsLayout, PageRoot, type ModuleTab } from '@mate/shared';

/** 知识库 4 个 tab（侧边栏只保留一级「知识库」，二级移到内容区） */
export const KNOWLEDGE_TABS: ModuleTab[] = [
  { key: 'list', label: '知识库列表', path: '/knowledge' },
  { key: 'docs', label: '文档管理', path: '/knowledge/docs' },
  { key: 'test', label: '检索测试', path: '/knowledge/test' },
  { key: 'config', label: '检索配置', path: '/knowledge/config' },
];

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  return (
    <PageRoot>
      <ModuleTabsLayout tabs={KNOWLEDGE_TABS}>{children}</ModuleTabsLayout>
    </PageRoot>
  );
}
