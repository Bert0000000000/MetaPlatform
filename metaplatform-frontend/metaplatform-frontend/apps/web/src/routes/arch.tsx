/** Architecture / enterprise blueprint module routes. */
import { lazy } from 'react';
import { ErrorBoundary } from '@mate/shared';

const ArchBusinessArchPage = lazy(() => import('../pages/arch/BusinessArchPage'));
const ArchCapabilityManagementPage = lazy(() => import('../pages/arch/CapabilityManagementPage'));
const ArchApplicationManagementPage = lazy(() => import('../pages/arch/ApplicationManagementPage'));
const ArchValueStreamPage = lazy(() => import('../pages/arch/ValueStreamPage'));
const ArchBusinessProcessPage = lazy(() => import('../pages/arch/BusinessProcessPage'));
const ArchOrgRolePage = lazy(() => import('../pages/arch/OrgRolePage'));
const ArchDataArchPage = lazy(() => import('../pages/arch/DataArchPage'));
const ArchDataEntityDetailPage = lazy(() => import('../pages/arch/DataEntityDetailPage'));
const ArchDataFlowPage = lazy(() => import('../pages/arch/DataFlowPage'));
const ArchDataStandardPage = lazy(() => import('../pages/arch/DataStandardPage'));
const ArchDataAssetCatalogPage = lazy(() => import('../pages/arch/DataAssetCatalogPage'));
const ArchTechArchPage = lazy(() => import('../pages/arch/TechArchPage'));
const ArchTechComponentPage = lazy(() => import('../pages/arch/TechComponentPage'));
const ArchTechStackPage = lazy(() => import('../pages/arch/TechStackPage'));
const ArchDeploymentTopologyPage = lazy(() => import('../pages/arch/DeploymentTopologyPage'));
const ArchTechRadarPage = lazy(() => import('../pages/arch/TechRadarPage'));
const ArchPrinciplesPage = lazy(() => import('../pages/arch/PrinciplesPage'));
const ArchReviewTemplatePage = lazy(() => import('../pages/arch/ReviewTemplatePage'));
const ArchReviewPage = lazy(() => import('../pages/arch/ReviewPage'));
const ArchTechDebtPage = lazy(() => import('../pages/arch/TechDebtPage'));
const ArchOntologyMappingPage = lazy(() => import('../pages/arch/OntologyMappingPage'));

function withBoundary(name: string, element: React.ReactNode) {
  return <ErrorBoundary moduleName={name}>{element}</ErrorBoundary>;
}

export const archRouteElements = {
  ArchBusinessArchPage: withBoundary('arch.business', <ArchBusinessArchPage />),
  ArchCapabilityManagementPage: withBoundary('arch.capabilities', <ArchCapabilityManagementPage />),
  ArchApplicationManagementPage: withBoundary('arch.applications', <ArchApplicationManagementPage />),
  ArchValueStreamPage: withBoundary('arch.value-streams', <ArchValueStreamPage />),
  ArchBusinessProcessPage: withBoundary('arch.processes', <ArchBusinessProcessPage />),
  ArchOrgRolePage: withBoundary('arch.org-roles', <ArchOrgRolePage />),
  ArchDataArchPage: withBoundary('arch.data', <ArchDataArchPage />),
  ArchDataEntityDetailPage: withBoundary('arch.data.entities', <ArchDataEntityDetailPage />),
  ArchDataFlowPage: withBoundary('arch.data.flows', <ArchDataFlowPage />),
  ArchDataStandardPage: withBoundary('arch.data.standards', <ArchDataStandardPage />),
  ArchDataAssetCatalogPage: withBoundary('arch.data.assets', <ArchDataAssetCatalogPage />),
  ArchTechArchPage: withBoundary('arch.tech', <ArchTechArchPage />),
  ArchTechComponentPage: withBoundary('arch.tech-components', <ArchTechComponentPage />),
  ArchTechStackPage: withBoundary('arch.tech-stacks', <ArchTechStackPage />),
  ArchDeploymentTopologyPage: withBoundary('arch.deployment-topologies', <ArchDeploymentTopologyPage />),
  ArchTechRadarPage: withBoundary('arch.tech-radar', <ArchTechRadarPage />),
  ArchPrinciplesPage: withBoundary('arch.principles', <ArchPrinciplesPage />),
  ArchReviewTemplatePage: withBoundary('arch.review-templates', <ArchReviewTemplatePage />),
  ArchReviewPage: withBoundary('arch.reviews', <ArchReviewPage />),
  ArchTechDebtPage: withBoundary('arch.tech-debt', <ArchTechDebtPage />),
  ArchOntologyMappingPage: withBoundary('arch.ontology-mapping', <ArchOntologyMappingPage />),
} as const;
