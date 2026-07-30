/** Agents (digital employees) module routes. */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const AgentsListPage = lazy(() => import('../pages/agents/AgentsListPage'));
const AgentsDetailPage = lazy(() => import('../pages/agents/AgentsDetailPage'));
const AgentsKnowledgePage = lazy(() => import('../pages/agents/AgentsKnowledgePage'));
const AgentsTasksPage = lazy(() => import('../pages/agents/AgentsTasksPage'));
const AgentsCollabPage = lazy(() => import('../pages/agents/AgentsCollabPage'));
const AgentsEvaluationPage = lazy(() => import('../pages/agents/AgentsEvaluationPage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const agentsRouteElements = {
  AgentsListPage: withBoundary('agents.list', <AgentsListPage />),
  AgentsDetailPage: withBoundary('agents.detail', <AgentsDetailPage />),
  AgentsKnowledgePage: withBoundary('agents.knowledge', <AgentsKnowledgePage />),
  AgentsTasksPage: withBoundary('agents.tasks', <AgentsTasksPage />),
  AgentsCollabPage: withBoundary('agents.collab', <AgentsCollabPage />),
  AgentsEvaluationPage: withBoundary('agents.evaluation', <AgentsEvaluationPage />),
} as const;
