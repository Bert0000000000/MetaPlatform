import type { ReactNode } from 'react';
import { BookOpen, Bot, Compass, LayoutDashboard, LayoutGrid, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import {
  ontologyDomainTabs, ontologyExploreTabs, ontologyGovernanceTabs, ontologyPaletteEntries,
  ontologyWorkspaceDefaultPath, resolveOntologyNav,
} from '@/pages/ontology/navigation';

/** Seven product menu entries plus a persistent SuperAI capability, with preserved URLs. */
export type DomainKey = 'home' | 'apps' | 'explore' | 'ontology' | 'agents' | 'ki' | 'gov' | 'superai';
export interface DomainSubTab { key: string; label: string; path: string; count?: number }
export interface DomainTab extends DomainSubTab { children?: DomainSubTab[] }
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
}
const ICON_SIZE = 18;

/** Single product registry: order is shared by IconRail and TopBar; utility entries still resolve. */
export const DOMAINS: DomainDef[] = [
  { key: 'home', label: '工作台', icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/home', routePrefixes: ['/home'], tabs: [
      { key: 'overview', label: '概览', path: '/home' },
      { key: 'todos', label: '待办', path: '/home/todos' },
      { key: 'messages', label: '消息', path: '/home/messages' },
      { key: 'deliverables', label: '交付物', path: '/home/deliverables' },
      { key: 'apps', label: '我的应用', path: '/home/apps' },
      { key: 'me', label: '我的', path: '/home/me' },
    ] },
  { key: 'apps', label: '业务应用', icon: <LayoutGrid size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/apps/mine', routePrefixes: ['/apps'], tabs: [
      { key: 'mine', label: '我的应用', path: '/apps/mine' },
      { key: 'market', label: '模板市场', path: '/apps/market' },
      { key: 'templates', label: '我的模板', path: '/apps/templates' },
      { key: 'designer', label: 'AI 设计器', path: '/apps/designer' },
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
      { key: 'employees', label: '员工', path: '/agents' },
      { key: 'external', label: '外部员工 · A2A', path: '/agents/external' },
      { key: 'tasks', label: '任务中心', path: '/agents/tasks' },
      { key: 'collab', label: '协作编排', path: '/agents/collab' },
      { key: 'evaluation', label: '能力评估', path: '/agents/evaluation' },
      { key: 'documents', label: '文档处理', path: '/agents/documents' },
    ] },
  { key: 'ki', label: '连接与知识', icon: <BookOpen size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/ki/kb', routePrefixes: ['/ki'], tabs: [
      { key: 'kb', label: '知识库', path: '/ki/kb', children: [
        { key: 'bases', label: '知识库', path: '/ki/kb' },
        { key: 'docs', label: '文档', path: '/ki/kb/docs' },
        { key: 'config', label: '检索配置', path: '/ki/kb/config' },
      ] },
      { key: 'mcp', label: 'MCP 工具', path: '/ki/mcp', children: [
        { key: 'tools', label: '工具', path: '/ki/mcp/tools' },
        { key: 'servers', label: '服务器', path: '/ki/mcp/servers' },
        { key: 'clients', label: '客户端', path: '/ki/mcp/clients' },
        { key: 'debugger', label: '调试器', path: '/ki/mcp/debugger' },
        { key: 'permissions', label: '权限策略', path: '/ki/mcp/permissions' },
        { key: 'audit', label: '调用审计', path: '/ki/mcp/audit' },
        { key: 'connection-monitor', label: '连接监控', path: '/ki/mcp/connection-monitor' },
      ] },
      { key: 'a2a', label: 'A2A', path: '/ki/a2a', children: [
        { key: 'external-agents', label: '外部智能体', path: '/ki/a2a/external-agents' },
        { key: 'trusts', label: '信任管理', path: '/ki/a2a/trusts' },
      ] },
      { key: 'test', label: '检索测试', path: '/ki/test' },
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
      { key: 'org', label: '组织', path: '/admin/org', children: [
        { key: 'users', label: '用户与权限', path: '/admin/org/users' },
        { key: 'roles', label: '角色', path: '/admin/org/roles' },
        { key: 'tenants', label: '组织与租户', path: '/admin/org/tenants' },
      ] },
      { key: 'platform', label: '平台', path: '/admin/platform', children: [
        { key: 'configs', label: '平台配置', path: '/admin/platform/configs' },
        { key: 'ai-providers', label: 'AI Provider', path: '/admin/platform/ai-providers' },
        { key: 'components', label: '组件演示', path: '/admin/platform/components' },
      ] },
      { key: 'ops', label: '运维', path: '/admin/ops', children: [
        { key: 'logs', label: '审计日志', path: '/admin/ops/logs' },
        { key: 'operations', label: '运营监控', path: '/admin/ops/operations' },
        { key: 'analytics', label: '使用分析', path: '/admin/ops/analytics' },
      ] },
      ...ontologyGovernanceTabs(),
    ] },
  { key: 'superai', label: 'SuperAI', icon: <Sparkles size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/superai/chat', routePrefixes: ['/superai'], placement: 'utility', tabs: [
      { key: 'chat', label: '会话', path: '/superai/chat' },
      { key: 'plans', label: '执行计划', path: '/superai/plans' },
      { key: 'schedules', label: '意图与调度', path: '/superai/schedules' },
      { key: 'cost', label: '成本优化', path: '/superai/cost' },
      { key: 'templates', label: '任务模板', path: '/superai/templates' },
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
  return domain.tabs.filter(tab => pathMatches(pathname, tab.path)).sort((a, b) => b.path.length - a.path.length)[0];
}
export function resolveSubTab(domain: DomainDef, pathname: string): { tab: DomainTab; sub: DomainSubTab } | undefined {
  return domain.tabs.flatMap(tab => (tab.children ?? []).map(sub => ({ tab, sub })))
    .filter(entry => pathMatches(pathname, entry.sub.path)).sort((a, b) => b.sub.path.length - a.sub.path.length)[0];
}
export interface PaletteEntry { key: string; label: string; path: string; group: string; meta?: string; keywords: string }

/** All discoverable pages use product labels; ontology paths come only from ONTOLOGY_NAV. */
export function buildNavigationIndex(): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const domain of DOMAINS) {
    out.push({ key: `domain:${domain.key}`, label: domain.label, path: domain.path,
      group: '跳转', meta: domain.label, keywords: `${domain.key} ${domain.label} 域` });
    if (domain.key === 'ontology' || domain.key === 'explore') continue;
    for (const tab of domain.tabs) {
      if (tab.path.startsWith('/ontology/')) continue;
      for (const item of [tab, ...(tab.children ?? [])]) {
        out.push({ key: `tab:${domain.key}:${tab.key}${item === tab ? '' : `:${item.key}`}`,
          label: `${domain.label} · ${item.label}`, path: item.path, group: '跳转', meta: domain.label,
          keywords: `${domain.key} ${domain.label} ${tab.label} ${item.key} ${item.label}` });
      }
    }
  }
  return [...out, ...ontologyPaletteEntries().map(entry => {
    const owner = resolveDomain(entry.path)!;
    return { ...entry, label: `${owner.label} · ${entry.label}`, meta: owner.label,
      keywords: `${owner.key} ${owner.label} ${entry.keywords}` };
  })];
}
