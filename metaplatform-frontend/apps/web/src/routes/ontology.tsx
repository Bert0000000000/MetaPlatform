import { lazy } from 'react';
import { Navigate, Route, useSearchParams } from 'react-router-dom';
import '@/pages/ontology/ontology.css';
import OntologyWorkspaceLayout from '@/pages/ontology/layout/OntologyWorkspaceLayout';
import OverviewPage from '@/pages/ontology/overview/OverviewPage';
import ObjectExplorerPage from '@/pages/ontology/explorer/ObjectExplorerPage';
import ObjectMappingsPage from '@/pages/ontology/data/mappings/ObjectMappingsPage';
import SyncJobsPage from '@/pages/ontology/data/sync/SyncJobsPage';
import OntologyLineagePage from '@/pages/ontology/data/lineage/OntologyLineagePage';
import OpsPage from '@/pages/ontology/ops/OpsPage';
import ObjectTypesPage from '@/pages/ontology/model/object-types/ObjectTypesPage';
import ObjectTypeDetailPage from '@/pages/ontology/model/object-types/ObjectTypeDetailPage';
import LinkTypesPage from '@/pages/ontology/model/link-types/LinkTypesPage';
import InterfacesPage from '@/pages/ontology/model/interfaces/InterfacesPage';
import AxiomsPage from '@/pages/ontology/model/axioms/AxiomsPage';
import OntologyGraphPage from '@/pages/ontology/model/graph/OntologyGraphPage';
import ModelValidationPage from '@/pages/ontology/model/validation/ModelValidationPage';
import ActionTypesPage from '@/pages/ontology/logic/actions/ActionTypesPage';
import FunctionsPage from '@/pages/ontology/logic/functions/FunctionsPage';

/**
 * 本体域路由表（ADR-0069 IA v2：工作区 + 六大功能域嵌套路由）。
 *
 * 权威路由矩阵见 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md` §4：
 *  - 本文件**独占**全部 `/ontology/*` 新路径的注册（含组根 index redirect）；
 *  - 旧路径 301 一律在 `routes/legacy-redirects.tsx`，两边不重复注册同一路径；
 *  - IA2-1 为过渡批：新路径挂**现有页面**（`initialKind/initialView/initialTab`
 *    Adapter 只定初值），拆分（IA2-2 ~ IA2-6）后逐批换成独立页面并删容器。
 *
 * 尚未拆出的页面（model/validation、data/sync、explore/objects/:rid、
 * logic/actions/:rid 等）**不注册**——没有路由就没有空壳页（设计规格 §2.5）。
 */
const OntologyActionPage = lazy(() => import('@/pages/ontology/OntologyActionPage'));
const GovernancePage = lazy(() => import('@/pages/ontology/GovernancePage'));
const AnalysisPage = lazy(() => import('@/pages/ontology/AnalysisPage'));
const MapPage = lazy(() => import('@/pages/ontology/MapPage'));

/**
 * 旧 `/ontology?tab=*` 深链 → IA v2 路径（迁移矩阵 §4.2 的 query 变体部分；
 * 按路径的旧 301 在 legacy-redirects.tsx）。
 */
const LEGACY_TAB_TARGET: Record<string, string> = {
  overview: '/ontology',
  objects: '/ontology/explore/objects',
  datacenter: '/ontology/data/mappings',
  data: '/ontology/data/mappings',
  graph: '/ontology/model/graph',
  concept: '/ontology/model/object-types',
  modeling: '/ontology/model/object-types',
  model: '/ontology/model/object-types',
  action: '/ontology/logic/actions',
  governance: '/ontology/governance/releases',
  analytics: '/ontology/explore/analysis',
};

/** `/ontology`：无 `?tab=` 时是总览落地页，带旧 tab 参数时转发到新路径。 */
function OntologyIndexRoute() {
  const [searchParams] = useSearchParams();
  const tab = (searchParams.get('tab') ?? '').trim().toLowerCase();
  const target = LEGACY_TAB_TARGET[tab];
  if (tab && target) return <Navigate to={target} replace />;
  return <OverviewPage />;
}

export const ontologyRoutes = (
  <Route path="ontology" element={<OntologyWorkspaceLayout />}>
    <Route index element={<OntologyIndexRoute />} />

    {/* 语义模型（IA2-2 已拆分）：基元各成独立页；:rid 详情四个真 Tab 进 URL */}
    <Route path="model">
      <Route index element={<Navigate to="object-types" replace />} />
      <Route path="object-types" element={<ObjectTypesPage />} />
      <Route path="object-types/:rid" element={<ObjectTypeDetailPage />} />
      <Route path="object-types/:rid/:tab" element={<ObjectTypeDetailPage />} />
      <Route path="link-types" element={<LinkTypesPage />} />
      <Route path="interfaces" element={<InterfacesPage />} />
      <Route path="axioms" element={<AxiomsPage />} />
      <Route path="graph" element={<OntologyGraphPage />} />
      <Route path="validation" element={<ModelValidationPage />} />
    </Route>

    {/* 数据映射（IA2-3 已拆分）：对象映射 / 同步任务 / 本体血缘独立成页；
        全局资产清单（AssetsInventoryPage）移出本体导航，归宿数据与治理域 */}
    <Route path="data">
      <Route index element={<Navigate to="mappings" replace />} />
      <Route path="mappings" element={<ObjectMappingsPage />} />
      <Route path="sync" element={<SyncJobsPage />} />
      <Route path="lineage" element={<OntologyLineagePage />} />
    </Route>

    {/* 对象与查询（IA2-4）：/objects 列表与 /objects/:rid 详情是同一条路由
        （可选段）——打开/关闭/关系跳转不重挂列表，URL 是详情唯一真相 */}
    <Route path="explore">
      <Route index element={<Navigate to="objects" replace />} />
      <Route path="objects/:rid?" element={<ObjectExplorerPage />} />
      <Route path="analysis" element={<AnalysisPage />} />
      <Route path="map" element={<MapPage />} />
    </Route>

    {/* 动作与函数：IA2-2 起动作类型/函数为独立页（从语义模型迁出）；
        designer=原 OntologyActionPage；runs=OpsPage 的 Action 执行记录（audit）。
        actions/:rid 与 functions/:rid 详情随 IA2-5 落地 */}
    <Route path="logic">
      <Route index element={<Navigate to="actions" replace />} />
      <Route path="actions" element={<ActionTypesPage />} />
      <Route path="functions" element={<FunctionsPage />} />
      <Route path="designer" element={<OntologyActionPage />} />
      <Route path="runs" element={<OpsPage initialTab="audit" />} />
    </Route>

    {/* 发布与治理：drafts=OpsPage 的 Schema WIP 草稿面（release tab）；
        releases 暂挂 GovernancePage（branch/diff/rollback 等，IA2-6 拆分）；
        usage/lint/security/import-export/audit 随 IA2-6 逐个拆出后注册 */}
    <Route path="governance">
      <Route index element={<Navigate to="drafts" replace />} />
      <Route path="drafts" element={<OpsPage initialTab="release" />} />
      <Route path="releases" element={<GovernancePage />} />
    </Route>
  </Route>
);
