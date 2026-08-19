import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Modal } from '@douyinfe/semi-ui';
import { useLocation } from 'react-router-dom';
import {
  Hexagon, Search, Plus, Columns3,
  Link as LinkIcon, ArrowRight, Zap, GitBranch, GitMerge, AlertTriangle,
} from 'lucide-react';
import { FormDrawer, Field, TextInput } from '@mate/shared';
import {
  listObjectTypes, listActionTypes, listLinkTypes,
  createObjectType, appendObjectTypeProperty,
  getObjectType,
  precheckObjectTypes, mergeObjectTypes,
  domainOfObjectType, slugAndVersionOfObjectType, slugAndVersionOfProperty,
  type KernelObjectType, type KernelActionType, type KernelLinkType,
  type ObjectTypeCandidate,
} from '@/api/ont/kernel';
import { getTenantId } from '@/utils/auth';
import { actionDisplayName } from './actions/ActionTypeListPage';
import OntologyMergeDrawer from './components/OntologyMergeDrawer';


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
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // 新增属性表单
  const [addOpen, setAddOpen] = useState(false);
  const [propName, setPropName] = useState('');
  const [propType, setPropType] = useState('STRING');
  const [propTitle, setPropTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 新建概念抽屉（开关由 Shell 拥有，按钮在 sticky Tab 行右侧）
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDomain, setCreateDomain] = useState('crm');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // 相似候选扫描（precheck onBlur） + 合并 drawer
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
    const [ots, ats, lts] = await Promise.all([listObjectTypes(), listActionTypes(), listLinkTypes()]);
    setObjectTypes(ots);
    setActionTypes(ats);
    setLinkTypes(lts);
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

  // 新增属性 → append → 重拉刷新
  const submitAddProperty = async () => {
    if (!selectedConceptDetail || !propName.trim()) return;
    setSubmitting(true);
    try {
      const tenant = getTenantId() || 'demo';
      // 合法属性 rid：ClassRef 正则要求 ont.<tenant>.prop.<slug>.<ver>，
      // 由概念 rid 的 obj 段替换为 prop 段并追加属性名
      const conceptSlug = slugAndVersionOfObjectType(selectedConceptDetail.rid).slug.replace(/\.v\d+$/, '');
      const propRid = `ont.${tenant}.prop.${conceptSlug.replace(/^obj\./, '')}-${propName.trim()}.v1`;
      await appendObjectTypeProperty(selectedConceptDetail.rid, {
        rid: propRid,
        type_id: propType,
        nullable: true,
        primary_key: false,
        title: propTitle.trim() || propName.trim(),
        format: 'string',
      });
      await refreshAll();
      setAddOpen(false);
      setPropName('');
      setPropTitle('');
    } catch (e) {
      console.warn('新增 property 失败', e);
    } finally {
      setSubmitting(false);
    }
  };

  // 新建概念 → POST /object-types → 选中新概念
  const submitCreate = async () => {
    const name = createName.trim();
    const slug = createSlug.trim();
    if (!name || !slug) return;
    setCreateSubmitting(true);
    const tenant = getTenantId() || 'demo';
    const rid = `ont.${tenant}.obj.${createDomain}.${slug}.v1`;
    // 新概念自动带一个主键属性（概念必有主键）；kind 段用 'prop'（ClassRef 正则只认 prop）
    const pkRid = `ont.${tenant}.prop.${slug}-id.v1`;
    try {
      await createObjectType({
        rid,
        display_name: name,
        primary_key: [pkRid],
        properties: [{
          rid: pkRid,
          type_id: 'string',
          nullable: false,
          primary_key: true,
          title: `${name} ID`,
          format: 'string',
        }],
        interfaces: [],
      });
      setCreateOpen(false);
      setCreateName('');
      setCreateSlug('');
      const ots = await refreshAll();
      setSelectedDomain(createDomain);
      if (ots.some((ot) => ot.rid === rid)) setSelectedConcept(rid);
    } catch (e) {
      console.warn('新建概念失败', e);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // 概念名称 onBlur → 调 precheck；命中候选 → 弹 Modal 让用户选 merge / 继续创建 / 取消
  const handlePrecheck = async () => {
    const name = createName.trim();
    const slug = createSlug.trim();
    if (!name) return;
    // slug 暂未填也允许按 name 扫（后端兜底走 embedder）；只在两者都空时跳过
    setPrecheckLoading(true);
    try {
      const resp = await precheckObjectTypes({ name, slug: slug || name, domain: createDomain, top_k: 5 });
      const list = resp?.candidates ?? [];
      if (list.length > 0) {
        setCandidates(list);
        setPrecheckSource({ name, slug, domain: createDomain });
        setCandidateModalOpen(true);
      }
    } catch (e) {
      // precheck 失败不阻塞创建流程（best-effort）
      console.warn('precheck 失败', e);
    } finally {
      setPrecheckLoading(false);
    }
  };

  // 用户在候选 Modal 里选了某个候选 → 打开合并 drawer（先 resolve source / target 完整定义）
  const openMergeDrawerForCandidate = async (candidate: ObjectTypeCandidate) => {
    if (!precheckSource) return;
    setCandidateModalOpen(false);
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
      // 候选 Modal 也关掉、create drawer 关掉、清空已输入字段
      setCandidateModalOpen(false);
      setCandidates([]);
      setCreateOpen(false);
      setCreateName('');
      setCreateSlug('');
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

          {/* Detail Section（下钻：属性表 + 新增属性 + 关联 Action + 关系） */}
          {selectedConceptDetail && (
            <div ref={detailRef} style={{ display: 'flex', gap: 20, marginTop: 20, scrollMarginTop: 12 }}>
              {/* Attribute Table + Add-property form + 关联 Action */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Card style={{overflow: 'hidden'}} bodyStyle={{padding: 0}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{selectedConceptDetail.display_name} · 属性定义</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="v-eyebrow">{selectedConceptDetail.properties.length} 个属性</span>
                      <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setAddOpen((v) => !v)}>
                        <Plus style={{ width: 14, height: 14 }} />新增属性
                      </Button>
                    </div>
                  </div>
                  {addOpen && (
                    <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>属性名</div>
                          <input
                            value={propName}
                            onChange={(e) => setPropName(e.target.value)}
                            placeholder="例如 dept_name"
                            style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none', width: 160 }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>类型</div>
                          <select
                            value={propType}
                            onChange={(e) => setPropType(e.target.value)}
                            style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none' }}
                          >
                            <option value="STRING">STRING</option>
                            <option value="INTEGER">INTEGER</option>
                            <option value="DECIMAL">DECIMAL</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                            <option value="DATETIME">DATETIME</option>
                            <option value="ENUM">ENUM</option>
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>描述</div>
                          <input
                            value={propTitle}
                            onChange={(e) => setPropTitle(e.target.value)}
                            placeholder="可选"
                            style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none', width: 200 }}
                          />
                        </div>
                        <Button theme="solid" type="primary" disabled={submitting || !propName.trim()}
                          onClick={submitAddProperty}
                          style={{ height: 30, padding: '0 14px', fontSize: 12, opacity: submitting || !propName.trim() ? 0.6 : 1 }}>
                          {submitting ? '提交中…' : '保存'}
                        </Button>
                        <Button theme="light" type="secondary" onClick={() => setAddOpen(false)}
                          style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}
                  <table className="om-attr-table">
                    <thead>
                      <tr>
                        <th>属性名</th>
                        <th>版本</th>
                        <th>类型</th>
                        <th>必填</th>
                        <th>主键</th>
                        <th>描述</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedConceptDetail.properties.map((attr) => {
                        const { slug, version } = slugAndVersionOfProperty(attr.rid);
                        // 砍掉 kind 段（prop / prp）—— 后端用 'prop'，统一兼容
                        const propSlug = slug.replace(/^(prop|prp)\./, '');
                        return (
                          <tr key={attr.rid}>
                            <td style={{ fontWeight: 500 }}>{propSlug}</td>
                            <td style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{version || '—'}</td>
                            <td><span className={typeBadgeClass(attr.type_id)}>{attr.type_id}</span></td>
                            <td><span style={{ color: attr.nullable ? 'var(--muted-foreground)' : 'var(--success)', fontSize: 12 }}>{attr.nullable ? '否' : '是'}</span></td>
                            <td><span style={{ color: attr.primary_key ? 'var(--success)' : 'var(--muted-foreground)', fontSize: 12 }}>{attr.primary_key ? '是' : '否'}</span></td>
                            <td style={{ color: 'var(--muted-foreground)' }}>{attr.title}</td>
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

      <FormDrawer
        open={createOpen}
        title="新建概念（ObjectType）"
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText="创建"
        confirmLoading={createSubmitting}
      >
        <Field label="概念名称" required>
          <div style={{ position: 'relative' }}>
            <TextInput
              placeholder="例如：客户"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onBlur={handlePrecheck}
            />
            {precheckLoading && (
              <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: 'var(--muted-foreground)',
              }}>
                相似扫描中…
              </span>
            )}
          </div>
        </Field>
        <Field label="slug（rid 末段）" required>
          <TextInput
            placeholder="例如：customer"
            value={createSlug}
            onChange={(e) => setCreateSlug(e.target.value)}
          />
        </Field>
        <Field label="领域">
          <select
            value={createDomain}
            onChange={(e) => setCreateDomain(e.target.value)}
            style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
          >
            {Object.entries(DOMAIN_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </Field>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
          生成 rid：<code>ont.{getTenantId() || 'demo'}.obj.{createDomain}.{createSlug.trim() || '<slug>'}.v1</code>
          <br />自动创建主键属性：<code>ont.{getTenantId() || 'demo'}.prop.{createSlug.trim() || '<slug>'}-id.v1</code>
        </div>
      </FormDrawer>

      {/* 相似候选 Modal：precheck 命中后展示，每个候选可三选一 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ width: 16, height: 16, color: 'var(--warning)' }} />
            <span>检测到相似概念</span>
          </div>
        }
        visible={candidateModalOpen}
        onCancel={() => setCandidateModalOpen(false)}
        footer={null}
        width={640}
      >
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12, lineHeight: 1.6 }}>
          概念名「<strong style={{ color: 'var(--foreground)' }}>{precheckSource?.name}</strong>」与下方已有概念相似，
          请选择「合并到它」（走合并 drawer，迁移数据后软删源）或「继续新建」（忽略提示，直接创建新概念）。
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
            onClick={() => setCandidateModalOpen(false)}
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
            onClick={() => {
              setCandidateModalOpen(false);
              // 走原本 submitCreate（继续新建）
              submitCreate();
            }}
            style={{
              height: 34, padding: '0 14px', fontSize: 13,
              background: 'var(--primary)', color: 'var(--primary-foreground, #fff)',
              border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >
            继续新建
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
