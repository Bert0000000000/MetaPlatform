import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Hexagon, Search, Upload, Plus, User, FileText, Package,
  ScrollText, Building, Users, Truck, Warehouse, Receipt, Columns3,
  Link as LinkIcon, ArrowUpRight, ArrowDownLeft, ArrowRight, ArrowLeft,
  Database, Boxes, Zap, GitBranch,
} from 'lucide-react';
import { AIAssistantTrigger, AIAssistantWorkspace, SubTabs, FormDrawer, Field, TextInput, TextArea, Select, FormSection, usePageAssistant } from '@mate/shared';
import {
  listObjectTypes, getObjectType, listActionTypes, listLinkTypes,
  type KernelObjectType, type KernelActionType, type KernelLinkType,
  domainOfObjectType,
} from '@/api/ont/kernel';

const ONTOLOGY_TABS = [
  { label: '本体论管理', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

const DOMAIN_LABELS: Record<string, string> = {
  crm: '客户关系',
  scm: '供应链',
  fin: '财务核算',
  org: '组织人力',
  hr: '人力资源',
};

const CONCEPT_ICONS = [
  User, FileText, Package, ScrollText, Building, Users, Truck, Warehouse, Receipt, Boxes, Database, Zap,
];

const statusDotStyle = (status: string) => ({
  width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  background: status === 'connected' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--destructive)',
});

const typeBadgeClass = (type: string) =>
  type === 'ENUM' ? 'type-badge enum' : type === 'DATETIME' ? 'type-badge datetime' : 'type-badge';

// rid slug → 概念图标（稳定映射）
function conceptIcon(rid: string) {
  const idx = rid.length % CONCEPT_ICONS.length;
  return CONCEPT_ICONS[idx];
}

// 概念状态：有关联 LinkType → connected；有关联 ActionType → partial；否则 disconnected
function conceptStatus(ot: KernelObjectType, linkTypes: KernelLinkType[], actionTypes: KernelActionType[]) {
  const hasLink = linkTypes.some((lt) => lt.src === ot.rid || lt.dst === ot.rid);
  const hasAction = actionTypes.some((at) => at.on.includes(ot.rid));
  if (hasLink) return 'connected';
  if (hasAction) return 'partial';
  return 'disconnected';
}

export default function OntologyModelingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [objectTypes, setObjectTypes] = useState<KernelObjectType[]>([]);
  const [actionTypes, setActionTypes] = useState<KernelActionType[]>([]);
  const [linkTypes, setLinkTypes] = useState<KernelLinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ots, ats, lts] = await Promise.all([listObjectTypes(), listActionTypes(), listLinkTypes()]);
        if (!active) return;
        setObjectTypes(ots);
        setActionTypes(ats);
        setLinkTypes(lts);
        if (ots.length > 0) {
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
  }, []);

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
    if (typeFilter) {
      items = items.filter((ot) => {
        const types = ot.properties.map((p) => p.type_id);
        if (typeFilter === '实体') return ot.properties.length > 0;
        return true;
      });
    }
    if (statusFilter) {
      items = items.filter((ot) => conceptStatus(ot, linkTypes, actionTypes) === statusFilter);
    }
    return items;
  }, [currentDomainItems, keyword, typeFilter, statusFilter, linkTypes, actionTypes]);

  // 选中概念详情（属性表 + 关联 action）
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

  const assistant = usePageAssistant({
    employeeId: 'ontology-modeler',
    employeeName: '本体建模数字员工',
    employeeDescription: '协助设计概念、属性、关系并检查本体模型一致性。',
    moduleLabel: 'Ontology 建模',
    welcomeMessage: '你好，我是本体建模数字员工。可以协助你把业务语义整理为清晰的本体模型。',
    suggestions: ['当前本体有多少概念', '有哪些 Action 可以执行', '设计新的业务概念'],
    createReply: (content) => {
      // 基于真实 kernel 数据生成摘要回复（非 mock）
      const lines: string[] = [];
      lines.push(`当前租户下共有 **${objectTypes.length}** 个概念（ObjectType）、**${actionTypes.length}** 个 Action（ActionType）、**${linkTypes.length}** 条关系（LinkType）。`);
      if (domains.length > 0) {
        lines.push(`一级本体（按领域分组）：${domains.map((d) => `${d.label}(${d.items.length})`).join('、')}。`);
      }
      if (objectTypes.length > 0) {
        const sample = objectTypes.slice(0, 5).map((ot) => ot.display_name).join('、');
        lines.push(`当前概念示例：${sample}。`);
      }
      if (actionTypes.length > 0) {
        lines.push(`可用 Action：${actionTypes.map((at) => at.rid.split('.').pop()).join('、')}。`);
      }
      if (/搜索|查找|查询/.test(content)) {
        lines.push(`搜索「${content.replace(/搜索|查找|查询/g, '').trim() || '全部'}」后，可在上方概念卡片中查看匹配结果。`);
      }
      return lines.join('\n');
    },
  });

  // 点击概念卡 → 下钻（切换选中 + 可选跳转数据详情）
  const handleSelectConcept = (rid: string) => {
    setSelectedConcept(rid);
  };

  const stats = useMemo(() => {
    const totalProps = objectTypes.reduce((acc, ot) => acc + ot.properties.length, 0);
    const totalLinks = linkTypes.length;
    return { concepts: objectTypes.length, props: totalProps, links: totalLinks };
  }, [objectTypes, linkTypes]);

  return (
    <AIAssistantWorkspace assistant={assistant}>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <style>{`
        .om-tree-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--muted-foreground);margin-bottom:2px}
        .om-tree-item:hover{background:var(--muted);color:var(--foreground)}
        .om-tree-item.active{background:var(--muted);color:var(--foreground)}
        .om-tree-item svg{width:16px;height:16px;flex-shrink:0}
        .om-tree-item .count{margin-left:auto;font-size:11px;color:var(--muted-foreground);background:var(--background);padding:2px 6px;border-radius:4px}
        .om-concept-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px;cursor:pointer;transition:border-color .15s}
        .om-concept-card:hover{border-color:var(--muted-foreground)}
        .om-concept-card.selected{border-color:#60a5fa}
        .om-concept-icon{width:36px;height:36px;border-radius:6px;background:var(--muted);display:flex;align-items:center;justify-content:center;margin-bottom:12px}
        .om-concept-icon svg{width:18px;height:18px;color:var(--muted-foreground)}
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

      <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>本体论管理</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>统一语义建模与推理引擎</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
          <button className="v-btn"><Upload style={{ width: 16, height: 16 }} />导入</button>
          <button className="v-btn-primary" onClick={() => setDrawerOpen(true)}><Plus style={{ width: 16, height: 16 }} />新建本体</button>
        </div>
      </div>

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
          <div className="v-card" style={{ height: 'fit-content' }}>
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
          </div>
        </div>

        {/* Right: Concept Panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search & Filter bar（真实过滤） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="搜索概念名称、描述..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 13, color: 'var(--foreground)', outline: 'none', cursor: 'pointer', minWidth: 120 }}
            >
              <option value="">全部类型</option>
              <option value="实体">实体</option>
              <option value="事件">事件</option>
              <option value="值对象">值对象</option>
              <option value="枚举">枚举</option>
            </select>
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
                  {st === 'connected' ? '已接入' : st === 'partial' ? '部分接入' : '未接入'}
                </button>
              ))}
            </div>
          </div>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>
              {DOMAIN_LABELS[selectedDomain] ?? (selectedDomain || '全部')} - 概念
            </h3>
            <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Plus style={{ width: 14, height: 14 }} />添加概念</button>
          </div>

          {/* Concept Grid */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载概念中…</div>
          ) : filteredConcepts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>当前一级本体下没有匹配的概念</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {filteredConcepts.map((ot) => {
                const Icon = conceptIcon(ot.rid);
                const st = conceptStatus(ot, linkTypes, actionTypes);
                return (
                  <div
                    key={ot.rid}
                    className={`om-concept-card ${ot.rid === selectedConcept ? 'selected' : ''}`}
                    onClick={() => handleSelectConcept(ot.rid)}
                  >
                    <div className="om-concept-icon"><Icon /></div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{ot.display_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
                      {ot.rid.split('.').pop()}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Columns3 style={{ width: 14, height: 14 }} />{ot.properties.length} 属性
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LinkIcon style={{ width: 14, height: 14 }} />
                        {linkTypes.filter((lt) => lt.src === ot.rid || lt.dst === ot.rid).length} 关系
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={statusDotStyle(st)} /> {st === 'connected' ? '已接入' : st === 'partial' ? '部分接入' : '未接入'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Detail Section（下钻：属性表 + 关联 Action + 关系） */}
          {selectedConceptDetail && (
            <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
              {/* Attribute Table */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{selectedConceptDetail.display_name} - 属性定义</h4>
                    <span className="v-eyebrow">{selectedConceptDetail.properties.length} 个属性</span>
                  </div>
                  <table className="om-attr-table">
                    <thead>
                      <tr>
                        <th>属性名</th>
                        <th>类型</th>
                        <th>必填</th>
                        <th>主键</th>
                        <th>描述</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedConceptDetail.properties.map((attr) => (
                        <tr key={attr.rid}>
                          <td style={{ fontWeight: 500 }}>{attr.rid.split('.').pop()}</td>
                          <td><span className={typeBadgeClass(attr.type_id)}>{attr.type_id}</span></td>
                          <td><span style={{ color: attr.nullable ? 'var(--muted-foreground)' : 'var(--success)', fontSize: 12 }}>{attr.nullable ? '否' : '是'}</span></td>
                          <td><span style={{ color: attr.primary_key ? 'var(--success)' : 'var(--muted-foreground)', fontSize: 12 }}>{attr.primary_key ? '是' : '否'}</span></td>
                          <td style={{ color: 'var(--muted-foreground)' }}>{attr.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 关联 Action */}
                {selectedActions.length > 0 && (
                  <div className="v-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600 }}>关联 Action</h4>
                      <span className="v-eyebrow">{selectedActions.length} 个</span>
                    </div>
                    <div style={{ padding: '12px 20px' }}>
                      {selectedActions.map((at) => (
                        <div key={at.rid} className="om-relation-item">
                          <div className="om-relation-icon"><Zap style={{ width: 14, height: 14 }} /></div>
                          <span className="om-relation-label">{at.rid.split('.').slice(0, -2).pop()}</span>
                          <ArrowRight style={{ color: 'var(--muted-foreground)', fontSize: 12, flexShrink: 0, width: 14, height: 14 }} />
                          <span className="om-relation-target">side_effects: {at.side_effects.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Relation Panel */}
              <div style={{ width: 300, flexShrink: 0 }}>
                <div className="v-card" style={{ padding: 0, overflow: 'hidden', height: 'fit-content' }}>
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
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title="新建本体"
        onCancel={() => setDrawerOpen(false)}
        onOk={() => setDrawerOpen(false)}
      >
        <FormSection title="基本信息" desc="本体的基础属性">
          <Field label="本体名称" required>
            <TextInput placeholder="请输入本体名称" />
          </Field>
          <Field label="本体编码">
            <TextInput placeholder="请输入本体编码，如 ont-customer" />
          </Field>
          <Field label="所属领域">
            <Select defaultValue="企业核心">
              <option value="企业核心">企业核心</option>
              <option value="产品领域">产品领域</option>
              <option value="客户关系">客户关系</option>
              <option value="供应链">供应链</option>
              <option value="财务核算">财务核算</option>
              <option value="人力资源">人力资源</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea placeholder="请输入本体描述" rows={4} />
          </Field>
        </FormSection>

        <FormSection title="配置" desc="本体的版本与可见性配置">
          <Field label="版本">
            <TextInput defaultValue="v1.0" placeholder="如 v1.0" />
          </Field>
          <Field label="可见范围">
            <Select defaultValue="全公司">
              <option value="全公司">全公司</option>
              <option value="指定组织">指定组织</option>
              <option value="私有">私有</option>
            </Select>
          </Field>
          <Field label="负责人">
            <TextInput placeholder="请输入负责人姓名或账号" />
          </Field>
        </FormSection>
      </FormDrawer>
      </div>
    </div>
    </AIAssistantWorkspace>
  );
}
