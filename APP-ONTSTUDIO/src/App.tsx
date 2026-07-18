import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import ConceptPage from '@/pages/ConceptPage';
import ConceptDetailPage from '@/pages/ConceptDetailPage';
import EntityPage from '@/pages/EntityPage';
import RelationTypePage from '@/pages/RelationTypePage';
import RelationInstancePage from '@/pages/RelationInstancePage';
import RuleManagementPage from '@/pages/RuleManagementPage';
import VersionPage from '@/pages/VersionPage';
import DataSourcePage from '@/pages/DataSourcePage';
import DataMappingPage from '@/pages/DataMappingPage';
import ActionDefinitionPage from '@/pages/ActionDefinitionPage';
import OrchestrationPage from '@/pages/OrchestrationPage';
import TriggerPage from '@/pages/TriggerPage';
import ExecutionMonitorPage from '@/pages/ExecutionMonitorPage';
import KnowledgeGraphPage from '@/pages/KnowledgeGraphPage';
import DataQualityPage from '@/pages/DataQualityPage';
import DataLineagePage from '@/pages/DataLineagePage';
import { isLoggedIn } from '@/utils/auth';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/concepts" replace />} />
          <Route path="concepts" element={<ConceptPage />} />
          <Route path="concepts/:id" element={<ConceptDetailPage />} />
          <Route path="entities" element={<EntityPage />} />
          <Route path="relations" element={<RelationTypePage />} />
          <Route path="relation-instances" element={<RelationInstancePage />} />
          <Route path="rules" element={<RuleManagementPage />} />
          <Route path="versions" element={<VersionPage />} />
          <Route path="datasources" element={<DataSourcePage />} />
          <Route path="mappings" element={<DataMappingPage />} />
          <Route path="actions" element={<ActionDefinitionPage />} />
          <Route path="orchestrations" element={<OrchestrationPage />} />
          <Route path="triggers" element={<TriggerPage />} />
          <Route path="executions" element={<ExecutionMonitorPage />} />
          <Route path="graph" element={<KnowledgeGraphPage />} />
          <Route path="quality" element={<DataQualityPage />} />
          <Route path="lineage" element={<DataLineagePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
