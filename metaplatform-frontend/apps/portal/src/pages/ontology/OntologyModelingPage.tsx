import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Hexagon, Search, Upload, Plus, ChevronDown, User, FileText, Package,
  ScrollText, Building, Users, Truck, Warehouse, Receipt, Columns3,
  Link as LinkIcon, ArrowUpRight, ArrowDownLeft, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, Select, FormSection } from '@mate/shared';
import { MOCK_ONTOLOGY_ENTITIES } from '@/mock'; // MOCK

const ONTOLOGY_TABS = [
  { label: '本体论管理', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

// MOCK: 本体列表
const ONTOLOGY_LIST = [
  { id: 'ont-001', name: '企业核心本体', count: 6 },
  { id: 'ont-002', name: '产品领域本体', count: 4 },
  { id: 'ont-003', name: '客户关系本体', count: 5 },
  { id: 'ont-004', name: '供应链本体', count: 3 },
  { id: 'ont-005', name: '财务核算本体', count: 7 },
  { id: 'ont-006', name: '人力资源本体', count: 4 },
];

// MOCK: 概念列表
const CONCEPTS = [
  { id: 'c1', name: '客户', desc: '企业外部客户实体，包含基本信息与资质属性', attrs: 8, rels: 6, status: 'connected', icon: User, selected: true },
  { id: 'c2', name: '订单', desc: '客户交易订单记录，关联产品与合同信息', attrs: 15, rels: 3, status: 'connected', icon: FileText },
  { id: 'c3', name: '产品', desc: '企业产品或服务目录，含分类与规格', attrs: 18, rels: 5, status: 'connected', icon: Package },
  { id: 'c4', name: '合同', desc: '客户签署的业务合同，关联订单与产品', attrs: 20, rels: 4, status: 'partial', icon: ScrollText },
  { id: 'c5', name: '组织', desc: '企业内部组织架构，含部门与层级关系', attrs: 8, rels: 2, status: 'connected', icon: Building },
  { id: 'c6', name: '人员', desc: '企业员工与外部联系人，关联组织与角色', attrs: 14, rels: 3, status: 'connected', icon: Users },
  { id: 'c7', name: '供应商', desc: '外部供应商实体，含资质与供货能力', attrs: 11, rels: 2, status: 'partial', icon: Truck },
  { id: 'c8', name: '仓库', desc: '仓储设施实体，关联库存与物流信息', attrs: 9, rels: 3, status: 'disconnected', icon: Warehouse },
  { id: 'c9', name: '发票', desc: '财务发票实体，关联订单与合同收款', attrs: 13, rels: 3, status: 'partial', icon: Receipt },
];

// MOCK: 客户属性定义
const ATTRIBUTES = [
  { name: 'customer_code', type: 'STRING', required: true, default: '-', desc: '唯一标识' },
  { name: 'customer_name', type: 'STRING', required: true, default: '-', desc: '客户全称' },
  { name: 'industry', type: 'ENUM', required: false, default: '其他', desc: '所属行业' },
  { name: 'region', type: 'STRING', required: false, default: '-', desc: '所在地区' },
  { name: 'credit_level', type: 'ENUM', required: false, default: 'C', desc: '信用等级 (A/B/C/D)' },
  { name: 'contact_person', type: 'STRING', required: false, default: '-', desc: '主要联系人' },
  { name: 'contact_phone', type: 'STRING', required: false, default: '-', desc: '联系电话' },
  { name: 'created_at', type: 'DATETIME', required: true, default: 'NOW()', desc: '创建时间' },
];

// MOCK: 客户关系定义
const OUTGOING_RELATIONS = [
  { label: '下单', target: '订单', icon: FileText },
  { label: '签署', target: '合同', icon: ScrollText },
  { label: '所属', target: '组织', icon: Building },
  { label: '采购', target: '供应商', icon: Truck },
];
const INCOMING_RELATIONS = [
  { label: '服务', target: '人员', icon: Users },
  { label: '配送', target: '仓库', icon: Warehouse },
];

const statusDotStyle = (status: string) => ({
  width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  background: status === 'connected' ? 'var(--success)' : status === 'partial' ? 'var(--warning)' : 'var(--destructive)',
});

const typeBadgeClass = (type: string) =>
  type === 'ENUM' ? 'type-badge enum' : type === 'DATETIME' ? 'type-badge datetime' : 'type-badge';

export default function OntologyModelingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedOntology, setSelectedOntology] = useState(0);
  const [selectedConcept, setSelectedConcept] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
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

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>本体论管理</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>统一语义建模与推理引擎</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(98,209,120,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>AI</div>
            <span style={{ fontSize: 13 }}>AI 助手</span>
            <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          </button>
          <button className="v-btn"><Upload style={{ width: 16, height: 16 }} />导入</button>
          <button className="v-btn-primary" onClick={() => setDrawerOpen(true)}><Plus style={{ width: 16, height: 16 }} />新建本体</button>
        </div>
      </div>

      {/* Stats */}
      <div className="om-stats-row">
        <div className="om-stat-card">
          <div className="om-stat-value">29</div>
          <div className="om-stat-label">概念总数</div>
        </div>
        <div className="om-stat-card">
          <div className="om-stat-value">312</div>
          <div className="om-stat-label">属性总数</div>
        </div>
        <div className="om-stat-card">
          <div className="om-stat-value">87</div>
          <div className="om-stat-label">关系总数</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left: Tree Panel */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div className="v-card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>本体列表</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ONTOLOGY_LIST.map((ont, i) => (
                <li
                  key={ont.id}
                  className={`om-tree-item ${i === selectedOntology ? 'active' : ''}`}
                  onClick={() => setSelectedOntology(i)}
                >
                  <Hexagon />
                  {ont.name}
                  <span className="count">{ont.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Concept Panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search & Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="搜索概念名称、描述..."
                style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <select style={{ height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 13, color: 'var(--foreground)', outline: 'none', cursor: 'pointer', minWidth: 120 }}>
              <option>全部类型</option>
              <option>实体</option>
              <option>事件</option>
              <option>值对象</option>
              <option>枚举</option>
            </select>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <button style={{ height: 34, padding: '0 12px', fontSize: 12, color: 'var(--foreground)', background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={statusDotStyle('connected')} />已接入
              </button>
              <button style={{ height: 34, padding: '0 12px', fontSize: 12, color: 'var(--muted-foreground)', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={statusDotStyle('partial')} />部分接入
              </button>
              <button style={{ height: 34, padding: '0 12px', fontSize: 12, color: 'var(--muted-foreground)', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={statusDotStyle('disconnected')} />未接入
              </button>
            </div>
          </div>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>{ONTOLOGY_LIST[selectedOntology].name} - 概念</h3>
            <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Plus style={{ width: 14, height: 14 }} />添加概念</button>
          </div>

          {/* Concept Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {CONCEPTS.map((c, i) => (
              <div
                key={c.id}
                className={`om-concept-card ${i === selectedConcept ? 'selected' : ''}`}
                onClick={() => setSelectedConcept(i)}
              >
                <div className="om-concept-icon"><c.icon /></div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>{c.desc}</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Columns3 style={{ width: 14, height: 14 }} />{c.attrs} 属性
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <LinkIcon style={{ width: 14, height: 14 }} />{c.rels} 关系
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={statusDotStyle(c.status)} /> {c.status === 'connected' ? '已接入' : c.status === 'partial' ? '部分接入' : '未接入'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Section */}
          <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
            {/* Attribute Table */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600 }}>{CONCEPTS[selectedConcept].name} - 属性定义</h4>
                  <span className="v-eyebrow">{ATTRIBUTES.length} 个属性</span>
                </div>
                <table className="om-attr-table">
                  <thead>
                    <tr>
                      <th>属性名</th>
                      <th>类型</th>
                      <th>必填</th>
                      <th>默认值</th>
                      <th>描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ATTRIBUTES.map((attr) => (
                      <tr key={attr.name}>
                        <td style={{ fontWeight: 500 }}>{attr.name}</td>
                        <td><span className={typeBadgeClass(attr.type)}>{attr.type}</span></td>
                        <td><span style={{ color: attr.required ? 'var(--success)' : 'var(--muted-foreground)', fontSize: 12 }}>{attr.required ? '是' : '否'}</span></td>
                        <td><span style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{attr.default}</span></td>
                        <td style={{ color: 'var(--muted-foreground)' }}>{attr.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Relation Panel */}
            <div style={{ width: 300, flexShrink: 0 }}>
              <div className="v-card" style={{ padding: 0, overflow: 'hidden', height: 'fit-content' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600 }}>{CONCEPTS[selectedConcept].name} - 关系定义</h4>
                  <span className="v-eyebrow">6 个关系</span>
                </div>
                {/* Outgoing */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowUpRight style={{ width: 14, height: 14 }} />出向关系 (4)
                  </div>
                  {OUTGOING_RELATIONS.map((r) => (
                    <div key={r.label} className="om-relation-item">
                      <div className="om-relation-icon"><r.icon /></div>
                      <span className="om-relation-label">{r.label}</span>
                      <ArrowRight style={{ color: 'var(--muted-foreground)', fontSize: 12, flexShrink: 0, width: 14, height: 14 }} />
                      <span className="om-relation-target">{r.target}</span>
                    </div>
                  ))}
                </div>
                {/* Incoming */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowDownLeft style={{ width: 14, height: 14 }} />入向关系 (2)
                  </div>
                  {INCOMING_RELATIONS.map((r) => (
                    <div key={r.label} className="om-relation-item">
                      <div className="om-relation-icon"><r.icon /></div>
                      <span className="om-relation-label">{r.label}</span>
                      <ArrowLeft style={{ color: 'var(--muted-foreground)', fontSize: 12, flexShrink: 0, width: 14, height: 14 }} />
                      <span className="om-relation-target">{r.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOCK: 引用本体实体数据 */}
      <span style={{ display: 'none' }}>{MOCK_ONTOLOGY_ENTITIES.length}</span>

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
  );
}
