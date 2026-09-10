import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Modal } from '@douyinfe/semi-ui';
import { useLocation } from 'react-router-dom';
import {
  Hexagon, Search, Plus, Columns3,
  Link as LinkIcon, ArrowRight, Zap, GitBranch, GitMerge, AlertTriangle,
} from 'lucide-react';
import {
  listObjectTypes, listActionTypes, listLinkTypes,
  listValueTypes, listInterfaces,
  createObjectType,
  getObjectType,
  precheckObjectTypes, mergeObjectTypes,
  domainOfObjectType, slugAndVersionOfObjectType, slugAndVersionOfProperty,
  errDetailText, extractDestructiveConfirm,
  type KernelObjectType, type KernelActionType, type KernelLinkType,
  type KernelValueType, type KernelInterface, type KernelObjectTypeCreate,
  type ObjectTypeCandidate, type DestructiveConfirmDetail,
} from '@/api/ont/kernel';
import { getTenantId } from '@/utils/auth';
import { actionDisplayName } from './actions/ActionTypeListPage';
import OntologyMergeDrawer from './components/OntologyMergeDrawer';
import ObjectTypeEditorV2Drawer, { type ObjectTypeEditorPrefill } from './components/ObjectTypeEditorV2Drawer';


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

const statusDotStyle = (status: string) => ({
  width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  background: status === 'connected' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--destructive)',
});

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

  const detailRef = useRef<HTMLDivElement>(null);

  // 重拉全部 kernel 数据（初始加载 / 写操作后刷新）
  const refreshAll = async () => {
    const [ots, ats, lts, vts, ifcs] = await Promise.all([
      listObjectTypes(),
      listActionTypes(),
      listLinkTypes(),
      // value-types / interfaces 拉取失败不阻塞页面（编辑器内有兜底注册表）
      listValueTypes().catch(() => [] as KernelValueType[]),
      listInterfaces().catch(() => [] as KernelInterface[]),
    ]);
    setObjectTypes(ots);
    setActionTypes(ats);
    setLinkTypes(lts);
    setValueTypes(vts);
    setOntInterfaces(ifcs);
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

  // 一级本体列表：按 rid 域名段分组
  const domains = useMemo(() => {
    const map = new Map<string, KernelObjectType[]>();
    for (const ot of objectTypes) {
      const d = domainOfObjectType(ot.rid);
      const list = map.get(d) ?? [];
      list.push(ot);
      map.set(d, list);
    }
    return Array.from(map.entries()).map(([domain, items]) => ({
      domain,
      label: DOMAIN_LABELS[domain] ?? domain,
      items,
    }));
  }, [objectTypes]);

  const currentDomainItems = useMemo(() => {
    if (!selectedDomain) return [];
    return objectTypes.filter((ot) => domainOfObjectType(ot.rid) === selectedDomain);
  }, [objectTypes, selectedDomain]);

  // 过滤后的概念列表（当前一级本体下）
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

  const selectedActions = useMemo(() => {
    if (!selectedConceptDetail) return [];
    return actionTypes.filter((at) => at.on.includes(selectedConceptDetail.rid));
  }, [actionTypes, selectedConceptDetail]);

  const selectedLinks = useMemo(() => {
    if (!selectedConceptDetail) return [];
    return linkTypes.filter((lt) => lt.src === selectedConceptDetail.rid || lt.dst === selectedConceptDetail.rid);
  }, [linkTypes, selectedConceptDetail]);

  // 点击概念 → 选中并滚动到详情面板
  const handleSelectConcept = (rid: string) => {
    setSelectedConcept(rid);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <style>{`
        .om-tree-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--muted-foreground);margin-bottom:2px}
        .om-tree-item:hover{background:var(--muted);color:var(--foreground)}
        .om-tree-item.active{background:var(--muted);color:var(--foreground)}
        .om-tree-item svg{width:16px;height:16px;flex-shrink:0}
        .om-tree-item .count{margin-left:auto;font-size:11px;color:var(--muted-foreground);background:var(--background);padding:2px 6px;border-radius:4px}
        .om-table{width:100%;border-collapse:collapse}
        .om-table th{padding:10px 16px;font-size:12px;font-weight:500;color:var(--muted-foreground);text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
        .om-table td{padding:10px 16px;font-size:13px;border-bottom:1px solid var(--border);vertical-align:middle}
        .om-table tbody tr{cursor:pointer}
        .om-table tbody tr:hover{background:var(--muted)}
        .om-table tbody tr.selected{background:var(--muted)}
        .om-table tbody tr:last-child td{border-bottom:none}
        .om-attr-table{width:100%;border-collapse:collapse}
        .om-attr-table thead{background:var(--muted)}
        .om-attr-table th{padding:10px 16px;font-size:12px;font-weight:500;color:var(--muted-foreground);text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
        .om-attr-table td{padding:10px 16px;font-size:13px;border-bottom:1px solid var(--border);vertical-align:middle}
        .om-attr-table tbody tr:last-child td{border-bottom:none}
        .om-attr-table tbody tr:hover{background:var(--muted)}
        .om-relation-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:4px;font-size:13px;margin-bottom:2px;cursor:pointer;transition:background .15s}
        .om-relation-item:hover{background:var(--muted)}
        .om-relation-label{font-weight:500;min-width:48px}
        .om-relation-target{color:#60a5fa}
        .om-relation-icon{width:28px;height:28px;border-radius:4px;background:var(--muted);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .om-relation-icon svg{width:14px;height:14px;color:var(--muted-foreground)}
        .om-stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .om-stat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
        .om-stat-value{font-size:28px;font-weight:700;line-height:1;letter-spacing:-0.02em}
        .om-stat-label{font-size:12px;color:var(--muted-foreground);margin-top:6px}
        .v-attr-badge{display:inline-block;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid var(--muted-foreground);color:var(--muted-foreground);white-space:nowrap}
      `}</style>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

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

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left: 一级本体列表 */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <Card style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>一级本体</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {loading ? (
                <li style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted-foreground)' }}>加载中…</li>
              ) : domains.length === 0 ? (
                <li style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted-foreground)' }}>暂无本体</li>
              ) : (
                domains.map((d) => (
                  <li
                    key={d.domain}
                    className={`om-tree-item ${d.domain === selectedDomain ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedDomain(d.domain);
                      if (d.items.length > 0) setSelectedConcept(d.items[0].rid);
                    }}
                  >
                    <Hexagon />
                    {d.label}
                    <span className="count">{d.items.length}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        {/* Right: Concept Panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search & Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="搜索概念名称 / rid..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {(['connected', 'partial', 'disconnected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(statusFilter === st ? '' : st)}
                  style={{
                    height: 34, padding: '0 12px', fontSize: 12,
                    color: statusFilter === st ? 'var(--foreground)' : 'var(--muted-foreground)',
                    background: statusFilter === st ? 'var(--muted)' : 'transparent',
                    border: 'none', borderLeft: '1px solid var(--border)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={statusDotStyle(st)} />
                  {statusLabel(st)}
                </button>
              ))}
            </div>
          </div>

          {/* Concept Table */}
          <Card style={{overflow: 'hidden'}} bodyStyle={{padding: 0}}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 14, fontWeight: 600 }}>
                {DOMAIN_LABELS[selectedDomain] ?? (selectedDomain || '全部')} - 概念
              </h4>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载概念中…</div>
            ) : filteredConcepts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>当前一级本体下没有匹配的概念</div>
            ) : (
              <table className="om-table">
                <thead>
                  <tr style={{ background: 'var(--muted)' }}>
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
                        onClick={() => handleSelectConcept(ot.rid)}
                      >
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Hexagon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                            <span style={{ fontWeight: 500 }}>{ot.display_name}</span>
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{slug}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{version || '—'}</td>
                        <td>{DOMAIN_LABELS[domain] ?? domain}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                            <Columns3 style={{ width: 14, height: 14 }} />{ot.properties.length}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                            <LinkIcon style={{ width: 14, height: 14 }} />{relCount}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <span style={statusDotStyle(st)} /> {statusLabel(st)}
                          </span>
                        </td>
                        <td>
                          <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                            onClick={(e) => { e.stopPropagation(); handleSelectConcept(ot.rid); }}
                          >
                            查看
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {/* Detail Section（下钻：属性表 + V2 编辑器入口 + 关联 Action + 关系） */}
          {selectedConceptDetail && (
            <div ref={detailRef} style={{ display: 'flex', gap: 20, marginTop: 20, scrollMarginTop: 12 }}>
              {/* Attribute Table + V2 编辑器入口 + 关联 Action */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Card style={{overflow: 'hidden'}} bodyStyle={{padding: 0}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{selectedConceptDetail.display_name} · 属性定义</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="v-eyebrow">{selectedConceptDetail.properties.length} 个属性</span>
                      {/* 原生 button（dev 模式 Semi Button onClick 被截 noop） */}
                      <button
                        type="button"
                        onClick={() => openEditConcept({})}
                        style={{
                          height: 28, padding: '0 10px', fontSize: 12,
                          background: 'var(--card)', color: 'var(--foreground)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        编辑概念
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditConcept({ addNewProp: true })}
                        style={{
                          height: 28, padding: '0 10px', fontSize: 12,
                          background: 'var(--card)', color: 'var(--foreground)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Plus style={{ width: 14, height: 14 }} />新增属性
                      </button>
                    </div>
                  </div>
                  <table className="om-attr-table">
                    <thead>
                      <tr>
                        <th>属性名</th>
                        <th>版本</th>
                        <th>类型</th>
                        <th>必填</th>
                        <th>主键</th>
                        <th>标记</th>
                        <th>描述</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedConceptDetail.properties.map((attr) => {
                        const { slug, version } = slugAndVersionOfProperty(attr.rid);
                        // 砍掉 kind 段（prop / prp）—— 后端用 'prop'，统一兼容
                        const propSlug = slug.replace(/^(prop|prp)\./, '');
                        const hasMarks = attr.array || attr.derived || attr.format === 'struct' || attr.shared;
                        return (
                          <tr key={attr.rid}>
                            <td style={{ fontWeight: 500 }} title={attr.title || undefined}>{propSlug}</td>
                            <td style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{version || '—'}</td>
                            <td><span className={typeBadgeClass(attr.type_id)} title={attr.format}>{attr.type_id}</span></td>
                            <td><span style={{ color: attr.nullable ? 'var(--muted-foreground)' : 'var(--success)', fontSize: 12 }}>{attr.nullable ? '否' : '是'}</span></td>
                            <td><span style={{ color: attr.primary_key ? 'var(--success)' : 'var(--muted-foreground)', fontSize: 12 }}>{attr.primary_key ? '是' : '否'}</span></td>
                            <td>
                              <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                                {attr.array && (
                                  <span className="v-attr-badge" title={`array · reducer: ${attr.reducer ?? '未设置'}`}>数组{attr.reducer ? `·${attr.reducer}` : ''}</span>
                                )}
                                {attr.derived && (
                                  <span className="v-attr-badge" title={`derived · over_link: ${attr.derived.over_link}${attr.derived.field ? ` · field: ${attr.derived.field}` : ''}`}>派生·{attr.derived.fn}</span>
                                )}
                                {attr.format === 'struct' && (
                                  <span className="v-attr-badge" title={`${attr.struct_fields?.length ?? 0} 个嵌套字段`}>struct·{attr.struct_fields?.length ?? 0}</span>
                                )}
                                {attr.shared && <span className="v-attr-badge">共享</span>}
                                {!hasMarks && <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>—</span>}
                              </span>
                            </td>
                            <td style={{ color: 'var(--muted-foreground)', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={attr.description || attr.title || undefined}>
                              {attr.description || attr.title || '—'}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => openEditConcept({ expandPropRid: attr.rid })}
                                style={{
                                  height: 24, padding: '0 8px', fontSize: 12,
                                  background: 'var(--card)', color: 'var(--foreground)',
                                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                                  cursor: 'pointer',
                                }}
                              >
                                编辑
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>

                {/* 关联 Action */}
                {selectedActions.length > 0 && (
                  <Card style={{overflow: 'hidden', marginTop: 16}} bodyStyle={{padding: 0}}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600 }}>关联 Action</h4>
                      <span className="v-eyebrow">{selectedActions.length} 个</span>
                    </div>
                    <div style={{ padding: '12px 20px' }}>
                      {selectedActions.map((at) => (
                        <div key={at.rid} className="om-relation-item">
                          <div className="om-relation-icon"><Zap style={{ width: 14, height: 14 }} /></div>
                          <span className="om-relation-label">{actionDisplayName(at)}</span>
                          <ArrowRight style={{ color: 'var(--muted-foreground)', fontSize: 12, flexShrink: 0, width: 14, height: 14 }} />
                          <span className="om-relation-target" title={at.description || at.rid}>
                            {at.description ? at.description : `side_effects: ${at.side_effects.join(', ') || '—'}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Relation Panel */}
              <div style={{ width: 300, flexShrink: 0 }}>
                <Card style={{overflow: 'hidden', height: 'fit-content'}} bodyStyle={{padding: 0}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{selectedConceptDetail.display_name} - 关系定义</h4>
                    <span className="v-eyebrow">{selectedLinks.length} 个关系</span>
                  </div>
                  {selectedLinks.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--muted-foreground)', fontSize: 12 }}>暂无关系定义</div>
                  ) : (
                    selectedLinks.map((lt) => (
                      <div key={lt.rid} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <GitBranch style={{ width: 14, height: 14 }} />
                          {lt.src === selectedConceptDetail.rid ? '出向关系' : '入向关系'} ({lt.cardinality})
                        </div>
                        <div className="om-relation-item">
                          <div className="om-relation-icon"><LinkIcon /></div>
                          <span className="om-relation-label">{lt.rid.split('.').pop()}</span>
                          <ArrowRight style={{ color: 'var(--muted-foreground)', fontSize: 12, flexShrink: 0, width: 14, height: 14 }} />
                          <span className="om-relation-target">{lt.src === selectedConceptDetail.rid ? lt.dst.split('.').pop() : lt.src.split('.').pop()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ width: 16, height: 16, color: 'var(--warning)' }} />
            <span>检测到相似概念</span>
          </div>
        }
        visible={candidateModalOpen}
        onCancel={cancelCandidateModal}
        footer={null}
        width={640}
        zIndex={1500}
      >
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12, lineHeight: 1.6 }}>
          概念名「<strong style={{ color: 'var(--foreground)' }}>{precheckSource?.name}</strong>」与下方已有概念相似，
          请选择「合并到它」（走合并 drawer，迁移数据后软删源）或「仍要新建」
          {pendingCreatePayload ? '（忽略提示，直接创建新概念）' : '（忽略提示，回到编辑器继续填写）'}。
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {candidates.map((c) => {
            const sim = Math.round(c.similarity * 100);
            return (
              <div
                key={c.rid}
                style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: 12, display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card)',
                }}
              >
                <GitMerge style={{ width: 16, height: 16, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.display_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    rid：<code>{c.rid}</code>
                  </div>
                </div>
                <div style={{
                  flexShrink: 0, padding: '2px 8px', borderRadius: 4,
                  background: sim >= 80 ? 'var(--destructive)' : sim >= 60 ? 'var(--warning)' : 'var(--muted)',
                  color: sim >= 60 ? 'var(--primary-foreground, #fff)' : 'var(--foreground)',
                  fontSize: 11, fontWeight: 600,
                }}>
                  {sim}%
                </div>
                <button
                  type="button"
                  onClick={() => openMergeDrawerForCandidate(c)}
                  style={{
                    height: 30, padding: '0 12px', fontSize: 12,
                    background: 'var(--primary)', color: 'var(--primary-foreground, #fff)',
                    border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >
                  合并到它
                </button>
              </div>
            );
          })}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={cancelCandidateModal}
            style={{
              height: 34, padding: '0 14px', fontSize: 13,
              background: 'var(--card)', color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void continueCreateAnyway()}
            style={{
              height: 34, padding: '0 14px', fontSize: 13,
              background: 'var(--primary)', color: 'var(--primary-foreground, #fff)',
              border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
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
