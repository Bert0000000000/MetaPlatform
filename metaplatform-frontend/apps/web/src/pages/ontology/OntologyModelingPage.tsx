import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Modal } from '@douyinfe/semi-ui';
import { SheetDetail } from '@/components/skeleton';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Hexagon, Search, Plus, Columns3, ChevronDown, ChevronRight,
  Link as LinkIcon, ArrowRight, Zap, GitBranch, GitMerge, AlertTriangle, ExternalLink,
} from 'lucide-react';
import {
  listObjectTypes, listActionTypes, listLinkTypes,
  listValueTypes, listInterfaces,
  createObjectType,
  getObjectType,
  precheckObjectTypes, mergeObjectTypes,
  getTypeHierarchy,
  domainOfObjectType, slugAndVersionOfObjectType, slugAndVersionOfProperty,
  errDetailText, extractDestructiveConfirm,
  type KernelObjectType, type KernelActionType, type KernelLinkType,
  type KernelValueType, type KernelInterface, type KernelObjectTypeCreate,
  type ObjectTypeCandidate, type DestructiveConfirmDetail, type TypeHierarchyNode,
} from '@/api/ont/kernel';
import { getTenantId } from '@/utils/auth';
import { actionDisplayName } from './logic/actions/displayName';
import OntologyMergeDrawer from './components/OntologyMergeDrawer';
import ObjectTypeEditorV2Drawer, { type ObjectTypeEditorPrefill } from './components/ObjectTypeEditorV2Drawer';
import './ontology.css';


// 领域码 → 中文（rid 形如 ont.<tenant>.obj.<domain>.<slug>.v1）
const DOMAIN_LABELS: Record<string, string> = {
  crm: '客户关系',
  scm: '供应链',
  fin: '财务核算',
  org: '组织人力',
  hr: '人力资源',
  employee: '人事档案',
  'leave-request': '请假申请',
  ticket: '工单',
  superai: 'SuperAI',
  'dw-digital-employee': '数字员工',
};

const statusDotClass = (status: string) => (
  status === 'connected' ? 'mp-onto-status-dot mp-onto-dot-success'
    : status === 'partial' ? 'mp-onto-status-dot mp-onto-dot-warning'
      : 'mp-onto-status-dot mp-onto-dot-danger'
);

const typeBadgeClass = (type: string) =>
  type === 'ENUM' ? 'type-badge enum' : type === 'DATETIME' ? 'type-badge datetime' : 'type-badge';

const statusLabel = (status: string) =>
  status === 'connected' ? '已接入' : status === 'partial' ? '部分接入' : '未接入';

// 概念状态：有关联 LinkType → connected；有关联 ActionType → partial；否则 disconnected
function conceptStatus(ot: KernelObjectType, linkTypes: KernelLinkType[], actionTypes: KernelActionType[]) {
  const hasLink = linkTypes.some((lt) => lt.src === ot.rid || lt.dst === ot.rid);
  const hasAction = actionTypes.some((at) => at.on.includes(ot.rid));
  if (hasLink) return 'connected';
  if (hasAction) return 'partial';
  return 'disconnected';
}

/** 子树节点总数（含自身），用于域/父节点的计数徽标。 */
function countNodes(node: TypeHierarchyNode): number {
  return 1 + (node.children ?? []).reduce((acc, c) => acc + countNodes(c), 0);
}

/** 概念层级的末级 slug（rid 形如 ont.<tenant>.obj.<domain>.<slug>.v<N>）。 */
function slugOf(rid: string): string {
  const parts = rid.split('.');
  return parts.length >= 2 ? (parts[parts.length - 2] ?? rid) : rid;
}

/**
 * 业务域树里的一个概念节点。
 * 有子类时带折叠箭头并可继续下钻，没有子类即为末级。
 */
function ConceptTreeNode({
  node,
  depth,
  selectedConcept,
  expanded,
  onToggle,
  onSelect,
}: {
  node: TypeHierarchyNode;
  depth: number;
  selectedConcept: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (rid: string) => void;
}) {
  const kids = node.children ?? [];
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(node.rid);

  return (
    <li>
      <div
        className={`om-tree-item om-tree-node ${selectedConcept === node.rid ? 'active' : ''}`}
        style={{ '--om-depth': depth } as React.CSSProperties}
        title={node.rid}
        onClick={() => onSelect(node.rid)}
      >
        {hasKids ? (
          <button
            type="button"
            className="om-tree-caret"
            aria-label={isOpen ? '折叠子概念' : '展开子概念'}
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.rid);
            }}
          >
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : (
          <span className="om-tree-caret om-tree-caret--leaf" aria-hidden="true" />
        )}
        <span className="om-tree-label">{node.display_name || slugOf(node.rid)}</span>
        {hasKids ? <span className="count">{countNodes(node) - 1}</span> : null}
      </div>
      {hasKids && isOpen ? (
        <ul className="om-tree-branch">
          {kids.map((k) => (
            <ConceptTreeNode
              key={k.rid}
              node={k}
              depth={depth + 1}
              selectedConcept={selectedConcept}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function OntologyModelingPage({
  createOpen,
  setCreateOpen,
  refreshKey,
}: {
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  /** Shell 注入：proposal execute 成功后递增，触发本组件重新拉数据。 */
  refreshKey?: number;
}) {
    const [objectTypes, setObjectTypes] = useState<KernelObjectType[]>([]);
  const navigate = useNavigate();
  const [actionTypes, setActionTypes] = useState<KernelActionType[]>([]);
  const [linkTypes, setLinkTypes] = useState<KernelLinkType[]>([]);
  // EXP-02/04：值类型注册表 + Interface 清单（V2 编辑器数据源）
  const [valueTypes, setValueTypes] = useState<KernelValueType[]>([]);
  const [ontInterfaces, setOntInterfaces] = useState<KernelInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  /** 业务域 → 概念 → 子概念 的层级树（GET /object-types/hierarchy）。 */
  const [typeHierarchy, setTypeHierarchy] = useState<TypeHierarchyNode[]>([]);
  /** 展开的节点 rid（含 `domain:<码>` 形式的域节点）。 */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // V2 类型/属性编辑器（create 由 Shell 的 createOpen 驱动；edit 由本页按钮驱动）
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorPrefill, setEditorPrefill] = useState<ObjectTypeEditorPrefill>({});
  // 提交时 precheck 命中候选：暂存完整 payload，候选 Modal「仍要新建」直接落库
  const [pendingCreatePayload, setPendingCreatePayload] = useState<KernelObjectTypeCreate | null>(null);
  // 用户在候选 Modal 选过「仍要新建」的 name|slug|domain 组合（本次会话不再重复扫描）
  const [precheckDismissedKey, setPrecheckDismissedKey] = useState('');

  // 相似候选扫描（precheck） + 合并 drawer
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [candidates, setCandidates] = useState<ObjectTypeCandidate[]>([]);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [precheckSource, setPrecheckSource] = useState<{ name: string; slug: string; domain: string } | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<KernelObjectType | null>(null);
  const [mergeTarget, setMergeTarget] = useState<KernelObjectType | null>(null);
  const [mergeSubmitting, setMergeSubmitting] = useState(false);


  // 重拉全部 kernel 数据（初始加载 / 写操作后刷新）
  const refreshAll = async () => {
    const [ots, ats, lts, vts, ifcs, hierarchy] = await Promise.all([
      listObjectTypes(),
      listActionTypes(),
      listLinkTypes(),
      // value-types / interfaces 拉取失败不阻塞页面（编辑器内有兜底注册表）
      listValueTypes().catch(() => [] as KernelValueType[]),
      listInterfaces().catch(() => [] as KernelInterface[]),
      // 层级树失败时退回「域 → 概念」两层的平铺视图
      getTypeHierarchy().catch(() => [] as TypeHierarchyNode[]),
    ]);
    setObjectTypes(ots);
    setActionTypes(ats);
    setLinkTypes(lts);
    setValueTypes(vts);
    setOntInterfaces(ifcs);
    setTypeHierarchy(hierarchy);
    return ots;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ots = await refreshAll();
        if (!active) return;
        if (ots.length > 0 && !selectedConcept) {
          setSelectedDomain(domainOfObjectType(ots[0].rid));
          setSelectedConcept(ots[0].rid);
        }
      } catch (e) {
        console.warn('本体数据加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const currentDomainItems = useMemo(() => {
    if (!selectedDomain) return [];
    return objectTypes.filter((ot) => domainOfObjectType(ot.rid) === selectedDomain);
  }, [objectTypes, selectedDomain]);

  /**
   * 业务域 → 概念 → 子概念（递归）→ 末级概念。
   * 主数据源是 GET /object-types/hierarchy —— 后端返回的就是一片森林（每个节点只出现一次，
   * 挂在它的父节点下；没有父节点的才是顶层），所以**整棵子树跟随根节点的域**，
   * 跨域的父子不会被拆散。
   * 端点不可用或返回空时，降级为「域 → 概念」两层，页面不至于没得点。
   */
  const treeByDomain = useMemo(() => {
    const groups = new Map<string, TypeHierarchyNode[]>();

    if (typeHierarchy.length > 0) {
      for (const root of typeHierarchy) {
        const domain = domainOfObjectType(root.rid);
        const list = groups.get(domain) ?? [];
        list.push(root);
        groups.set(domain, list);
      }
      if (groups.size > 0) return groups;
    }

    for (const ot of objectTypes) {
      const domain = domainOfObjectType(ot.rid);
      const list = groups.get(domain) ?? [];
      list.push({
        rid: ot.rid,
        display_name: ot.display_name,
        parent_class: ot.parent_class ?? '',
        children: [],
      });
      groups.set(domain, list);
    }
    return groups;
  }, [typeHierarchy, objectTypes]);

  // 首次拿到层级树后自动展开到末级；用户手动开合过就不再覆盖
  useEffect(() => {
    if (treeByDomain.size === 0) return;
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const domain of treeByDomain.keys()) next.add(`domain:${domain}`);
      const walk = (nodes: TypeHierarchyNode[]) => {
        for (const n of nodes) {
          if (n.children?.length) {
            next.add(n.rid);
            walk(n.children);
          }
        }
      };
      walk(typeHierarchy);
      return next;
    });
  }, [treeByDomain, typeHierarchy]);

  const toggleNode = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 过滤后的概念列表（当前业务域下）
  const filteredConcepts = useMemo(() => {
    let items = currentDomainItems;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      items = items.filter(
        (ot) => ot.display_name.toLowerCase().includes(kw) || ot.rid.toLowerCase().includes(kw),
      );
    }
    if (statusFilter) {
      items = items.filter((ot) => conceptStatus(ot, linkTypes, actionTypes) === statusFilter);
    }
    return items;
  }, [currentDomainItems, keyword, statusFilter, linkTypes, actionTypes]);

  // 选中概念详情（属性表 + 关联 action + 关系）
  const selectedConceptDetail = useMemo(
    () => objectTypes.find((ot) => ot.rid === selectedConcept) ?? null,
    [objectTypes, selectedConcept],
  );

  // 2026-09-24 用户决策（第二次收敛）：「查看」→ SheetDetail 抽屉展示属性
  //（与对象浏览的查看模式一致，非模态 456px 侧滑）。工作台不再内联下钻、
  // 也不跳路由——属性查看就地完成，编辑仍走 V2 抽屉。
  const [viewConceptOpen, setViewConceptOpen] = useState(false);
  const viewConcept = (rid: string) => {
    setSelectedConcept(rid);
    setViewConceptOpen(true);
  };

  const stats = useMemo(() => {
    const totalProps = objectTypes.reduce((acc, ot) => acc + ot.properties.length, 0);
    return { concepts: objectTypes.length, props: totalProps, links: linkTypes.length };
  }, [objectTypes, linkTypes]);

  // ── V2 类型/属性编辑器编排 ──

  // Shell「新建概念」按钮 → 打开 V2 编辑器（create 模式）
  useEffect(() => {
    if (!createOpen) return;
    setEditorMode('create');
    setEditorPrefill({});
    setEditorOpen(true);
  }, [createOpen]);

  // 打开编辑器（edit 模式）：可指定直接展开某属性 / 直接追加新属性
  const openEditConcept = (prefill: ObjectTypeEditorPrefill = {}) => {
    setEditorMode('edit');
    setEditorPrefill(prefill);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setCreateOpen(false);
  };

  // 概念名称失焦（create 模式）→ 调 precheck；命中候选 → 弹 Modal 让用户选 merge / 仍要新建 / 取消
  const handleCreateNameBlur = async (name: string, slug: string, domain: string) => {
    if (!name) return;
    if (precheckDismissedKey === `${name}|${slug}|${domain}`) return;
    setPrecheckLoading(true);
    try {
      // slug 暂未填也允许按 name 扫（后端兜底走 embedder）
      const resp = await precheckObjectTypes({ name, slug: slug || name, domain, top_k: 5 });
      const list = resp?.candidates ?? [];
      if (list.length > 0) {
        // 失焦触发的扫描：清掉提交路径的暂存 payload（本路径只提示，不落库）
        setPendingCreatePayload(null);
        setCandidates(list);
        setPrecheckSource({ name, slug, domain });
        setCandidateModalOpen(true);
      }
    } catch (e) {
      // precheck 失败不阻塞创建流程（best-effort）
      console.warn('precheck 失败', e);
    } finally {
      setPrecheckLoading(false);
    }
  };

  // 保存成功后的收尾：清暂存、重拉、选中新概念
  const afterEditorSave = async (rid: string) => {
    setPendingCreatePayload(null);
    const ots = await refreshAll();
    setSelectedDomain(domainOfObjectType(rid));
    if (ots.some((ot) => ot.rid === rid)) setSelectedConcept(rid);
  };

  // V2 编辑器提交：create 先过 precheck 门禁；edit 整体 upsert。
  // 返回 null=成功；string=错误信息；DestructiveConfirmDetail 对象=409 破坏性门禁
  // （编辑器抽屉底部展示二段确认区，确认重发时 payload 顶层带 confirm_name）。
  const submitEditor = async (
    payload: KernelObjectTypeCreate, mode: 'create' | 'edit',
  ): Promise<string | DestructiveConfirmDetail | null> => {
    const domain = domainOfObjectType(payload.rid);
    // rid = ont.<tenant>.obj.<domain>.<slug>.v1 → slug 段（与 handleCreateNameBlur 的 key 同构）
    const fullSlug = slugAndVersionOfObjectType(payload.rid).slug.replace(/^obj\./, '');
    const slug = fullSlug.slice(domain.length + 1);
    const key = `${payload.display_name}|${slug}|${domain}`;
    try {
      if (mode === 'create' && precheckDismissedKey !== key) {
        try {
          const resp = await precheckObjectTypes({
            name: payload.display_name, slug, domain, top_k: 5,
          });
          const list = resp?.candidates ?? [];
          if (list.length > 0) {
            // 抽屉正常关闭，由候选 Modal 续接（合并 / 仍要新建直接落库 / 取消）
            setPendingCreatePayload(payload);
            setCandidates(list);
            setPrecheckSource({ name: payload.display_name, slug, domain });
            setCandidateModalOpen(true);
            return null;
          }
        } catch {
          // precheck 失败不阻塞创建（best-effort）
        }
      }
      await createObjectType(payload);
      await afterEditorSave(payload.rid);
      return null;
    } catch (e) {
      console.warn('保存概念失败', e);
      // G33：409 且 detail 是对象 {error:"destructive_confirm_required",...} → 交给抽屉二段确认
      const dc = extractDestructiveConfirm(e);
      if (dc) return dc;
      return errDetailText(e, '保存概念失败');
    }
  };

  // 候选 Modal 取消：丢弃暂存 payload（避免残留到下一次「仍要新建」误落库）
  const cancelCandidateModal = () => {
    setCandidateModalOpen(false);
    setPendingCreatePayload(null);
  };

  // 候选 Modal「仍要新建」：
  //   - 提交时触发的扫描（payload 已完整、抽屉已关）→ 直接落库
  //   - 失焦触发的扫描（抽屉还在、表单未填完）→ 只记录「本次已忽略」，回到编辑器继续
  const continueCreateAnyway = async () => {
    setCandidateModalOpen(false);
    if (pendingCreatePayload) {
      const payload = pendingCreatePayload;
      try {
        await createObjectType(payload);
        await afterEditorSave(payload.rid);
      } catch (e) {
        console.warn('新建概念失败', e);
      }
    } else if (precheckSource) {
      setPrecheckDismissedKey(`${precheckSource.name}|${precheckSource.slug}|${precheckSource.domain}`);
    }
  };

  // 用户在候选 Modal 里选了某个候选 → 打开合并 drawer（先 resolve source / target 完整定义）
  const openMergeDrawerForCandidate = async (candidate: ObjectTypeCandidate) => {
    if (!precheckSource) return;
    setCandidateModalOpen(false);
    // 合并 drawer zIndex(1100) 低于 V2 编辑器(1200)：先关编辑器避免遮挡
    setEditorOpen(false);
    setCreateOpen(false);
    setPendingCreatePayload(null);
    try {
      const tenant = getTenantId() || 'demo';
      const sourceRid = `ont.${tenant}.obj.${precheckSource.domain}.${precheckSource.slug}.v1`;
      const [source, target] = await Promise.all([
        getObjectType(sourceRid).catch(() => null),
        getObjectType(candidate.rid).catch(() => null),
      ]);
      // 兜底：若 source 还没建出来（仅 precheck 命中），从现有列表里挑一个等价的 rid
      const resolvedSource = source ?? objectTypes.find((ot) =>
        ot.display_name === precheckSource.name || slugAndVersionOfObjectType(ot.rid).slug === `obj.${precheckSource.domain}.${precheckSource.slug}`,
      ) ?? null;
      const resolvedTarget = target ?? objectTypes.find((ot) => ot.rid === candidate.rid) ?? null;
      if (!resolvedSource || !resolvedTarget) {
        console.warn('无法 resolve source / target rid，跳过合并 drawer');
        return;
      }
      setMergeSource(resolvedSource);
      setMergeTarget(resolvedTarget);
      setMergeOpen(true);
    } catch (e) {
      console.warn('resolve 合并对象失败', e);
    }
  };

  // 合并 drawer 确认 → 调 /object-types/merge → 刷新列表 → 选中 target
  const submitMerge = async (mapping: Record<string, string>): Promise<boolean> => {
    if (!mergeSource || !mergeTarget) return false;
    setMergeSubmitting(true);
    try {
      await mergeObjectTypes({
        source_rid: mergeSource.rid,
        target_rid: mergeTarget.rid,
        mapping,
      });
      setMergeOpen(false);
      setMergeSource(null);
      setMergeTarget(null);
      // 候选 Modal 也关掉、create 编辑器关掉
      setCandidateModalOpen(false);
      setCandidates([]);
      setCreateOpen(false);
      setPendingCreatePayload(null);
      const ots = await refreshAll();
      const targetDomain = domainOfObjectType(mergeTarget.rid);
      setSelectedDomain(targetDomain);
      if (ots.some((ot) => ot.rid === mergeTarget.rid)) setSelectedConcept(mergeTarget.rid);
      return true;
    } catch (e) {
      console.warn('合并失败', e);
      return false;
    } finally {
      setMergeSubmitting(false);
    }
  };

  return (
    <div className="mp-flex mp-flex-1 mp-min-h-0 mp-flex-col" >
      <style>{`
        .om-tree-item{display:flex;align-items:center;gap:var(--mp-space-2);padding:var(--mp-space-2) var(--mp-space-3);border-radius:var(--semi-border-radius-medium);cursor:pointer;font-size:13px;color:var(--semi-color-text-2);margin-bottom:var(--mp-space-1)}
        .om-tree-item:hover{background:var(--semi-color-fill-0);color:var(--semi-color-text-0)}
        .om-tree-item.active{background:var(--semi-color-fill-0);color:var(--semi-color-text-0)}
        .om-tree-item svg{width:16px;height:16px;flex-shrink:0}
        .om-tree-item .count{margin-left:auto;font-size:11px;color:var(--semi-color-text-2);background:var(--semi-color-bg-0);padding:var(--mp-space-1) var(--mp-space-2);border-radius:var(--semi-border-radius-small)}
        .om-tree-node{padding-left:calc(var(--mp-space-3) + var(--om-depth,0) * 14px)}
        .om-tree-branch{list-style:none;margin:0;padding:0}
        .om-tree-caret{display:flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;padding:0;background:none;border:none;cursor:pointer;color:var(--semi-color-text-3)}
        .om-tree-caret:hover{color:var(--semi-color-text-0)}
        .om-tree-caret svg{width:14px;height:14px}
        .om-tree-caret--leaf{visibility:hidden;cursor:default}
        .om-tree-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .om-table{width:100%;border-collapse:collapse}
        .om-table th{padding:var(--mp-space-3) var(--mp-space-4);font-size:12px;font-weight:500;color:var(--semi-color-text-2);text-align:left;border-bottom:1px solid var(--semi-color-border);white-space:nowrap}
        .om-table td{padding:var(--mp-space-3) var(--mp-space-4);font-size:13px;border-bottom:1px solid var(--semi-color-border);vertical-align:middle}
        .om-table tbody tr{cursor:pointer}
        .om-table tbody tr:hover{background:var(--semi-color-fill-0)}
        .om-table tbody tr.selected{background:var(--semi-color-fill-0)}
        .om-table tbody tr:last-child td{border-bottom:none}
        .om-attr-table{width:100%;border-collapse:collapse}
        .om-attr-table thead{background:var(--semi-color-fill-0)}
        .om-attr-table th{padding:var(--mp-space-3) var(--mp-space-4);font-size:12px;font-weight:500;color:var(--semi-color-text-2);text-align:left;border-bottom:1px solid var(--semi-color-border);white-space:nowrap}
        .om-attr-table td{padding:var(--mp-space-3) var(--mp-space-4);font-size:13px;border-bottom:1px solid var(--semi-color-border);vertical-align:middle}
        .om-attr-table tbody tr:last-child td{border-bottom:none}
        .om-attr-table tbody tr:hover{background:var(--semi-color-fill-0)}
        .om-relation-item{display:flex;align-items:center;gap:var(--mp-space-2);padding:var(--mp-space-2);border-radius:var(--semi-border-radius-small);font-size:13px;margin-bottom:var(--mp-space-1);cursor:pointer;transition:background .15s}
        .om-relation-item:hover{background:var(--semi-color-fill-0)}
        .om-relation-label{font-weight:500;min-width:48px}
        .om-relation-target{color:var(--semi-color-primary)}
        .om-relation-icon{width:28px;height:28px;border-radius:var(--semi-border-radius-small);background:var(--semi-color-fill-0);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .om-relation-icon svg{width:14px;height:14px;color:var(--semi-color-text-2)}
        .om-view-head{display:flex;flex-direction:column;gap:4px;margin-bottom:16px}
        .om-view-title{display:flex;align-items:center;gap:8px;font-size:15px}
        .om-view-meta{display:flex;gap:8px}
        .om-view-rid{color:var(--semi-color-text-2);word-break:break-all}
        .om-view-section{margin-bottom:16px}
        .om-view-section-title{font-weight:600;font-size:13px;margin-bottom:8px;color:var(--semi-color-text-1)}
        .om-view-props{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
        .om-view-prop{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--semi-color-border);border-radius:var(--semi-border-radius-small);font-size:13px}
        .om-view-prop>span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .om-prop-type{font-size:11px;line-height:16px;padding:0 6px;border-radius:999px;background:var(--semi-color-fill-0);color:var(--semi-color-text-2);white-space:nowrap}
        .om-prop-mark{font-size:11px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid var(--semi-color-border);color:var(--semi-color-text-2);white-space:nowrap}
        .om-prop-mark--req{color:var(--semi-color-success);border-color:var(--semi-color-success)}
        .om-stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--mp-space-3);margin-bottom:var(--mp-space-5)}
        .om-stat-card{background:var(--semi-color-bg-1);border:1px solid var(--semi-color-border);border-radius:var(--semi-border-radius-medium);padding:var(--mp-space-4)}
        .om-stat-value{font-size:28px;font-weight:700;line-height:1;letter-spacing:-0.02em}
        .om-stat-label{font-size:12px;color:var(--semi-color-text-2);margin-top:var(--mp-space-1)}
        .mp-attr-badge{display:inline-block;font-size:11px;line-height:16px;padding:0 var(--mp-space-2);border-radius:999px;border:1px solid var(--semi-color-text-2);color:var(--semi-color-text-2);white-space:nowrap}
      `}</style>
      <div className="mp-flex-1 mp-overflow-y-auto mp-min-h-0 mp-pb-6" >

      {/* Stats（真实数据） */}
      <div className="om-stats-row">
        <div className="om-stat-card">
          <div className="om-stat-value">{loading ? '…' : stats.concepts}</div>
          <div className="om-stat-label">概念总数</div>
        </div>
        <div className="om-stat-card">
          <div className="om-stat-value">{loading ? '…' : stats.props}</div>
          <div className="om-stat-label">属性总数</div>
        </div>
        <div className="om-stat-card">
          <div className="om-stat-value">{loading ? '…' : stats.links}</div>
          <div className="om-stat-label">关系总数</div>
        </div>
      </div>

      {/* AIAssistantWorkspace__content 是横向 flex 容器：子行必须 flex:1 + width:100%
          才能撑满可用宽度（此前缺省导致右侧约 1/3 空白）。 */}
      <div className="mp-w-full mp-flex mp-flex-1 mp-gap-5">
        {/* Left: 业务域 → 概念（逐级下钻到末级） */}
        <div className="mp-shrink-0 mp-w-240" >
          <Card className="mp-h-fit">
            <h3 className="mp-fw-600 mp-mb-3 mp-text-md">业务域</h3>
            <ul className="mp-m-0 mp-p-1 mp-onto-list-plain">
              {loading ? (
                <li className="mp-text-sm mp-text-2 mp-py-2 mp-px-3" >加载中…</li>
              ) : treeByDomain.size === 0 ? (
                <li className="mp-text-sm mp-text-2 mp-py-2 mp-px-3" >暂无本体</li>
              ) : (
                Array.from(treeByDomain.entries()).map(([domain, nodes]) => {
                  const domainKey = `domain:${domain}`;
                  const isOpen = expanded.has(domainKey);
                  const total = nodes.reduce((acc, n) => acc + countNodes(n), 0);
                  return (
                    <li key={domain}>
                      <div
                        className={`om-tree-item ${domain === selectedDomain ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedDomain(domain);
                          if (nodes.length > 0) setSelectedConcept(nodes[0].rid);
                        }}
                      >
                        <button
                          type="button"
                          className="om-tree-caret"
                          aria-label={isOpen ? '折叠业务域' : '展开业务域'}
                          aria-expanded={isOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNode(domainKey);
                          }}
                        >
                          {isOpen ? <ChevronDown /> : <ChevronRight />}
                        </button>
                        <Hexagon />
                        {DOMAIN_LABELS[domain] ?? domain}
                        <span className="count">{total}</span>
                      </div>
                      {isOpen ? (
                        <ul className="om-tree-branch">
                          {nodes.map((n) => (
                            <ConceptTreeNode
                              key={n.rid}
                              node={n}
                              depth={0}
                              selectedConcept={selectedConcept}
                              expanded={expanded}
                              onToggle={toggleNode}
                              onSelect={(rid) => {
                                setSelectedDomain(domain);
                                setSelectedConcept(rid);
                              }}
                            />
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </Card>
        </div>

        {/* Right: Concept Panel */}
        <div className="mp-flex-1">
          {/* Search & Filter bar */}
          <div className="mp-mb-4 mp-flex-center mp-gap-2" >
            <div className="mp-flex-1 mp-relative mp-onto-search-box">
              <Search className="mp-icon-16 mp-text-2 mp-absolute mp-onto-search-icon" />
              <input
                type="text"
                placeholder="搜索概念名称 / rid..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="mp-w-full mp-text-body mp-text-1 mp-border mp-rounded mp-bg-1 mp-onto-input mp-onto-input--search"
              />
            </div>
            <div className="mp-flex mp-hidden mp-border mp-rounded mp-gap-1" >
              {(['connected', 'partial', 'disconnected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(statusFilter === st ? '' : st)}
                  className={`mp-clickable mp-gap-1 mp-text-sm mp-flex-center mp-border-none mp-onto-filter-btn${statusFilter === st ? ' mp-onto-filter-btn--active' : ''}`}
                >
                  <span className={statusDotClass(st)} />
                  {statusLabel(st)}
                </button>
              ))}
            </div>
          </div>

          {/* Concept Table */}
          <Card className="mp-hidden" bodyStyle={{padding: 0}}>
            <div className="mp-border mp-py-3 mp-px-5" >
              <h4 className="mp-fw-600 mp-text-md">
                {DOMAIN_LABELS[selectedDomain] ?? (selectedDomain || '全部')} - 概念
              </h4>
            </div>
            {loading ? (
              <div className="mp-text-center mp-p-8 mp-text-body mp-text-2">加载概念中…</div>
            ) : filteredConcepts.length === 0 ? (
              <div className="mp-text-center mp-p-8 mp-text-body mp-text-2">当前业务域下没有匹配的概念</div>
            ) : (
              <table className="om-table">
                <thead>
                  <tr className="mp-bg-fill-0">
                    <th>显示名</th>
                    <th>slug</th>
                    <th>版本</th>
                    <th>领域</th>
                    <th>属性数</th>
                    <th>关系数</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConcepts.map((ot) => {
                    const domain = domainOfObjectType(ot.rid);
                    const { slug, version } = slugAndVersionOfObjectType(ot.rid);
                    const st = conceptStatus(ot, linkTypes, actionTypes);
                    const relCount = linkTypes.filter((lt) => lt.src === ot.rid || lt.dst === ot.rid).length;
                    return (
                      <tr
                        key={ot.rid}
                        className={ot.rid === selectedConcept ? 'selected' : undefined}
                        onClick={() => setSelectedConcept(ot.rid)}
                      >
                        <td>
                          <span className="mp-inline-flex mp-items-center mp-gap-1" >
                            <Hexagon className="mp-icon-14 mp-text-2" />
                            <span className="mp-fw-500">{ot.display_name}</span>
                          </span>
                        </td>
                        <td className="mp-text-sm mp-text-2">{slug}</td>
                        <td className="mp-text-sm mp-text-2">{version || '—'}</td>
                        <td>{DOMAIN_LABELS[domain] ?? domain}</td>
                        <td>
                          <span className="mp-inline-flex mp-items-center mp-gap-1 mp-text-2">
                            <Columns3 className="mp-icon-14" />{ot.properties.length}
                          </span>
                        </td>
                        <td>
                          <span className="mp-inline-flex mp-items-center mp-gap-1 mp-text-2">
                            <LinkIcon className="mp-icon-14" />{relCount}
                          </span>
                        </td>
                        <td>
                          <span className="mp-inline-flex mp-items-center mp-text-sm mp-gap-1" >
                            <span className={statusDotClass(st)} /> {statusLabel(st)}
                          </span>
                        </td>
                        <td>
                          <div className="mp-flex-center mp-gap-1">
                            <Button theme="light" type="secondary" className="mp-text-sm mp-onto-btn--sm"
                              onClick={(e) => { e.stopPropagation(); viewConcept(ot.rid); }}
                            >
                              查看
                            </Button>
                            <Button theme="light" type="tertiary" className="mp-text-sm mp-onto-btn--sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedConcept(ot.rid); openEditConcept(); }}
                            >
                              编辑
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      {/* 概念查看抽屉（2026-09-24 用户决策）：非模态 456px 侧滑，
          承载原内联下钻区的属性 / 关联 Action / 关系——就地查看不离开工作台 */}
      <SheetDetail
        title="概念详情"
        open={viewConceptOpen && !!selectedConceptDetail}
        onClose={() => setViewConceptOpen(false)}
        footer={
          <>
            <Button
              icon={<ExternalLink size={15} strokeWidth={1.5} />}
              disabled={!selectedConceptDetail}
              onClick={() => {
                const target = selectedConceptDetail?.rid;
                setViewConceptOpen(false);
                if (target) navigate(`/ontology/model/object-types/${encodeURIComponent(target)}`);
              }}
            >
              打开完整详情
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Columns3 size={15} strokeWidth={1.5} />}
              disabled={!selectedConceptDetail}
              onClick={() => {
                setViewConceptOpen(false);
                openEditConcept({});
              }}
            >
              编辑概念
            </Button>
          </>
        }
      >
        {selectedConceptDetail ? (
          <>
            <div className="om-view-head">
              <div className="om-view-title">
                <Hexagon className="mp-icon-14 mp-text-2" />
                <span className="mp-fw-600">{selectedConceptDetail.display_name}</span>
              </div>
              <div className="om-view-meta">
                <span className="mp-eyebrow">{selectedConceptDetail.properties.length} 个属性</span>
                <span className="mp-eyebrow">
                  {DOMAIN_LABELS[domainOfObjectType(selectedConceptDetail.rid)] ??
                    domainOfObjectType(selectedConceptDetail.rid)}
                </span>
              </div>
              <div className="om-view-rid mp-text-xs mp-mono">{selectedConceptDetail.rid}</div>
            </div>

            <div className="om-view-section">
              <div className="om-view-section-title">属性定义</div>
              {selectedConceptDetail.properties.length === 0 ? (
                <div className="mp-text-sm mp-text-2">该概念没有属性。</div>
              ) : (
                <ul className="om-view-props">
                  {selectedConceptDetail.properties.map((attr) => {
                    const propSlug = slugAndVersionOfProperty(attr.rid).slug.replace(
                      /^(prop|prp)\./,
                      '',
                    );
                    return (
                      <li key={attr.rid} className="om-view-prop" title={attr.description || attr.title || undefined}>
                        <span className="mp-fw-500">{attr.title || propSlug}</span>
                        <span className={`om-prop-type ${typeBadgeClass(attr.type_id)}`}>{attr.type_id}</span>
                        {attr.primary_key && <span className="om-prop-mark">主键</span>}
                        {attr.nullable ? null : <span className="om-prop-mark om-prop-mark--req">必填</span>}
                        {attr.shared && <span className="om-prop-mark">共享</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="om-view-section">
              {(() => {
                const rel = actionTypes.filter((at) => at.on.includes(selectedConceptDetail.rid));
                if (rel.length === 0) return null;
                return (
                  <>
                    <div className="om-view-section-title">关联 Action（{rel.length}）</div>
                    {rel.map((at) => (
                      <div
                        key={at.rid}
                        className="om-relation-item mp-clickable"
                        title={`查看 ${at.rid} 详情`}
                        onClick={() => {
                          setViewConceptOpen(false);
                          navigate(`/ontology/logic/actions/${encodeURIComponent(at.rid)}`);
                        }}
                      >
                        <div className="om-relation-icon"><Zap className="mp-icon-14" /></div>
                        <span className="om-relation-label">{actionDisplayName(at)}</span>
                        <ArrowRight className="mp-icon-14 mp-text-sm mp-text-2 mp-shrink-0" />
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            <div className="om-view-section">
              <div className="om-view-section-title">
                关系定义（
                {
                  linkTypes.filter(
                    (lt) => lt.src === selectedConceptDetail!.rid || lt.dst === selectedConceptDetail!.rid,
                  ).length
                }
                ）
              </div>
              {linkTypes.filter((lt) => lt.src === selectedConceptDetail.rid || lt.dst === selectedConceptDetail.rid)
                .length === 0 ? (
                <div className="mp-text-sm mp-text-2">暂无关系定义。</div>
              ) : (
                linkTypes
                  .filter((lt) => lt.src === selectedConceptDetail!.rid || lt.dst === selectedConceptDetail!.rid)
                  .map((lt) => (
                    <div key={lt.rid} className="om-relation-item">
                      <div className="om-relation-icon"><LinkIcon className="mp-icon-14" /></div>
                      <span className="om-relation-label">{lt.rid.split('.').pop()}</span>
                      <ArrowRight className="mp-icon-14 mp-text-sm mp-text-2 mp-shrink-0" />
                      <span className="om-relation-target">
                        {lt.src === selectedConceptDetail!.rid ? lt.dst.split('.').pop() : lt.src.split('.').pop()}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </>
        ) : null}
      </SheetDetail>

      {/* V2 类型/属性编辑器：create（Shell 按钮）/ edit（编辑概念 / 新增属性 / 行内编辑） */}
      <ObjectTypeEditorV2Drawer
        open={editorOpen}
        mode={editorMode}
        objectType={editorMode === 'edit' ? selectedConceptDetail : null}
        objectTypes={objectTypes}
        linkTypes={linkTypes}
        interfaces={ontInterfaces}
        valueTypes={valueTypes}
        tenant={getTenantId() || 'demo'}
        domainOptions={Object.entries(DOMAIN_LABELS).map(([code, label]) => ({ code, label }))}
        prefill={editorPrefill}
        onClose={closeEditor}
        onSubmit={submitEditor}
        onCreateNameBlur={handleCreateNameBlur}
        prechecking={precheckLoading}
      />

      {/* 相似候选 Modal：precheck 命中后展示，每个候选可三选一。
          zIndex 1500 —— 需盖过 V2 编辑器原生 overlay（1200）。 */}
      <Modal
        title={
          <div className="mp-gap-2 mp-flex-center">
            <AlertTriangle className="mp-icon-16 mp-text-warning" />
            <span>检测到相似概念</span>
          </div>
        }
        visible={candidateModalOpen}
        onCancel={cancelCandidateModal}
        footer={null}
        width={640}
        zIndex={1500}
      >
        <div className="mp-mb-3 mp-text-sm mp-text-2 mp-lh-16" >
          概念名「<strong className="mp-text-1">{precheckSource?.name}</strong>」与下方已有概念相似，
          请选择「合并到它」（走合并 drawer，迁移数据后软删源）或「仍要新建」
          {pendingCreatePayload ? '（忽略提示，直接创建新概念）' : '（忽略提示，回到编辑器继续填写）'}。
        </div>
        <div className="mp-flex mp-gap-2 mp-flex-col" >
          {candidates.map((c) => {
            const sim = Math.round(c.similarity * 100);
            return (
              <div
                key={c.rid}
                className="mp-border mp-rounded mp-gap-3 mp-p-3 mp-flex-center mp-bg-1"
              >
                <GitMerge className="mp-icon-16 mp-text-2 mp-shrink-0"  />
                <div className="mp-flex-1">
                  <div className="mp-fw-500 mp-text-body">{c.display_name}</div>
                  <div className="mp-text-xs mp-text-2 mp-mt-1" >
                    rid：<code>{c.rid}</code>
                  </div>
                </div>
                <div className={`mp-fw-600 mp-shrink-0 mp-text-xs mp-py-1 mp-px-2 mp-rounded-sm mp-onto-sim-chip${sim >= 80 ? ' mp-onto-sim-chip--danger' : sim >= 60 ? ' mp-onto-sim-chip--warn' : ''}`}>
                  {sim}%
                </div>
                <button
                  type="button"
                  onClick={() => openMergeDrawerForCandidate(c)}
                  className="mp-clickable mp-rounded mp-text-sm mp-border-none mp-onto-btn mp-onto-btn--primary mp-onto-btn--md"
                >
                  合并到它
                </button>
              </div>
            );
          })}
        </div>
        <div className="mp-flex mp-justify-end mp-border mp-mt-4 mp-gap-2 mp-pt-3" >
          <button
            type="button"
            onClick={cancelCandidateModal}
            className="mp-clickable mp-border mp-rounded mp-text-body mp-text-1 mp-bg-1 mp-onto-btn mp-onto-btn--lg"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void continueCreateAnyway()}
            className="mp-clickable mp-rounded mp-text-body mp-border-none mp-onto-btn mp-onto-btn--primary mp-onto-btn--lg"
          >
            仍要新建
          </button>
        </div>
      </Modal>

      {/* 合并 drawer：source/target 属性对比 + 用户勾选映射 → 提交 /object-types/merge */}
      <OntologyMergeDrawer
        open={mergeOpen}
        source={mergeSource}
        target={mergeTarget}
        onMerge={submitMerge}
        onCancel={() => {
          setMergeOpen(false);
          setMergeSource(null);
          setMergeTarget(null);
        }}
        submitting={mergeSubmitting}
      />
      </div>
    </div>
  );
}
