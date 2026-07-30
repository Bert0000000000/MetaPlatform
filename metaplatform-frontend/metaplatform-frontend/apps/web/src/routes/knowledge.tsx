/** Knowledge base module routes. */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const KnowledgeBasePage = lazy(() => import('../pages/knowledge/KnowledgeBasePage'));
const KnowledgeDocsPage = lazy(() => import('../pages/knowledge/KnowledgeDocsPage'));
const KnowledgeTestPage = lazy(() => import('../pages/knowledge/KnowledgeTestPage'));
const KnowledgeConfigPage = lazy(() => import('../pages/knowledge/KnowledgeConfigPage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const knowledgeRouteElements = {
  KnowledgeBasePage: withBoundary('knowledge.list', <KnowledgeBasePage />),
  KnowledgeDocsPage: withBoundary('knowledge.docs', <KnowledgeDocsPage />),
  KnowledgeTestPage: withBoundary('knowledge.test', <KnowledgeTestPage />),
  KnowledgeConfigPage: withBoundary('knowledge.config', <KnowledgeConfigPage />),
} as const;
