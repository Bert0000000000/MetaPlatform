import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { setOntologyNavigation } from '../hooks/assistantContext';
import './shell.css';

/**
 * 本体域域级外壳。
 *
 * 只做两件事：
 *  1. 承载全幅页的高度约束（`.mp-onto-shell` / `.mp-onto-shell-main`）；
 *  2. 给非全幅页补默认 gutter，让全幅页（对象浏览器 / 数据中心）自己接管留白
 *     —— 见 shell.css 的 `:has(> .mp-page-full)` 规则。
 *
 * 2026-09-17：域内的浮动「AI 助手」入口（AIAssistantWorkspace + Trigger + 提案抽屉）
 * 已移除。AI 能力统一走顶栏的全局 SuperAI Copilot，不再在域内另起一个入口。
 *
 * 2026-09-18（ADR-0065 S2）：域级壳开始承担**navigation 写入**。它包着全部本体路由，
 * 是唯一知道"用户在本体域的哪个视图"的地方，所以路由态由它发布到域级 store——全局
 * Copilot 与 `useOntologyAssistant` 都在别的 React 树上，靠 store 而不是 Context 传递
 * （见 `assistantContext.ts` 的模块注释）。写的是**语义视图名 + 原始 URL**，不是页面
 * 快照：源记录由 agent 按 RID 水合。
 */

/**
 * 路由前缀 → 语义视图名（ADR-0069 IA v2 后按**六大功能域**取视图）。
 * 以 `/ontology` 为前缀的路由都由本壳承接；最长前缀优先（`/ontology` 兜底在最后），
 * 表外路径落通用的 `ontology`，不编造具体视图名。子路径（如 :rid 详情）归入所属
 * 功能域视图——源记录由 agent 按 RID 水合，视图名不需要更细。
 */
const ROUTE_VIEWS: Array<{ prefix: string; view: string; tab: string }> = [
  { prefix: '/ontology/model', view: 'ontology-model', tab: 'model' },
  { prefix: '/ontology/data', view: 'ontology-data', tab: 'data' },
  { prefix: '/ontology/explore', view: 'ontology-explore', tab: 'explore' },
  { prefix: '/ontology/logic', view: 'ontology-logic', tab: 'logic' },
  { prefix: '/ontology/governance', view: 'ontology-governance', tab: 'governance' },
  { prefix: '/ontology', view: 'ontology-overview', tab: 'overview' },
];

function resolveRouteView(pathname: string): { view: string; tab: string } {
  return (
    ROUTE_VIEWS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)) ?? {
      view: 'ontology',
      tab: 'unknown',
    }
  );
}

export default function OntologyDomainShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  // 路由态随 location 变化——这是"宿主页换 tab / 深入子页后上下文不失真"的落点。
  useEffect(() => {
    const route = resolveRouteView(location.pathname);
    // 深链 `?id=<rid>` 是"打开中的记录"，进 openRecordIds；列表**选中**由
    // ObjectExplorerPage 单独发布（选中 ≠ 打开，两者语义不同）。
    const openRid = new URLSearchParams(location.search).get('id');
    setOntologyNavigation({
      view: route.view,
      tab: route.tab,
      url: `${location.pathname}${location.search}`,
      ...(openRid ? { openRecordIds: [openRid] } : {}),
    });
  }, [location.pathname, location.search]);

  // 离开本体域时清空：v1 是请求作用域，过期的路由态不该被下一次发问带上。
  useEffect(() => () => setOntologyNavigation(null), []);

  return (
    <div className="mp-page-full mp-onto-shell">
      <div className="mp-onto-shell-main">{children}</div>
    </div>
  );
}
