import { lazy, useState, type ReactElement } from 'react';
import { Route, useSearchParams } from 'react-router-dom';
import { Button } from '@douyinfe/semi-ui';
import { Plus } from 'lucide-react';
import '@/pages/ontology/ontology.css';
import OntologyDomainShell from '@/pages/ontology/shell/OntologyDomainShell';
import ObjectExplorerPage from '@/pages/ontology/explorer/ObjectExplorerPage';
import DatacenterPage from '@/pages/ontology/datacenter/DatacenterPage';
import ModelingPage from '@/pages/ontology/model/ModelingPage';
import OpsPage from '@/pages/ontology/ops/OpsPage';

/**
 * 本体域（8 域 IA 第 2 域）路由表。
 * 一个域一个文件：并行批次只改自己域的注册点，不再动 App.tsx。
 *
 * 4 个页内 tab（DESIGN-SPEC §2/§3）：
 *   /ontology/explorer   对象浏览器（B 骨架）
 *   /ontology/datacenter 数据中心（F 骨架：图谱 / 血缘 / 资产）
 *   /ontology/model      类型建模（E 骨架，12 基元清单）
 *   /ontology/ops        运维（E 骨架：接入 / 版本 / 审计）
 *
 * 三个过渡子路由承接尚未重写的既有能力（P2 收编）：
 *   /ontology/model/editor   ObjectType 编辑器（precheck 去重 + HITL 合并）
 *   /ontology/ops/actions    旧 Action 编排（flow 编辑器）
 *   /ontology/ops/governance 旧治理页
 *   /ontology/ops/analytics  旧分析应用页
 */
const OntologyModelingPage = lazy(() => import('@/pages/ontology/OntologyModelingPage'));
const OntologyActionPage = lazy(() => import('@/pages/ontology/OntologyActionPage'));
const GovernancePage = lazy(() => import('@/pages/ontology/GovernancePage'));
const AnalyticsTab = lazy(() => import('@/pages/ontology/AnalyticsTab'));

/**
 * 类型编辑器：?new=1 直接进入新建态。
 * 「新建概念」按钮原先挂在旧 OntologyShellPage 的 sticky 头上，这里在新壳下重新挂出，
 * 否则编辑器只剩只读清单、丢掉新建入口。
 */
function ModelEditorRoute() {
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  return (
    <>
      <div className="mp-onto-editor-bar">
        <Button
          theme="solid"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.5} />}
          onClick={() => setCreateOpen(true)}
        >
          新建概念
        </Button>
      </div>
      <OntologyModelingPage createOpen={createOpen} setCreateOpen={setCreateOpen} />
    </>
  );
}

/** 统一挂域级外壳（AI 助手 + proposal 抽屉）。 */
function shelled(page: ReactElement): ReactElement {
  return <OntologyDomainShell>{page}</OntologyDomainShell>;
}

export const ontologyRoutes = (
  <>
    {/* /ontology（含旧 ?tab=*）的入口转发在 routes/legacy-redirects.tsx */}
    <Route path="ontology/explorer" element={shelled(<ObjectExplorerPage />)} />
    <Route path="ontology/datacenter" element={shelled(<DatacenterPage />)} />
    <Route path="ontology/model" element={shelled(<ModelingPage />)} />
    <Route path="ontology/model/editor" element={shelled(<ModelEditorRoute />)} />
    <Route path="ontology/ops" element={shelled(<OpsPage />)} />
    <Route path="ontology/ops/actions" element={shelled(<OntologyActionPage />)} />
    <Route path="ontology/ops/governance" element={shelled(<GovernancePage />)} />
    <Route path="ontology/ops/analytics" element={shelled(<AnalyticsTab />)} />
  </>
);
