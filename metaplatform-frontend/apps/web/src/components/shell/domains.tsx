import type { ReactNode } from 'react';
import { BookOpen, Bot, Compass, LayoutDashboard, LayoutGrid, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import {
  ontologyDomainTabs, ontologyExploreTabs, ontologyGovernanceTabs, ontologyPaletteEntries,
  ontologyWorkspaceDefaultPath, resolveOntologyNav,
} from '@/pages/ontology/navigation';

/** Seven product menu entries plus a persistent SuperAI capability, with preserved URLs. */
export type DomainKey = 'home' | 'apps' | 'explore' | 'ontology' | 'agents' | 'ki' | 'gov' | 'superai';
export interface DomainSubTab { key: string; label: string; path: string; count?: number; aliases?: string[] }
export interface DomainTab extends DomainSubTab {
  children?: DomainSubTab[];
  workspaceGroup?: { key: string; label: string };
  /** A redirect/group root is not an additional page. Its entry is the first real child. */
  groupOnly?: boolean;
}
export interface DomainDef {
  key: DomainKey;
  label: string;
  icon: ReactNode;
  path: string;
  /** Prefix boundaries and longest matching preserve namespace-independent product ownership. */
  routePrefixes: string[];
  tabs: DomainTab[];
  navigationMode?: 'tabs' | 'workspace';
  placement?: 'primary' | 'utility';
  pageGroupLabel?: string;
}
const ICON_SIZE = 18;
const EMPLOYEE_GROUP = { key: 'employees', label: '员工室' };
const TASK_GROUP = { key: 'tasks', label: '任务与协作' };
const OPERATIONS_GROUP = { key: 'operations', label: '学习与运行' };
const GOALS_GROUP = { key: 'goals', label: '目标与会话' };

/** Single product registry: order is shared by IconRail and TopBar; utility entries still resolve. */
export const DOMAINS: DomainDef[] = [
  { key: 'home', label: '工作台', icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/home', routePrefixes: ['/home'], pageGroupLabel: '我的工作', tabs: [
      { key: 'overview', label: '概览', path: '/home' },
      { key: 'todos', label: '待办', path: '/home/todos' },
      { key: 'messages', label: '消息', path: '/home/messages' },
      { key: 'deliverables', label: '交付物', path: '/home/deliverables' },
      { key: 'apps', label: '我的应用', path: '/home/apps' },
      { key: 'me', label: '我的', path: '/home/me' },
      { key: 'portal', label: '门户', path: '/home/portal' },
      { key: 'aiops', label: '智能运维', path: '/home/aiops' },
    ] },
  { key: 'apps', label: '业务应用', icon: <LayoutGrid size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/apps/mine', routePrefixes: ['/apps'], pageGroupLabel: '应用建设', tabs: [
      { key: 'mine', label: '我的应用', path: '/apps/mine' },
      { key: 'market', label: '模板市场', path: '/apps/market' },
      { key: 'templates', label: '我的模板', path: '/apps/templates' },
      { key: 'designer', label: 'AI 设计器', path: '/apps/designer' },
      { key: 'order-review', label: '订单评审', path: '/apps/order-review' },
    ] },
  { key: 'explore', label: '对象探索', icon: <Compass size={ICON_SIZE} strokeWidth={1.5} />,
    path: ontologyExploreTabs()[0].path,
    routePrefixes: [ontologyExploreTabs()[0].path.slice(0, ontologyExploreTabs()[0].path.lastIndexOf('/'))],
    tabs: ontologyExploreTabs() },
  { key: 'ontology', label: '本体工作室', icon: <Share2 size={ICON_SIZE} strokeWidth={1.5} />,
    path: ontologyWorkspaceDefaultPath(), routePrefixes: ['/ontology'],
    navigationMode: 'workspace', tabs: ontologyDomainTabs() },
  { key: 'agents', label: '数字员工', icon: <Bot size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/agents', routePrefixes: ['/agents'], tabs: [
      { key: 'employees', label: '员工', path: '/agents', workspaceGroup: EMPLOYEE_GROUP },
      { key: 'external', label: '外部员工 · A2A', path: '/agents/external', workspaceGroup: EMPLOYEE_GROUP },
      { key: 'dw-employees', label: '员工 API 目录', path: '/agents/employees', workspaceGroup: EMPLOYEE_GROUP },
      { key: 'tasks', label: '任务中心', path: '/agents/tasks', workspaceGroup: TASK_GROUP },
      { key: 'collab', label: '协作编排', path: '/agents/collab', workspaceGroup: TASK_GROUP },
      { key: 'dw-tasks', label: '员工任务', path: '/agents/dw-tasks', workspaceGroup: TASK_GROUP },
      { key: 'dw-collaborations', label: '员工协作', path: '/agents/dw-collaborations', workspaceGroup: TASK_GROUP },
      { key: 'evaluation', label: '能力评估', path: '/agents/evaluation', workspaceGroup: OPERATIONS_GROUP },
      { key: 'dw-evaluations', label: '员工评估', path: '/agents/dw-evaluations', workspaceGroup: OPERATIONS_GROUP },
      { key: 'documents', label: '文档处理', path: '/agents/documents', workspaceGroup: OPERATIONS_GROUP },
      { key: 'learning', label: '学习管理', path: '/agents/learning', workspaceGroup: OPERATIONS_GROUP },
      { key: 'extraction', label: '信息抽取', path: '/agents/extraction', workspaceGroup: OPERATIONS_GROUP },
      { key: 'obs', label: '运行观测', path: '/agents/obs', workspaceGroup: OPERATIONS_GROUP },
    ] },
  { key: 'ki', label: '连接与知识', icon: <BookOpen size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/ki/kb', routePrefixes: ['/ki'], tabs: [
      { key: 'kb', label: '知识库', path: '/ki/kb', children: [
        { key: 'bases', label: '知识库', path: '/ki/kb' },
        { key: 'docs', label: '文档', path: '/ki/kb/docs' },
        { key: 'config', label: '检索配置', path: '/ki/kb/config' },
        { key: 'test', label: '检索测试', path: '/ki/test', aliases: ['/ki/kb/test'] },
      ] },
      { key: 'mcp', label: 'MCP 工具', path: '/ki/mcp', groupOnly: true, children: [
        { key: 'tools', label: '工具', path: '/ki/mcp/tools' },
        { key: 'servers', label: '服务器', path: '/ki/mcp/servers' },
        { key: 'clients', label: '客户端', path: '/ki/mcp/clients' },
        { key: 'debugger', label: '调试器', path: '/ki/mcp/debugger' },
        { key: 'permissions', label: '权限策略', path: '/ki/mcp/permissions' },
        { key: 'audit', label: '调用审计', path: '/ki/mcp/audit' },
        { key: 'connection-monitor', label: '连接监控', path: '/ki/mcp/connection-monitor' },
        { key: 'overview', label: '工具总览', path: '/ki/mcp/overview' },
        { key: 'skill-hub', label: '技能中心', path: '/ki/mcp/skill-hub' },
        { key: 'resources', label: '资源', path: '/ki/mcp/resources' },
        { key: 'prompts', label: '提示模板', path: '/ki/mcp/prompts' },
        { key: 'ide-config', label: 'IDE 配置', path: '/ki/mcp/ide-config' },
        { key: 'policies', label: '策略管理', path: '/ki/mcp/policies', aliases: ['/ki/mcp/matrix'] },
        { key: 'audit-stats', label: '审计统计', path: '/ki/mcp/audit/stats' },
      ] },
      { key: 'a2a', label: 'A2A', path: '/ki/a2a', groupOnly: true, children: [
        { key: 'external-agents', label: '外部智能体', path: '/ki/a2a/external-agents' },
        { key: 'trusts', label: '信任管理', path: '/ki/a2a/trusts' },
        { key: 'internal-agents', label: '内部智能体', path: '/ki/a2a/internal-agents' },
        { key: 'guide', label: '集成指南', path: '/ki/a2a/a2a-guide' },
      ] },
    ] },
  { key: 'gov', label: '治理与管理', icon: <ShieldCheck size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/gov/business', routePrefixes: ['/gov', '/admin', ...ontologyGovernanceTabs().map(tab => tab.path)], tabs: [
      { key: 'business', label: '业务架构', path: '/gov/business', children: [
        { key: 'capabilities', label: '业务能力', path: '/gov/business/capabilities' },
        { key: 'applications', label: '应用系统', path: '/gov/business/applications' },
        { key: 'value-streams', label: '价值流', path: '/gov/business/value-streams' },
        { key: 'processes', label: '业务流程', path: '/gov/business/processes' },
        { key: 'org-roles', label: '组织角色', path: '/gov/business/org-roles' },
      ] },
      { key: 'data', label: '数据架构', path: '/gov/data', children: [
        { key: 'entities', label: '数据实体', path: '/gov/data' },
        { key: 'flows', label: '数据流', path: '/gov/data/flows' },
        { key: 'standards', label: '数据标准', path: '/gov/data/standards' },
        { key: 'assets', label: '资产目录', path: '/gov/data/assets' },
      ] },
      { key: 'tech', label: '技术架构', path: '/gov/tech', children: [
        { key: 'components', label: '技术组件', path: '/gov/tech/components' },
        { key: 'stacks', label: '技术栈', path: '/gov/tech/stacks' },
        { key: 'topologies', label: '部署拓扑', path: '/gov/tech/topologies' },
        { key: 'radar', label: '技术雷达', path: '/gov/tech/radar' },
      ] },
      { key: 'governance', label: '治理', path: '/gov/governance', children: [
        { key: 'principles', label: '架构原则', path: '/gov/governance/principles' },
        { key: 'reviews', label: '架构评审', path: '/gov/governance/reviews' },
        { key: 'review-templates', label: '评审模板', path: '/gov/governance/review-templates' },
        { key: 'tech-debt', label: '技术债', path: '/gov/governance/tech-debt' },
        { key: 'ontology-mapping', label: '本体映射', path: '/gov/governance/ontology-mapping' },
      ] },
      { key: 'org', label: '组织', path: '/admin/org', groupOnly: true, children: [
        { key: 'users', label: '用户与权限', path: '/admin/org/users' },
        { key: 'roles', label: '角色', path: '/admin/org/roles' },
        { key: 'tenants', label: '组织与租户', path: '/admin/org/tenants' },
      ] },
      { key: 'platform', label: '平台', path: '/admin/platform', groupOnly: true, children: [
        { key: 'configs', label: '平台配置', path: '/admin/platform/configs' },
        { key: 'ai-providers', label: 'AI Provider', path: '/admin/platform/ai-providers' },
        { key: 'components', label: '组件演示', path: '/admin/platform/components', aliases: ['/admin/demo'] },
        { key: 'flowgram', label: 'FlowGram 演示', path: '/admin/flowgram' },
      ] },
      { key: 'ops', label: '运维', path: '/admin/ops', groupOnly: true, children: [
        { key: 'logs', label: '审计日志', path: '/admin/ops/logs' },
        { key: 'operations', label: '运营监控', path: '/admin/ops/operations' },
        { key: 'analytics', label: '使用分析', path: '/admin/ops/analytics' },
      ] },
      ...ontologyGovernanceTabs().map(tab => ({ ...tab, workspaceGroup: { key: tab.key, label: tab.label } })),
    ] },
  { key: 'superai', label: 'SuperAI', icon: <Sparkles size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/superai/chat', routePrefixes: ['/superai'], placement: 'utility', tabs: [
      { key: 'chat', label: '会话', path: '/superai/chat', workspaceGroup: GOALS_GROUP },
      { key: 'templates', label: '任务模板', path: '/superai/templates', workspaceGroup: GOALS_GROUP },
      { key: 'team', label: '团队运行', path: '/superai/team', workspaceGroup: GOALS_GROUP },
      { key: 'plans', label: '执行计划', path: '/superai/plans', children: [
        { key: 'a2a', label: 'A2A 协作', path: '/superai/plans/a2a' },
        { key: 'orchestration', label: '编排控制台', path: '/superai/plans/orchestration' },
        { key: 'manual-select', label: '员工选择', path: '/superai/plans/manual-select' },
        { key: 'parallel', label: '并行执行', path: '/superai/plans/parallel' },
        { key: 'result-aggregation', label: '结果聚合', path: '/superai/plans/result-aggregation' },
        { key: 'result-summary', label: '结果汇总', path: '/superai/plans/result-summary' },
        { key: 'employee-match', label: '员工匹配', path: '/superai/plans/employee-match' },
      ] },
      { key: 'schedules', label: '意图与调度', path: '/superai/schedules', children: [
        { key: 'execute', label: '调度执行', path: '/superai/schedules/execute' },
        { key: 'plan', label: '调度计划', path: '/superai/schedules/plan' },
      ] },
      { key: 'cost', label: '成本优化', path: '/superai/cost', children: [
        { key: 'data', label: '数据分析', path: '/superai/cost/data' },
        { key: 'report', label: '报告导出', path: '/superai/cost/report' },
      ] },
    ] },
];

export function primaryDomains(): DomainDef[] { return DOMAINS.filter(domain => domain.placement !== 'utility'); }
function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
export function resolveDomain(pathname: string): DomainDef | undefined {
  return DOMAINS.flatMap(domain => domain.routePrefixes.map(prefix => ({ domain, prefix })))
    .filter(entry => pathMatches(pathname, entry.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.domain;
}
export function resolveDomainTab(domain: DomainDef, pathname: string): DomainTab | undefined {
  if (domain.key === 'ontology') {
    const match = resolveOntologyNav(pathname);
    return domain.tabs.find(tab => tab.key === match?.group.key);
  }
  return domain.tabs.flatMap(tab => [tab, ...(tab.children ?? [])].flatMap(page => [page.path, ...(page.aliases ?? [])]
    .filter(path => pathMatches(pathname, path)).map(path => ({ tab, length: path.length }))))
    .sort((a, b) => b.length - a.length)[0]?.tab;
}
export function resolveSubTab(domain: DomainDef, pathname: string): { tab: DomainTab; sub: DomainSubTab } | undefined {
  return domain.tabs.flatMap(tab => (tab.children ?? []).flatMap(sub => [sub.path, ...(sub.aliases ?? [])]
    .filter(path => pathMatches(pathname, path)).map(path => ({ tab, sub, length: path.length }))))
    .sort((a, b) => b.length - a.length)[0];
}
export interface PaletteEntry { key: string; label: string; path: string; group: string; meta?: string; keywords: string }

export interface WorkspaceGroup {
  key: string;
  label: string;
  path: string;
  pages: DomainSubTab[];
}

/** Group metadata owns no paths: every page and entry comes from the existing product registry. */
export function workspaceGroups(domain: DomainDef): WorkspaceGroup[] {
  const groups: WorkspaceGroup[] = [];
  for (const tab of domain.tabs) {
    if (tab.children) {
      const pages = [...(!tab.groupOnly && !tab.children.some(page => page.path === tab.path) ? [tab] : []), ...tab.children];
      groups.push({ key: tab.key, label: tab.label, path: pages[0].path, pages });
    } else {
      const metadata = tab.workspaceGroup ?? (domain.key === 'ontology'
        ? { key: tab.key, label: tab.label }
        : { key: domain.key, label: domain.pageGroupLabel ?? domain.label });
      let group = groups.find(item => item.key === metadata.key);
      if (!group) {
        group = { ...metadata, path: tab.path, pages: [] };
        groups.push(group);
      }
      group.pages.push(tab);
    }
  }
  return groups;
}

export function resolveWorkspaceNavigation(pathname: string): {
  domain: DomainDef; groups: WorkspaceGroup[]; group?: WorkspaceGroup; page?: DomainSubTab;
} | undefined {
  const domain = resolveDomain(pathname);
  if (!domain) return undefined;
  const groups = workspaceGroups(domain);
  // The ontology registry resolves aliases and pages moved between responsibility groups.
  const ontologyMatch = resolveOntologyNav(pathname);
  if (domain.key === 'ontology' && !ontologyMatch) return { domain, groups };
  const canonicalPath = ontologyMatch?.item?.path ?? ontologyMatch?.group.path ?? pathname;
  const matches = groups.flatMap(group => group.pages.flatMap(page => [page.path, ...(page.aliases ?? [])]
    .filter(path => pathMatches(canonicalPath, path)).map(path => ({ group, page, length: path.length }))));
  const match = matches.sort((a, b) => b.length - a.length)[0];
  return { domain, groups, group: match?.group, page: match?.page };
}

export function navigationBreadcrumb(pathname: string): Array<{ name: string; path?: string }> {
  const match = resolveWorkspaceNavigation(pathname);
  if (!match) return [{ name: 'MetaPlatform' }];
  const { domain, group, page } = match;
  return [{ name: domain.label, path: domain.path },
    ...(group && group.label !== domain.label ? [{ name: group.label, path: group.path }] : []),
    ...(page && page.label !== group?.label ? [{ name: page.label, path: page.path }] : [])];
}

/** All discoverable pages use product labels; ontology paths come only from ONTOLOGY_NAV. */
export function buildNavigationIndex(): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const domain of DOMAINS) {
    out.push({ key: `domain:${domain.key}`, label: domain.label, path: domain.path,
      group: '跳转', meta: domain.label, keywords: `${domain.key} ${domain.label} 域` });
    for (const group of workspaceGroups(domain)) {
      for (const page of group.pages) {
        const ontology = ontologyPaletteEntries().find(entry => entry.path === page.path);
        out.push({ key: ontology?.key ?? `tab:${domain.key}:${group.key}:${page.key}`,
          label: `${domain.label} · ${page.label}`, path: page.path, group: '跳转',
          meta: domain.label,
          keywords: `${domain.key} ${domain.label} ${group.label} ${page.key} ${page.label} ${ontology?.keywords ?? ''}` });
      }
    }
  }
  return out;
}
