import { lazy } from 'react';
import { Navigate, Route, useSearchParams } from 'react-router-dom';
import '@/pages/ontology/ontology.css';
import OntologyTabLayout from '@/pages/ontology/layout/OntologyTabLayout';
import OverviewPage from '@/pages/ontology/overview/OverviewPage';
import ObjectExplorerPage from '@/pages/ontology/explorer/ObjectExplorerPage';
import ObjectMappingsPage from '@/pages/ontology/data/mappings/ObjectMappingsPage';
import SyncJobsPage from '@/pages/ontology/data/sync/SyncJobsPage';
import OntologyLineagePage from '@/pages/ontology/data/lineage/OntologyLineagePage';
import DraftsPage from '@/pages/ontology/governance/drafts/DraftsPage';
import ReleasesPage from '@/pages/ontology/governance/releases/ReleasesPage';
import UsagePage from '@/pages/ontology/governance/usage/UsagePage';
import LintPage from '@/pages/ontology/governance/lint/LintPage';
import SecurityPage from '@/pages/ontology/governance/security/SecurityPage';
import ImportExportPage from '@/pages/ontology/governance/import-export/ImportExportPage';
import AuditPage from '@/pages/ontology/governance/audit/AuditPage';
import ObjectTypesPage from '@/pages/ontology/model/object-types/ObjectTypesPage';
import ObjectTypeDetailPage from '@/pages/ontology/model/object-types/ObjectTypeDetailPage';
import LinkTypesPage from '@/pages/ontology/model/link-types/LinkTypesPage';
import InterfacesPage from '@/pages/ontology/model/interfaces/InterfacesPage';
import AxiomsPage from '@/pages/ontology/model/axioms/AxiomsPage';
import OntologyGraphPage from '@/pages/ontology/model/graph/OntologyGraphPage';
import ModelValidationPage from '@/pages/ontology/model/validation/ModelValidationPage';
import ActionTypesPage from '@/pages/ontology/logic/actions/ActionTypesPage';
import ActionTypeDetailPage from '@/pages/ontology/logic/actions/ActionTypeDetailPage';
import FunctionsPage from '@/pages/ontology/logic/functions/FunctionsPage';
import FunctionDetailPage from '@/pages/ontology/logic/functions/FunctionDetailPage';
import ActionRunsPage from '@/pages/ontology/logic/runs/ActionRunsPage';
import ActionDesignerPage from '@/pages/ontology/logic/designer/ActionDesignerPage';

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
  <Route path="ontology" element={<OntologyTabLayout />}>
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

    {/* 动作与函数（IA2-5 已拆分）：列表 + :rid 详情（四真 Tab 进 URL）+
        Action 编排（原 OntologyActionPage 迁移）+ 执行记录唯一权威页
        （?action= 深链过滤）。approvals 无真实数据不注册（设计规格 §2.5） */}
    <Route path="logic">
      <Route index element={<Navigate to="actions" replace />} />
      <Route path="actions" element={<ActionTypesPage />} />
      <Route path="actions/:rid" element={<ActionTypeDetailPage />} />
      <Route path="actions/:rid/:tab" element={<ActionTypeDetailPage />} />
      <Route path="functions" element={<FunctionsPage />} />
      <Route path="functions/:rid" element={<FunctionDetailPage />} />
      <Route path="functions/:rid/:tab" element={<FunctionDetailPage />} />
      <Route path="designer" element={<ActionDesignerPage />} />
      <Route path="runs" element={<ActionRunsPage />} />
    </Route>

    {/* 发布与治理（IA2-6 已拆分）：七子页独立成页；Action 审计明细在
        logic/runs（唯一权威页），audit 只做平台级汇总；Agent 指标已删（§7.6） */}
    <Route path="governance">
      <Route index element={<Navigate to="drafts" replace />} />
      <Route path="drafts" element={<DraftsPage />} />
      <Route path="releases" element={<ReleasesPage />} />
      <Route path="usage" element={<UsagePage />} />
      <Route path="lint" element={<LintPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="import-export" element={<ImportExportPage />} />
      <Route path="audit" element={<AuditPage />} />
    </Route>
  </Route>
);
