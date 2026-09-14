import type { ReactElement } from 'react';
import { Navigate, Route, useParams, useSearchParams } from 'react-router-dom';

/**
 * UI-P0 旧路由 301 全量表（DESIGN-SPEC §2 + UI-P0 新 IA 表）。
 *
 * 约定：
 * - 本文件只做「旧路径 → 新路径」的 301（<Navigate replace>），不注册任何新 IA 路由；
 *   新 IA 路由在 App.tsx 里注册，并行批次只改各自域、不碰这里以外的注册点。
 * - 路径均相对受保护壳（App.tsx 中 path="/" 的父路由）。
 * - 需要保留参数 / query 的场景各配一个小转发组件，避免 `<Navigate to="/x/:id">` 这种
 *   React Router 不会插值的写法。
 */

/** 保留 `*` 子路径透传（用于 /mcp/* → /ki/mcp/*）。 */
function SplatRedirect({ to }: { to: string }) {
  const params = useParams();
  const rest = params['*'];
  return <Navigate to={rest ? `${to}/${rest}` : to} replace />;
}

/** 保留指定路由参数（用于 /knowledge/kb/:kbId、/arch/data/entities/:id）。 */
function ParamRedirect({ to, param }: { to: string; param: string }) {
  const params = useParams();
  const value = params[param];
  if (!value) return <Navigate to={to} replace />;
  return <Navigate to={to.replace(`:${param}`, encodeURIComponent(value))} replace />;
}

/** `/ontology?tab=*` → `/ontology/{explorer,datacenter,model,ops}`（保留 tab / subTab）。 */
function LegacyOntologyIndex() {
  const [searchParams] = useSearchParams();
  const tab = (searchParams.get('tab') ?? '').toLowerCase();

  let base = '/ontology/explorer';
  let tabParam = tab || null;
  if (tab === 'datacenter' || tab === 'data') {
    base = '/ontology/datacenter';
    tabParam = null;
  } else if (tab === 'governance') {
    base = '/ontology/ops';
  } else if (tab === 'concept' || tab === 'modeling' || tab === 'model') {
    base = '/ontology/model';
    tabParam = 'concept';
  } else if (!tab || tab === 'overview') {
    base = '/ontology/explorer';
    tabParam = null;
  }

  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  if (tabParam) next.set('tab', tabParam);
  const qs = next.toString();
  return <Navigate to={qs ? `${base}?${qs}` : base} replace />;
}

/** `/apps?tab=*` → `/apps/{mine,market,templates,designer}`（保留 app/tid 等上下文）。 */
function LegacyAppsIndex() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const target =
    tab === 'market' || tab === 'mp'
      ? '/apps/market'
      : tab === 'my-templates'
        ? '/apps/templates'
        : tab === 'ai-designer'
          ? '/apps/designer'
          : '/apps/mine';

  const next = new URLSearchParams(searchParams);
  next.delete('tab');
  next.delete('mp');
  const qs = next.toString();
  return <Navigate to={qs ? `${target}?${qs}` : target} replace />;
}

/**
 * 旧 AppHub 深链（/apps/:appId[/...]）→ `/apps/mine?app=:appId&tab=...`。
 * React Router 不会插值 <Navigate to> 里的 `:appId`，所以先取 params。
 */
function LegacyAppRoute({
  tab,
}: {
  tab: 'detail' | 'lifecycle' | 'versions' | 'form-designer' | 'flow-designer' | 'page';
}) {
  const { appId, moduleId, versionId, pageId } = useParams<{
    appId: string;
    moduleId: string;
    versionId: string;
    pageId: string;
  }>();
  const query = new URLSearchParams();
  if (tab === 'page') {
    if (pageId) query.set('page', pageId);
    query.set('tab', 'page');
  } else {
    if (appId) query.set('app', appId);
    if (tab !== 'detail') query.set('tab', tab);
    if (moduleId) query.set('module', moduleId);
    if (versionId) query.set('vid', versionId);
  }
  return <Navigate to={`/apps/mine?${query.toString()}`} replace />;
}

/** `/wfe/action-orchestration/:definitionId` → `/superai/plans/:definitionId`。 */
function LegacyActionOrchestration() {
  const { definitionId } = useParams<{ definitionId: string }>();
  return (
    <Navigate
      to={definitionId ? `/superai/plans/${encodeURIComponent(definitionId)}` : '/superai/plans'}
      replace
    />
  );
}

/** `/superai/execution/:id` → `/superai/plans/exec/:id`。 */
function LegacySuperaiExecutionDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate to={id ? `/superai/plans/exec/${encodeURIComponent(id)}` : '/superai/plans'} replace />
  );
}

/** 静态旧路径 → 新路径的一行转发。 */
function r(path: string, to: string, key?: string): ReactElement {
  return <Route key={key ?? path} path={path} element={<Navigate to={to} replace />} />;
}

/** `/marketplace/:templateId`、`/market/:templateId` 带 tid 转发。 */
function LegacyTemplateDeepLink({ base }: { base: string }) {
  const { templateId } = useParams<{ templateId: string }>();
  return (
    <Navigate
      to={templateId ? `${base}?tid=${encodeURIComponent(templateId)}` : base}
      replace
    />
  );
}

export const legacyRedirectRoutes: ReactElement[] = [
  /* ---------- 工作台 ---------- */
  r('dashboard', '/home'),
  r('dashboard/my-apps', '/home/apps'),
  r('dashboard/my-agents', '/agents'),
  r('dashboard/messages', '/home/messages'),
  r('dashboard/portal', '/home/portal'),
  r('dashboard/notifications', '/home/todos'),
  r('dashboard/deliverables', '/home/deliverables'),
  r('dashboard/aiops', '/home/aiops'),
  r('dashboard/settings', '/home/me'),

  /* ---------- 本体 ---------- */
  <Route key="ontology-index" path="ontology" element={<LegacyOntologyIndex />} />,
  r('ontology/action', '/ontology/explorer?tab=action'),
  r('ontology/graph', '/ontology/explorer?tab=graph'),
  r('ontology/objects', '/ontology/explorer?tab=objects'),
  r('ontology/analytics', '/ontology/explorer?tab=analytics'),
  r('ontology/relationship-types', '/ontology/explorer?tab=concept&subTab=relationship'),
  r('ontology/actions', '/ontology/explorer?tab=concept&subTab=action'),
  r('ontology/object-types', '/ontology/explorer'),
  r('ontology/object-types/:rid', '/ontology/explorer'),

  /* ---------- 数字员工（DW 并入） ---------- */
  r('dw/employees', '/agents/employees'),
  r('dw/tasks', '/agents/dw-tasks'),
  r('dw/collaborations', '/agents/dw-collaborations'),
  r('dw/evaluations', '/agents/dw-evaluations'),
  r('dw/learning', '/agents/learning'),
  r('dw/documents', '/agents/documents'),
  r('dw/extraction', '/agents/extraction'),
  r('dw/obs', '/agents/obs'),
  r('dw/a2a', '/agents/external'),

  /* ---------- SuperAI ---------- */
  r('superai', '/superai/chat'),
  r('superai/copilot', '/superai/chat/copilot'),
  r('superai/a2a', '/superai/plans/a2a'),
  r('superai/orchestration', '/superai/plans/orchestration'),
  r('superai/execution', '/superai/plans'),
  <Route
    key="superai-execution-detail"
    path="superai/execution/:id"
    element={<LegacySuperaiExecutionDetail />}
  />,
  r('superai/manual-select', '/superai/plans/manual-select'),
  r('superai/parallel', '/superai/plans/parallel'),
  r('superai/result-aggregation', '/superai/plans/result-aggregation'),
  r('superai/result-summary', '/superai/plans/result-summary'),
  r('superai/employee-match', '/superai/plans/employee-match'),
  r('superai/tasks', '/superai/plans'),
  r('superai/order-review', '/apps/order-review'),
  r('superai/schedule', '/superai/schedules'),
  r('superai/schedule/execute', '/superai/schedules/execute'),
  r('superai/schedule/plan', '/superai/schedules/plan'),
  r('superai/data', '/superai/cost/data'),
  r('superai/report', '/superai/cost/report'),
  <Route key="wfe-action-orchestration" path="wfe/action-orchestration/:definitionId" element={<LegacyActionOrchestration />} />,

  /* ---------- 应用中心 ---------- */
  <Route key="apps-index" path="apps" element={<LegacyAppsIndex />} />,
  <Route key="apps-detail" path="apps/:appId" element={<LegacyAppRoute tab="detail" />} />,
  <Route key="apps-lifecycle" path="apps/:appId/lifecycle" element={<LegacyAppRoute tab="lifecycle" />} />,
  <Route key="apps-versions" path="apps/:appId/versions" element={<LegacyAppRoute tab="versions" />} />,
  <Route
    key="apps-version-detail"
    path="apps/:appId/versions/:versionId"
    element={<LegacyAppRoute tab="versions" />}
  />,
  <Route
    key="apps-form-designer"
    path="apps/:appId/modules/:moduleId/form-designer"
    element={<LegacyAppRoute tab="form-designer" />}
  />,
  <Route
    key="apps-flow-designer"
    path="apps/:appId/modules/:moduleId/flow-designer"
    element={<LegacyAppRoute tab="flow-designer" />}
  />,
  <Route key="apps-page" path="pages/:pageId" element={<LegacyAppRoute tab="page" />} />,
  r('marketplace', '/apps/market'),
  <Route
    key="marketplace-detail"
    path="marketplace/:templateId"
    element={<LegacyTemplateDeepLink base="/apps/market" />}
  />,
  r('market', '/apps/market'),
  <Route
    key="market-detail"
    path="market/:templateId"
    element={<LegacyTemplateDeepLink base="/apps/market" />}
  />,
  r('my-templates', '/apps/templates'),
  r('my-templates/submit', '/apps/templates?submit=1'),
  r('ai-designer', '/apps/designer'),

  /* ---------- 知识与集成 ---------- */
  r('knowledge', '/ki/kb'),
  <Route
    key="knowledge-kb-detail"
    path="knowledge/kb/:kbId"
    element={<ParamRedirect to="/ki/kb/:kbId" param="kbId" />}
  />,
  r('knowledge/docs', '/ki/kb/docs'),
  r('knowledge/config', '/ki/kb/config'),
  r('knowledge/test', '/ki/test'),
  <Route key="mcp-splat" path="mcp/*" element={<SplatRedirect to="/ki/mcp" />} />,

  /* ---------- 数据与治理 ---------- */
  r('arch', '/gov/business'),
  r('arch/business', '/gov/business'),
  r('arch/capabilities', '/gov/business/capabilities'),
  r('arch/applications', '/gov/business/applications'),
  r('arch/value-streams', '/gov/business/value-streams'),
  r('arch/processes', '/gov/business/processes'),
  r('arch/org-roles', '/gov/business/org-roles'),
  r('arch/data', '/gov/data'),
  <Route
    key="arch-data-entity"
    path="arch/data/entities/:id"
    element={<ParamRedirect to="/gov/data/entities/:id" param="id" />}
  />,
  r('arch/data/flows', '/gov/data/flows'),
  r('arch/data/standards', '/gov/data/standards'),
  r('arch/data/assets', '/gov/data/assets'),
  r('arch/tech', '/gov/tech'),
  r('arch/tech-components', '/gov/tech/components'),
  r('arch/tech-stacks', '/gov/tech/stacks'),
  r('arch/deployment-topologies', '/gov/tech/topologies'),
  r('arch/tech-radar', '/gov/tech/radar'),
  r('arch/principles', '/gov/governance/principles'),
  r('arch/review-templates', '/gov/governance/review-templates'),
  r('arch/reviews', '/gov/governance/reviews'),
  r('arch/tech-debt', '/gov/governance/tech-debt'),
  r('arch/ontology-mapping', '/gov/governance/ontology-mapping'),

  /* ---------- 平台管理 ---------- */
  r('admin', '/admin/org/users'),
  r('admin/users', '/admin/org/users'),
  r('admin/permissions', '/admin/org/roles'),
  r('admin/orgs', '/admin/org/tenants'),
  r('admin/logs', '/admin/ops/logs'),
  r('admin/configs', '/admin/platform/configs'),
  r('admin/ai-providers', '/admin/platform/ai-providers'),
  r('admin/operations', '/admin/ops/operations'),
  r('admin/analytics', '/admin/ops/analytics'),
  r('admin/components', '/admin/platform/components'),
];
