import { lazy, type ReactElement } from 'react';
import { Navigate, Route, useSearchParams } from 'react-router-dom';
import '@/pages/ontology/ontology.css';
import OntologyDomainShell from '@/pages/ontology/shell/OntologyDomainShell';
import OverviewPage from '@/pages/ontology/overview/OverviewPage';
import AppsPage from '@/pages/ontology/apps/AppsPage';
import ObjectExplorerPage from '@/pages/ontology/explorer/ObjectExplorerPage';
import DatacenterPage from '@/pages/ontology/datacenter/DatacenterPage';
import ModelingPage from '@/pages/ontology/model/ModelingPage';
import OpsPage from '@/pages/ontology/ops/OpsPage';

/**
 * 本体域（8 域 IA 第 2 域）路由表。
 * 一个域一个文件：并行批次只改自己域的注册点，不再动 App.tsx。
 *
 * 6 个页内 tab（2026-09-17 IA 重排，菜单按用户动线切分）：
 *   /ontology             概览      —— 落地页：基元计数 / 最近执行 / 同步健康 / 快捷入口
 *   /ontology/model       概念建模  —— 基元清单 + 图谱 + 编辑器
 *   /ontology/objects     对象浏览  —— 类型树 + 实例表 + 对象主页（关系可跳 / 执行动作）
 *   /ontology/datacenter  数据中心  —— 数据接入 + 血缘 + 资产清单
 *   /ontology/apps        分析应用  —— 分析工作台 / 仪表盘 / 地图
 *   /ontology/ops         运行治理  —— 版本发布 / 变更审计 / 治理 / AI 回归
 *
 * 两个过渡子路由承接尚未并入宿主 tab 的既有能力（IA-3/IA-5 收编后删除）：
 *   /ontology/ops/actions     旧 Action 编排（flow 编辑器）
 *   /ontology/ops/governance  旧治理页
 */
const OntologyActionPage = lazy(() => import('@/pages/ontology/OntologyActionPage'));
const GovernancePage = lazy(() => import('@/pages/ontology/GovernancePage'));

/**
 * 旧 `/ontology?tab=*` 深链 → 新 6 tab。
 * 知识图谱是模型层的图（节点 ObjectType / 边 LinkType），归概念建模；
 * Action 编排是动作类型的详情编辑器，同在概念建模；治理归运行治理；
 * 分析应用从「运维 → 更多运维工具」下拉提升为一级 tab。
 */
const LEGACY_TAB_TARGET: Record<string, string> = {
  overview: '/ontology',
  objects: '/ontology/objects',
  datacenter: '/ontology/datacenter',
  data: '/ontology/datacenter',
  graph: '/ontology/model',
  concept: '/ontology/model',
  modeling: '/ontology/model',
  model: '/ontology/model',
  action: '/ontology/model',
  governance: '/ontology/ops',
  analytics: '/ontology/apps',
};

/** `/ontology`：无 `?tab=` 时是概览落地页，带旧 tab 参数时转发到新 tab。 */
function OntologyIndexRoute() {
  const [searchParams] = useSearchParams();
  const tab = (searchParams.get('tab') ?? '').trim().toLowerCase();
  const target = LEGACY_TAB_TARGET[tab];
  if (tab && target) return <Navigate to={target} replace />;
  return shelled(<OverviewPage />);
}

/** 统一挂域级外壳（AI 助手 + proposal 抽屉）。 */
function shelled(page: ReactElement): ReactElement {
  return <OntologyDomainShell>{page}</OntologyDomainShell>;
}

export const ontologyRoutes = (
  <>
    <Route path="ontology" element={<OntologyIndexRoute />} />
    <Route path="ontology/model" element={shelled(<ModelingPage />)} />
    <Route path="ontology/objects" element={shelled(<ObjectExplorerPage />)} />
    <Route path="ontology/datacenter" element={shelled(<DatacenterPage />)} />
    <Route path="ontology/apps" element={shelled(<AppsPage />)} />
    <Route path="ontology/ops" element={shelled(<OpsPage />)} />
    <Route path="ontology/ops/actions" element={shelled(<OntologyActionPage />)} />
    <Route path="ontology/ops/governance" element={shelled(<GovernancePage />)} />
  </>
);
