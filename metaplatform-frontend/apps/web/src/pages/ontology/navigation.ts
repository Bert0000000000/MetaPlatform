import type { ComponentType } from 'react';
import { Activity, Database, Layers, Shapes, ShieldCheck, Workflow } from 'lucide-react';
import type { DomainTab, PaletteEntry } from '@/components/shell/domains';

export type OntologyNavIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
export type OntologyNavStatus = 'active' | 'hidden' | 'planned';
export type OntologyNavPlacement = 'studio' | 'explore' | 'governance';

export interface OntologyNavItem {
  key: string;
  label: string;
  path?: string;
  aliases?: string[];
  icon?: OntologyNavIcon;
  status: OntologyNavStatus;
  keywords?: string;
  children?: OntologyNavItem[];
  /** Product placement preserves existing URLs without duplicating navigation facts. */
  placement?: OntologyNavPlacement;
  advanced?: boolean;
}

/** ADR-0069: all ontology pages, aliases, product placement and search share this registry. */
export const ONTOLOGY_NAV: OntologyNavItem[] = [
  { key: 'overview', label: '概览', path: '/ontology', aliases: ['/ontology/overview'],
    icon: Layers, status: 'active', keywords: 'overview 总览 概览 首页 landing' },
  { key: 'model', label: '业务模型', icon: Shapes, status: 'active', children: [
    { key: 'graph', label: '模型工作台', path: '/ontology/model/graph', status: 'active', keywords: 'graph 图谱 可视化 模型图 模型工作台' },
    { key: 'object-types', label: '对象类型', path: '/ontology/model/object-types', status: 'active', keywords: 'object type 对象类型 建模 objectType' },
    { key: 'link-types', label: '关系类型', path: '/ontology/model/link-types', status: 'active', keywords: 'link 关系类型 linkType 关系' },
    { key: 'interfaces', label: '接口定义', path: '/ontology/model/interfaces', status: 'active', advanced: true, keywords: 'interface 接口' },
    { key: 'axioms', label: '公理与约束', path: '/ontology/model/axioms', status: 'active', advanced: true, keywords: 'axiom 公理 约束' },
  ] },
  { key: 'data', label: '数据接入', icon: Database, status: 'active', children: [
    { key: 'mappings', label: '对象映射', path: '/ontology/data/mappings', status: 'active', keywords: 'mapping 对象映射 来源绑定 数据接入 背挂数据源 datasource' },
    { key: 'lineage', label: '本体血缘', path: '/ontology/data/lineage', status: 'active', keywords: 'lineage 血缘 数据流' },
  ] },
  { key: 'logic', label: '业务动作', icon: Workflow, status: 'active', children: [
    { key: 'actions', label: '动作类型', path: '/ontology/logic/actions', status: 'active', keywords: 'action 动作类型 ActionType 动作' },
    { key: 'functions', label: '函数管理', path: '/ontology/logic/functions', status: 'active', advanced: true, keywords: 'function 函数' },
    { key: 'designer', label: 'Action 编排', path: '/ontology/logic/designer', status: 'active', advanced: true, keywords: 'designer 编排 flow 编排器' },
    { key: 'approvals', label: '审批策略', status: 'planned', keywords: 'approval 审批' },
    { key: 'side-effects', label: 'Side Effects', status: 'planned', keywords: 'side effects 副作用' },
  ] },
  { key: 'governance', label: '变更发布', icon: ShieldCheck, status: 'active', children: [
    { key: 'drafts', label: '变更草稿', path: '/ontology/governance/drafts', status: 'active', keywords: 'draft 草稿 wip schema 暂存' },
    { key: 'releases', label: '版本与发布', path: '/ontology/governance/releases', status: 'active', keywords: 'release 版本 发布 branch diff rollback' },
    { key: 'import-export', label: '导入导出', path: '/ontology/governance/import-export', status: 'active', keywords: 'import export 导入 导出' },
  ] },
  { key: 'operations', label: '运行与质量', icon: Activity, status: 'active', children: [
    { key: 'sync', label: '同步任务', path: '/ontology/data/sync', status: 'active', keywords: 'sync 同步任务 同步健康' },
    { key: 'validation', label: '模型校验', path: '/ontology/model/validation', aliases: ['/ontology/governance/lint'], status: 'active', keywords: 'validation lint 模型检查 校验 反模式 检查' },
    { key: 'runs', label: '执行记录', path: '/ontology/logic/runs', status: 'active', keywords: 'runs 执行记录 audit 审计' },
    { key: 'audit', label: '操作审计', path: '/ontology/governance/audit', status: 'active', keywords: 'audit 审计' },
    { key: 'usage', label: '使用量', path: '/ontology/governance/usage', status: 'active', keywords: 'usage 使用量 lifecycle' },
  ] },
  { key: 'explore', label: '对象探索', icon: Layers, placement: 'explore', status: 'active', children: [
    { key: 'objects', label: '对象浏览', path: '/ontology/explore/objects', status: 'active', keywords: 'objects 对象浏览 实例 individual 浏览器 explorer' },
    { key: 'objectset', label: 'ObjectSet 构建器', path: '/ontology/explore/objectset', status: 'active', keywords: 'objectset 查询构建' },
    { key: 'analysis', label: '聚合分析', path: '/ontology/explore/analysis', status: 'active', keywords: 'analysis 聚合分析 分析 analytics' },
    { key: 'map', label: '地图视图', path: '/ontology/explore/map', status: 'active', keywords: 'map 地图 geo' },
    { key: 'saved-queries', label: '保存的查询', status: 'planned', keywords: 'saved queries 查询' },
  ] },
  { key: 'security', label: '权限策略', path: '/ontology/governance/security', icon: ShieldCheck,
    placement: 'governance', status: 'active', keywords: 'security 安全策略 权限 policy' },
];

export interface OntologyNavMatch { group: OntologyNavItem; item?: OntologyNavItem }

export function ontologyNavigationGroups(placement: OntologyNavPlacement = 'studio'): OntologyNavItem[] {
  return ONTOLOGY_NAV.filter(group => group.status === 'active' && (group.placement ?? 'studio') === placement);
}

function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Longest resource path, including old aliases; direct overview remains exact. */
export function resolveOntologyNav(pathname: string): OntologyNavMatch | undefined {
  const matches: Array<{ match: OntologyNavMatch; length: number }> = [];
  for (const group of ONTOLOGY_NAV) {
    if (group.status !== 'active') continue;
    for (const path of [group.path, ...(group.aliases ?? [])]) {
      if (path && pathname === path) matches.push({ match: { group }, length: path.length });
    }
    for (const item of group.children ?? []) {
      if (item.status !== 'active') continue;
      for (const path of [item.path, ...(item.aliases ?? [])]) {
        if (path && pathMatches(pathname, path)) matches.push({ match: { group, item }, length: path.length });
      }
    }
  }
  return matches.sort((a, b) => b.length - a.length)[0]?.match;
}

export function ontologyGroupDefaultPath(group: OntologyNavItem): string {
  return group.path ?? group.children!.find(item => item.status === 'active' && item.path)!.path!;
}

export function ontologyWorkspaceDefaultPath(): string {
  return ontologyGroupDefaultPath(ONTOLOGY_NAV.find(group => group.key === 'model')!);
}

export function ontologyExploreTabs(): DomainTab[] {
  return ontologyNavigationGroups('explore').flatMap(group => group.children ?? [])
    .filter(item => item.status === 'active' && item.path)
    .map(item => ({ key: item.key, label: item.label, path: item.path! }));
}

export function ontologyGovernanceTabs(): DomainTab[] {
  return ontologyNavigationGroups('governance')
    .map(group => ({ key: group.key, label: group.label, path: ontologyGroupDefaultPath(group) }));
}

/** Compatibility metadata preserves resource group ownership even across legacy path families. */
export function ontologyDomainTabs(): DomainTab[] {
  return ontologyNavigationGroups().map(group => ({
    key: group.key, label: group.label, path: ontologyGroupDefaultPath(group),
    ...(group.children ? { children: group.children.filter(item => item.status === 'active' && item.path)
      .map(item => ({ key: item.key, label: item.label, path: item.path! })) } : {}),
  }));
}

export interface OntologyCrumb { name: string; path?: string }
export function ontologyBreadcrumb(pathname: string): OntologyCrumb[] {
  const match = resolveOntologyNav(pathname);
  if (!match) return [];
  return [{ name: match.group.label, path: ontologyGroupDefaultPath(match.group) },
    ...(match.item ? [{ name: match.item.label }] : [])];
}

export function ontologyPaletteEntries(): PaletteEntry[] {
  return ONTOLOGY_NAV.filter(group => group.status === 'active').flatMap(group => {
    const items = group.path ? [group] : (group.children ?? []);
    return items.filter(item => item.status === 'active' && item.path).map(item => ({
      key: item === group ? `ontology:${group.key}` : `ontology:${group.key}:${item.key}`,
      label: item.label, path: item.path!, group: '跳转',
      keywords: `ontology 本体 ${group.key} ${group.label} ${item.key} ${item.label} ${item.keywords ?? ''}`,
    }));
  });
}
