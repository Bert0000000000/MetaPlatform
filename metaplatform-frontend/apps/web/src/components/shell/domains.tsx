import type { ReactNode } from 'react';
import {
  BookOpen,
  Bot,
  LayoutDashboard,
  LayoutGrid,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

/**
 * 新信息架构（11 域 → 8 域）+ 页内 tab。
 * 单一事实源：IconRail（一级）、TopBar（一级 tab 模式）、PageTabs（页内 tab）、
 * CommandPalette（跳转索引）全部从这里派生，避免多处硬编码路径。
 * 依据：DESIGN-SPEC §2（8 域划分）/ §3（壳与 tab 结构）。
 */
export type DomainKey =
  | 'home'
  | 'ontology'
  | 'agents'
  | 'superai'
  | 'apps'
  | 'ki'
  | 'gov'
  | 'admin';

export interface DomainSubTab {
  key: string;
  label: string;
  path: string;
  count?: number;
}

export interface DomainTab {
  key: string;
  label: string;
  path: string;
  /** 计数徽标（DESIGN-SPEC §3：计数挂 tab 上） */
  count?: number;
  /** 子 tab（胶囊行）。仅多子项域配置，其余留空即隐藏第二行 */
  children?: DomainSubTab[];
}

export interface DomainDef {
  key: DomainKey;
  label: string;
  icon: ReactNode;
  /** 一级默认路由 */
  path: string;
  tabs: DomainTab[];
  /**
   * 域导航模式（ADR-0069 / IA v2）：缺省 'tabs' 渲染全局横向 PageTabs；
   * 'workspace' 时域自带左侧工作区导航，PageTabs 不渲染。
   * IA2-0 先落类型契约（无任何域声明 workspace）；IA2-1 起本体域切换。
   */
  navigationMode?: 'tabs' | 'workspace';
}

const ICON_SIZE = 18;

export const DOMAINS: DomainDef[] = [
  {
    key: 'home',
    label: '工作台',
    icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/home',
    tabs: [
      { key: 'overview', label: '概览', path: '/home' },
      { key: 'todos', label: '待办', path: '/home/todos' },
      { key: 'messages', label: '消息', path: '/home/messages' },
      { key: 'deliverables', label: '交付物', path: '/home/deliverables' },
      { key: 'apps', label: '我的应用', path: '/home/apps' },
      { key: 'me', label: '我的', path: '/home/me' },
    ],
  },
  {
    key: 'ontology',
    label: '本体',
    icon: <Share2 size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/ontology',
    // 2026-09-24（用户决策）：本体导航改回与全站一致的横向 tab 模式——
    // 主 tab = 六大功能组（path 指组根，由路由 redirect 到默认子页），
    // children 胶囊行 = 各组子页面（与 ki/gov/admin 域同构）。
    // IA v2 的全部正式 URL / 路由即状态 / 子页拆分成果保留不变
    // （ADR-0069 附录）；细粒度 ⌘K 索引仍来自 pages/ontology/navigation.ts。
    tabs: [
      { key: 'overview', label: '总览', path: '/ontology' },
      {
        key: 'model',
        label: '语义模型',
        path: '/ontology/model',
        children: [
          { key: 'object-types', label: '对象类型', path: '/ontology/model/object-types' },
          { key: 'link-types', label: '关系类型', path: '/ontology/model/link-types' },
          { key: 'interfaces', label: '接口', path: '/ontology/model/interfaces' },
          { key: 'axioms', label: '公理', path: '/ontology/model/axioms' },
          { key: 'graph', label: '模型图谱', path: '/ontology/model/graph' },
          { key: 'validation', label: '模型校验', path: '/ontology/model/validation' },
        ],
      },
      {
        key: 'data',
        label: '数据映射',
        path: '/ontology/data',
        children: [
          { key: 'mappings', label: '对象映射', path: '/ontology/data/mappings' },
          { key: 'sync', label: '同步任务', path: '/ontology/data/sync' },
          { key: 'lineage', label: '本体血缘', path: '/ontology/data/lineage' },
        ],
      },
      {
        key: 'explore',
        label: '对象与查询',
        path: '/ontology/explore',
        children: [
          { key: 'objects', label: '对象浏览', path: '/ontology/explore/objects' },
          { key: 'analysis', label: '聚合分析', path: '/ontology/explore/analysis' },
          { key: 'map', label: '地图视图', path: '/ontology/explore/map' },
        ],
      },
      {
        key: 'logic',
        label: '动作与函数',
        path: '/ontology/logic',
        children: [
          { key: 'actions', label: '动作类型', path: '/ontology/logic/actions' },
          { key: 'functions', label: '函数', path: '/ontology/logic/functions' },
          { key: 'designer', label: 'Action 编排', path: '/ontology/logic/designer' },
          { key: 'runs', label: '执行记录', path: '/ontology/logic/runs' },
        ],
      },
      {
        key: 'governance',
        label: '发布与治理',
        path: '/ontology/governance',
        children: [
          { key: 'drafts', label: '草稿', path: '/ontology/governance/drafts' },
          { key: 'releases', label: '版本与发布', path: '/ontology/governance/releases' },
          { key: 'usage', label: '使用量', path: '/ontology/governance/usage' },
          { key: 'lint', label: '模型检查', path: '/ontology/governance/lint' },
          { key: 'security', label: '安全策略', path: '/ontology/governance/security' },
          { key: 'import-export', label: '导入导出', path: '/ontology/governance/import-export' },
          { key: 'audit', label: '审计', path: '/ontology/governance/audit' },
        ],
      },
    ],
  },
  {
    key: 'agents',
    label: '数字员工',
    icon: <Bot size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/agents',
    tabs: [
      { key: 'employees', label: '员工', path: '/agents' },
      { key: 'external', label: '外部员工 · A2A', path: '/agents/external' },
      { key: 'tasks', label: '任务中心', path: '/agents/tasks' },
      { key: 'collab', label: '协作编排', path: '/agents/collab' },
      { key: 'evaluation', label: '能力评估', path: '/agents/evaluation' },
      { key: 'documents', label: '文档处理', path: '/agents/documents' },
    ],
  },
  {
    key: 'superai',
    label: 'SuperAI',
    icon: <Sparkles size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/superai/chat',
    tabs: [
      { key: 'chat', label: '会话', path: '/superai/chat' },
      { key: 'plans', label: '执行计划', path: '/superai/plans' },
      { key: 'schedules', label: '意图与调度', path: '/superai/schedules' },
      { key: 'cost', label: '成本优化', path: '/superai/cost' },
      { key: 'templates', label: '任务模板', path: '/superai/templates' },
    ],
  },
  {
    key: 'apps',
    label: '应用中心',
    icon: <LayoutGrid size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/apps/mine',
    tabs: [
      { key: 'mine', label: '我的应用', path: '/apps/mine' },
      { key: 'market', label: '模板市场', path: '/apps/market' },
      { key: 'templates', label: '我的模板', path: '/apps/templates' },
      { key: 'designer', label: 'AI 设计器', path: '/apps/designer' },
    ],
  },
  {
    key: 'ki',
    label: '知识与集成',
    icon: <BookOpen size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/ki/kb',
    tabs: [
      {
        key: 'kb',
        label: '知识库',
        path: '/ki/kb',
        children: [
          { key: 'bases', label: '知识库', path: '/ki/kb' },
          { key: 'docs', label: '文档', path: '/ki/kb/docs' },
          { key: 'config', label: '检索配置', path: '/ki/kb/config' },
        ],
      },
      {
        key: 'mcp',
        label: 'MCP 工具',
        path: '/ki/mcp',
        children: [
          { key: 'tools', label: '工具', path: '/ki/mcp/tools' },
          { key: 'servers', label: '服务器', path: '/ki/mcp/servers' },
          { key: 'clients', label: '客户端', path: '/ki/mcp/clients' },
          { key: 'debugger', label: '调试器', path: '/ki/mcp/debugger' },
          { key: 'permissions', label: '权限策略', path: '/ki/mcp/permissions' },
          { key: 'audit', label: '调用审计', path: '/ki/mcp/audit' },
          { key: 'connection-monitor', label: '连接监控', path: '/ki/mcp/connection-monitor' },
        ],
      },
      {
        key: 'a2a',
        label: 'A2A',
        path: '/ki/a2a',
        children: [
          { key: 'external-agents', label: '外部智能体', path: '/ki/a2a/external-agents' },
          { key: 'trusts', label: '信任管理', path: '/ki/a2a/trusts' },
        ],
      },
      { key: 'test', label: '检索测试', path: '/ki/test' },
    ],
  },
  {
    key: 'gov',
    label: '数据与治理',
    icon: <ShieldCheck size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/gov/business',
    tabs: [
      {
        key: 'business',
        label: '业务架构',
        path: '/gov/business',
        children: [
          { key: 'capabilities', label: '业务能力', path: '/gov/business/capabilities' },
          { key: 'applications', label: '应用系统', path: '/gov/business/applications' },
          { key: 'value-streams', label: '价值流', path: '/gov/business/value-streams' },
          { key: 'processes', label: '业务流程', path: '/gov/business/processes' },
          { key: 'org-roles', label: '组织角色', path: '/gov/business/org-roles' },
        ],
      },
      {
        key: 'data',
        label: '数据架构',
        path: '/gov/data',
        children: [
          { key: 'entities', label: '数据实体', path: '/gov/data' },
          { key: 'flows', label: '数据流', path: '/gov/data/flows' },
          { key: 'standards', label: '数据标准', path: '/gov/data/standards' },
          { key: 'assets', label: '资产目录', path: '/gov/data/assets' },
        ],
      },
      {
        key: 'tech',
        label: '技术架构',
        path: '/gov/tech',
        children: [
          { key: 'components', label: '技术组件', path: '/gov/tech/components' },
          { key: 'stacks', label: '技术栈', path: '/gov/tech/stacks' },
          { key: 'topologies', label: '部署拓扑', path: '/gov/tech/topologies' },
          { key: 'radar', label: '技术雷达', path: '/gov/tech/radar' },
        ],
      },
      {
        key: 'governance',
        label: '治理',
        path: '/gov/governance',
        children: [
          { key: 'principles', label: '架构原则', path: '/gov/governance/principles' },
          { key: 'reviews', label: '架构评审', path: '/gov/governance/reviews' },
          { key: 'review-templates', label: '评审模板', path: '/gov/governance/review-templates' },
          { key: 'tech-debt', label: '技术债', path: '/gov/governance/tech-debt' },
          { key: 'ontology-mapping', label: '本体映射', path: '/gov/governance/ontology-mapping' },
        ],
      },
    ],
  },
  {
    key: 'admin',
    label: '平台管理',
    icon: <Settings2 size={ICON_SIZE} strokeWidth={1.5} />,
    path: '/admin/org/users',
    tabs: [
      {
        key: 'org',
        label: '组织',
        path: '/admin/org',
        children: [
          { key: 'users', label: '用户与权限', path: '/admin/org/users' },
          { key: 'roles', label: '角色', path: '/admin/org/roles' },
          { key: 'tenants', label: '组织与租户', path: '/admin/org/tenants' },
        ],
      },
      {
        key: 'platform',
        label: '平台',
        path: '/admin/platform',
        children: [
          { key: 'configs', label: '平台配置', path: '/admin/platform/configs' },
          { key: 'ai-providers', label: 'AI Provider', path: '/admin/platform/ai-providers' },
          { key: 'components', label: '组件演示', path: '/admin/platform/components' },
        ],
      },
      {
        key: 'ops',
        label: '运维',
        path: '/admin/ops',
        children: [
          { key: 'logs', label: '审计日志', path: '/admin/ops/logs' },
          { key: 'operations', label: '运营监控', path: '/admin/ops/operations' },
          { key: 'analytics', label: '使用分析', path: '/admin/ops/analytics' },
        ],
      },
    ],
  },
];

/** pathname → 所属域（8 个域的前缀互不为前缀，直接取一级路径段）。 */
export function resolveDomain(pathname: string): DomainDef | undefined {
  const first = pathname.split('/')[1] ?? '';
  return DOMAINS.find((d) => d.key === first);
}

/**
 * 当前域下命中的主 tab（最长前缀匹配）。
 * 未命中时返回 undefined —— 域内存在不属于任何 tab 的页面（/admin/demo、
 * /apps/order-review 等），此时不该硬指到某个 tab 上。
 */
export function resolveDomainTab(domain: DomainDef, pathname: string): DomainTab | undefined {
  return domain.tabs
    .filter((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

/** 当前域下命中的子 tab。 */
export function resolveSubTab(
  domain: DomainDef,
  pathname: string,
): { tab: DomainTab; sub: DomainSubTab } | undefined {
  for (const tab of domain.tabs) {
    if (!tab.children?.length) continue;
    const hit = tab.children
      .filter((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0];
    if (hit) return { tab, sub: hit };
  }
  return undefined;
}

export interface PaletteEntry {
  key: string;
  label: string;
  path: string;
  /** 分组：最近 / 跳转 */
  group: string;
  /** 副标题（域标签） */
  meta?: string;
  keywords: string;
}

/** ⌘K 的「跳转」索引：8 个域 + 全部页内 tab。 */
export function buildNavigationIndex(): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const d of DOMAINS) {
    out.push({
      key: `domain:${d.key}`,
      label: d.label,
      path: d.path,
      group: '跳转',
      keywords: `${d.key} ${d.label} 域`,
    });
    for (const t of d.tabs) {
      out.push({
        key: `tab:${d.key}:${t.key}`,
        label: `${d.label} · ${t.label}`,
        path: t.path,
        group: '跳转',
        meta: d.label,
        keywords: `${d.key} ${d.label} ${t.key} ${t.label}`,
      });
    }
  }
  return out;
}
