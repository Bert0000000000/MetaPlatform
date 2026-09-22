import type { ComponentType } from 'react';
import {
  Database,
  Layers,
  Shapes,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import type { PaletteEntry } from '@/components/shell/domains';

/** 图标以组件类型登记（保持本模块为纯 .ts 配置，不写 JSX）。 */
export type OntologyNavIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

/**
 * 本体工作区导航的**单一事实源**（ADR-0069 §2.3 / IA v2 设计规格 §2.3）。
 *
 * <p>同一份配置驱动：左侧导航（OntologySideNav）、TopBar 面包屑、⌘K 索引、
 * 路由高亮与测试路径矩阵。禁止在 Shell / 页面里散落硬编码本体路径。
 *
 * <p>`status` 语义（设计规格 §2.5「不展示假功能」）：
 * <ul>
 *   <li>`active` —— 有真实路由与真实内容，渲染进左侧导航与 ⌘K；</li>
 *   <li>`planned` —— 目标 IA 登记项，**不渲染**（无空壳页、不进导航），
 *       等真实 API + 验收后转 active；</li>
 *   <li>`hidden` —— 有路由但暂不入导航（本批未用到，保留语义）。</li>
 * </ul>
 *
 * <p>分批激活（绞杀式迁移）：IA2-1 只挂过渡 Adapter 能承载的页面；
 * `planned` 项随 IA2-2 ~ IA2-6 拆分逐批转 active。
 */
export type OntologyNavStatus = 'active' | 'hidden' | 'planned';

export interface OntologyNavItem {
  key: string;
  label: string;
  /** 功能域自身可直达（总览）；分组域由第一个 active 子项承载。 */
  path?: string;
  icon?: OntologyNavIcon;
  status: OntologyNavStatus;
  /** ⌘K 检索关键词（中英同义词），随条目拼接。 */
  keywords?: string;
  children?: OntologyNavItem[];
}

export const ONTOLOGY_NAV: OntologyNavItem[] = [
  {
    key: 'overview',
    label: '总览',
    path: '/ontology',
    icon: Layers,
    status: 'active',
    keywords: 'overview 总览 概览 首页 landing',
  },
  {
    key: 'model',
    label: '语义模型',
    icon: Shapes,
    status: 'active',
    children: [
      {
        key: 'object-types',
        label: '对象类型',
        path: '/ontology/model/object-types',
        status: 'active',
        keywords: 'object type 对象类型 建模 类型 objectType',
      },
      {
        key: 'link-types',
        label: '关系类型',
        path: '/ontology/model/link-types',
        status: 'active',
        keywords: 'link 关系类型 linkType 关系',
      },
      {
        key: 'interfaces',
        label: '接口',
        path: '/ontology/model/interfaces',
        status: 'active',
        keywords: 'interface 接口',
      },
      {
        key: 'axioms',
        label: '公理',
        path: '/ontology/model/axioms',
        status: 'active',
        keywords: 'axiom 公理 约束',
      },
      {
        key: 'graph',
        label: '模型图谱',
        path: '/ontology/model/graph',
        status: 'active',
        keywords: 'graph 图谱 可视化 模型图',
      },
      {
        key: 'validation',
        label: '模型校验',
        path: '/ontology/model/validation',
        status: 'active',
        keywords: 'validation lint 校验 反模式 检查',
      },
    ],
  },
  {
    key: 'data',
    label: '数据映射',
    icon: Database,
    status: 'active',
    children: [
      {
        key: 'mappings',
        label: '对象映射',
        path: '/ontology/data/mappings',
        status: 'active',
        keywords: 'mapping 对象映射 数据接入 背挂数据源 datasource',
      },
      {
        key: 'sync',
        label: '同步任务',
        path: '/ontology/data/sync',
        status: 'active',
        keywords: 'sync 同步任务 同步健康',
      },
      {
        key: 'lineage',
        label: '本体血缘',
        path: '/ontology/data/lineage',
        status: 'active',
        keywords: 'lineage 血缘 数据流',
      },
    ],
  },
  {
    key: 'explore',
    label: '对象与查询',
    icon: Layers,
    status: 'active',
    children: [
      {
        key: 'objects',
        label: '对象浏览',
        path: '/ontology/explore/objects',
        status: 'active',
        keywords: 'objects 对象浏览 实例 individual 浏览器 explorer',
      },
      {
        key: 'analysis',
        label: '聚合分析',
        path: '/ontology/explore/analysis',
        status: 'active',
        keywords: 'analysis 聚合分析 分析 analytics',
      },
      {
        key: 'map',
        label: '地图视图',
        path: '/ontology/explore/map',
        status: 'active',
        keywords: 'map 地图 geo',
      },
      {
        key: 'objectset',
        label: 'ObjectSet 构建器',
        path: '/ontology/explore/objectset',
        status: 'planned',
        keywords: 'objectset 查询构建',
      },
      {
        key: 'saved-queries',
        label: '保存的查询',
        status: 'planned',
        keywords: 'saved queries 查询',
      },
    ],
  },
  {
    key: 'logic',
    label: '动作与函数',
    icon: Workflow,
    status: 'active',
    children: [
      {
        key: 'actions',
        label: '动作类型',
        path: '/ontology/logic/actions',
        status: 'active',
        keywords: 'action 动作类型 ActionType 动作',
      },
      {
        key: 'functions',
        label: '函数',
        path: '/ontology/logic/functions',
        status: 'active',
        keywords: 'function 函数',
      },
      {
        key: 'designer',
        label: 'Action 编排',
        path: '/ontology/logic/designer',
        status: 'active',
        keywords: 'designer 编排 flow 编排器',
      },
      {
        key: 'runs',
        label: '执行记录',
        path: '/ontology/logic/runs',
        status: 'active',
        keywords: 'runs 执行记录 audit 审计',
      },
      {
        key: 'approvals',
        label: '审批策略',
        status: 'planned',
        keywords: 'approval 审批',
      },
      {
        key: 'side-effects',
        label: 'Side Effects',
        status: 'planned',
        keywords: 'side effects 副作用',
      },
    ],
  },
  {
    key: 'governance',
    label: '发布与治理',
    icon: ShieldCheck,
    status: 'active',
    children: [
      {
        key: 'drafts',
        label: '草稿',
        path: '/ontology/governance/drafts',
        status: 'active',
        keywords: 'draft 草稿 wip schema 暂存',
      },
      {
        key: 'releases',
        label: '版本与发布',
        path: '/ontology/governance/releases',
        status: 'active',
        keywords: 'release 版本 发布 branch diff rollback',
      },
      {
        key: 'usage',
        label: '使用量',
        path: '/ontology/governance/usage',
        status: 'planned',
        keywords: 'usage 使用量 lifecycle',
      },
      {
        key: 'lint',
        label: '模型检查',
        path: '/ontology/governance/lint',
        status: 'planned',
        keywords: 'lint 检查 反模式',
      },
      {
        key: 'security',
        label: '安全策略',
        path: '/ontology/governance/security',
        status: 'planned',
        keywords: 'security 安全策略 policy',
      },
      {
        key: 'import-export',
        label: '导入导出',
        path: '/ontology/governance/import-export',
        status: 'planned',
        keywords: 'import export 导入 导出',
      },
      {
        key: 'audit',
        label: '审计',
        path: '/ontology/governance/audit',
        status: 'planned',
        keywords: 'audit 审计',
      },
    ],
  },
];

export interface OntologyNavMatch {
  group: OntologyNavItem;
  /** 直达功能域（总览）没有子项。 */
  item?: OntologyNavItem;
}

/** pathname 前缀命中（含子路径，如 :rid 详情页归入其列表项）。 */
function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** 当前路由对应的导航节点（最长路径优先，避免组前缀抢先命中）。 */
export function resolveOntologyNav(pathname: string): OntologyNavMatch | undefined {
  const itemPaths: Array<{ group: OntologyNavItem; item: OntologyNavItem }> = [];
  for (const group of ONTOLOGY_NAV) {
    if (group.path && pathMatches(pathname, group.path)) {
      return { group };
    }
    for (const item of group.children ?? []) {
      if (item.path) itemPaths.push({ group, item });
    }
  }
  return itemPaths
    .filter(({ item }) => pathMatches(pathname, item.path as string))
    .sort((a, b) => (b.item.path as string).length - (a.item.path as string).length)[0];
}

/** 功能域默认路径：自身 path，否则第一个 active 子项（设计规格 §4.3）。 */
export function ontologyGroupDefaultPath(group: OntologyNavItem): string {
  if (group.path) return group.path;
  const first = (group.children ?? []).find((c) => c.status === 'active' && c.path);
  return first?.path as string;
}

export interface OntologyCrumb {
  name: string;
  path?: string;
}

/** TopBar 面包屑（本体域）：`语义模型 / 对象类型`，域标签由 TopBar 自己拼。 */
export function ontologyBreadcrumb(pathname: string): OntologyCrumb[] {
  const match = resolveOntologyNav(pathname);
  if (!match) return [];
  const crumbs: OntologyCrumb[] = [
    { name: match.group.label, path: ontologyGroupDefaultPath(match.group) },
  ];
  if (match.item && match.item.label !== match.group.label) {
    crumbs.push({ name: match.item.label });
  }
  return crumbs;
}

/** ⌘K 索引：全部 active 子页面（不索引 planned / hidden，设计规格 §6.4）。 */
export function ontologyPaletteEntries(): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const group of ONTOLOGY_NAV) {
    if (group.path && group.status === 'active') {
      out.push({
        key: `ontology:${group.key}`,
        label: `本体 · ${group.label}`,
        path: group.path,
        group: '跳转',
        meta: '本体',
        keywords: `ontology 本体 ${group.key} ${group.label} ${group.keywords ?? ''}`,
      });
    }
    for (const item of group.children ?? []) {
      if (item.status !== 'active' || !item.path) continue;
      out.push({
        key: `ontology:${group.key}:${item.key}`,
        label: `本体 · ${item.label}`,
        path: item.path,
        group: '跳转',
        meta: '本体',
        keywords: `ontology 本体 ${group.key} ${group.label} ${item.key} ${item.label} ${item.keywords ?? ''}`,
      });
    }
  }
  return out;
}
