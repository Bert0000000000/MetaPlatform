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
 * 路由 → 语义视图名。以 `/ontology` 为前缀的路由都由本壳承接；表外路径（理论上不会
 * 出现，路由表兜底）落一个通用的 `ontology`，不编造具体视图名。
 */
const ROUTE_VIEWS: Record<string, { view: string; tab: string }> = {
  '/ontology': { view: 'ontology-overview', tab: 'overview' },
  '/ontology/model': { view: 'ontology-model', tab: 'model' },
  '/ontology/objects': { view: 'ontology-objects', tab: 'objects' },
  '/ontology/datacenter': { view: 'ontology-datacenter', tab: 'datacenter' },
  '/ontology/apps': { view: 'ontology-apps', tab: 'apps' },
  '/ontology/ops': { view: 'ontology-ops', tab: 'ops' },
  '/ontology/ops/actions': { view: 'ontology-actions', tab: 'actions' },
  '/ontology/ops/governance': { view: 'ontology-governance', tab: 'governance' },
};

export default function OntologyDomainShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  // 路由态随 location 变化——这是"宿主页换 tab / 深入子页后上下文不失真"的落点。
  useEffect(() => {
    const route = ROUTE_VIEWS[location.pathname] ?? { view: 'ontology', tab: 'unknown' };
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
