import { lazy } from 'react';
import { Route } from 'react-router-dom';

/**
 * 数据与治理域（8 域 IA 第 7 域）路由表。
 *
 * 主 tab（壳的 PageTabs）+ 子 tab（胶囊）由 domains.tsx 的 gov 配置驱动，
 * 本文件只注册页面。原 ArchLayout（自带一套侧边/顶部导航）已不再包在这些页面外面，
 * 免得与壳的 tab 行重复；文件留给 P2d 清理。
 */
const BusinessArchPage = lazy(() => import('@/pages/arch/BusinessArchPage'));
const CapabilityManagementPage = lazy(() => import('@/pages/arch/CapabilityManagementPage'));
const ApplicationManagementPage = lazy(() => import('@/pages/arch/ApplicationManagementPage'));
const ValueStreamPage = lazy(() => import('@/pages/arch/ValueStreamPage'));
const BusinessProcessPage = lazy(() => import('@/pages/arch/BusinessProcessPage'));
const OrgRolePage = lazy(() => import('@/pages/arch/OrgRolePage'));
const DataArchPage = lazy(() => import('@/pages/arch/DataArchPage'));
const DataEntityDetailPage = lazy(() => import('@/pages/arch/DataEntityDetailPage'));
const DataFlowPage = lazy(() => import('@/pages/arch/DataFlowPage'));
const DataStandardPage = lazy(() => import('@/pages/arch/DataStandardPage'));
const DataAssetCatalogPage = lazy(() => import('@/pages/arch/DataAssetCatalogPage'));
const TechArchPage = lazy(() => import('@/pages/arch/TechArchPage'));
const TechComponentPage = lazy(() => import('@/pages/arch/TechComponentPage'));
const TechStackPage = lazy(() => import('@/pages/arch/TechStackPage'));
const DeploymentTopologyPage = lazy(() => import('@/pages/arch/DeploymentTopologyPage'));
const TechRadarPage = lazy(() => import('@/pages/arch/TechRadarPage'));
const PrinciplesPage = lazy(() => import('@/pages/arch/PrinciplesPage'));
const ReviewPage = lazy(() => import('@/pages/arch/ReviewPage'));
const ReviewTemplatePage = lazy(() => import('@/pages/arch/ReviewTemplatePage'));
const TechDebtPage = lazy(() => import('@/pages/arch/TechDebtPage'));
const OntologyMappingPage = lazy(() => import('@/pages/arch/OntologyMappingPage'));

export const govRoutes = (
  <>
    {/* 业务架构 */}
    <Route path="gov/business" element={<BusinessArchPage />} />
    <Route path="gov/business/capabilities" element={<CapabilityManagementPage />} />
    <Route path="gov/business/applications" element={<ApplicationManagementPage />} />
    <Route path="gov/business/value-streams" element={<ValueStreamPage />} />
    <Route path="gov/business/processes" element={<BusinessProcessPage />} />
    <Route path="gov/business/org-roles" element={<OrgRolePage />} />

    {/* 数据架构 */}
    <Route path="gov/data" element={<DataArchPage />} />
    <Route path="gov/data/entities/:id" element={<DataEntityDetailPage />} />
    <Route path="gov/data/flows" element={<DataFlowPage />} />
    <Route path="gov/data/standards" element={<DataStandardPage />} />
    <Route path="gov/data/assets" element={<DataAssetCatalogPage />} />

    {/* 技术架构 */}
    <Route path="gov/tech" element={<TechArchPage />} />
    <Route path="gov/tech/components" element={<TechComponentPage />} />
    <Route path="gov/tech/stacks" element={<TechStackPage />} />
    <Route path="gov/tech/topologies" element={<DeploymentTopologyPage />} />
    <Route path="gov/tech/radar" element={<TechRadarPage />} />

    {/* 治理 */}
    <Route path="gov/governance" element={<PrinciplesPage />} />
    <Route path="gov/governance/principles" element={<PrinciplesPage />} />
    <Route path="gov/governance/reviews" element={<ReviewPage />} />
    <Route path="gov/governance/review-templates" element={<ReviewTemplatePage />} />
    <Route path="gov/governance/tech-debt" element={<TechDebtPage />} />
    <Route path="gov/governance/ontology-mapping" element={<OntologyMappingPage />} />
  </>
);
