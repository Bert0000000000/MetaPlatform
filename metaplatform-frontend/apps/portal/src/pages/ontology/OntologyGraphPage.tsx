import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Upload, Download, Settings2, CircleDot, GitBranch, Boxes, Database,
  TrendingUp, Minus, ZoomIn, ZoomOut, Maximize, Image as ImageIcon,
  LayoutGrid, AlignHorizontalJustifyCenter, Filter, Search, X,
  User, FileText, Package, FileSignature, Building2, Users, Warehouse,
  Truck, List, ArrowRight, Link as LinkIcon,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';
import { MOCK_ONTOLOGY_ENTITIES } from '@/mock'; // MOCK

const ONTOLOGY_TABS = [
  { label: '本体论管理', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

// MOCK: 图谱节点
const GRAPH_NODES = [
  { id: 'n1', label: '客户', type: 'G2 · Concept', icon: User, nodeClass: 'node-concept', selected: true, left: 65, top: 60 },
  { id: 'n2', label: '订单', type: 'G2 · Concept', icon: FileText, nodeClass: 'node-concept', left: 265, top: 60 },
  { id: 'n3', label: '产品', type: 'G1 · Concept', icon: Package, nodeClass: 'node-concept', left: 465, top: 60 },
  { id: 'n4', label: '合同', type: 'G2 · Concept', icon: FileSignature, nodeClass: 'node-concept', left: 265, top: 240 },
  { id: 'n5', label: '组织', type: 'G1 · Concept', icon: Building2, nodeClass: 'node-g2', left: 65, top: 240 },
  { id: 'n6', label: '人员', type: 'G4 · Concept', icon: Users, nodeClass: 'node-g3', left: 65, top: 420 },
  { id: 'n7', label: '仓库', type: 'G4 · Concept', icon: Warehouse, nodeClass: 'node-g4', left: 465, top: 240 },
  { id: 'n8', label: '供应商', type: 'G1 · Concept', icon: Truck, nodeClass: 'node-g1', left: 465, top: 420 },
];

// MOCK: 边标签
const EDGE_LABELS = [
  { label: '下单', left: 205, top: 78 },
  { label: '签署', left: 195, top: 168 },
  { label: '所属', left: 126, top: 172 },
  { label: '联系人', left: 136, top: 264 },
  { label: '包含', left: 405, top: 78 },
  { label: '配送', left: 400, top: 168 },
  { label: '关联', left: 425, top: 168 },
  { label: '包含', left: 146, top: 352 },
  { label: '采购', left: 310, top: 260 },
  { label: '供货', left: 506, top: 260 },
  { label: '入库', left: 526, top: 352 },
  { label: '依据', left: 342, top: 172 },
];

// MOCK: SVG 边
const EDGES = [
  { x1: 175, y1: 95, x2: 265, y2: 95, px: '265,91 273,95 265,99' },
  { x1: 150, y1: 120, x2: 290, y2: 244, px: '287,250 294,244 290,238' },
  { x1: 120, y1: 120, x2: 120, y2: 244, px: '116,244 120,252 124,244' },
  { x1: 130, y1: 120, x2: 130, y2: 424, px: '126,424 130,432 134,424' },
  { x1: 375, y1: 95, x2: 465, y2: 95, px: '465,91 473,95 465,99' },
  { x1: 350, y1: 120, x2: 490, y2: 244, px: '487,250 494,244 490,238' },
  { x1: 375, y1: 244, x2: 490, y2: 120, px: '494,116 490,124 486,116' },
  { x1: 140, y1: 300, x2: 140, y2: 424, px: '136,424 140,432 144,424' },
  { x1: 175, y1: 108, x2: 465, y2: 440, px: '461,444 469,440 465,436' },
  { x1: 520, y1: 120, x2: 520, y2: 424, px: '516,424 520,432 524,424' },
  { x1: 540, y1: 300, x2: 540, y2: 424, px: '536,424 540,432 544,424' },
  { x1: 345, y1: 120, x2: 340, y2: 244, px: '336,244 340,252 344,244' },
];

// MOCK: 筛选 - 类型
const TYPE_FILTERS = [
  { label: 'Concept', count: 5, checked: true },
  { label: 'G1 - 业务对象', count: 8, checked: true },
  { label: 'G2 - 业务事件', count: 15, checked: true },
  { label: 'G3 - 业务规则', count: 6, checked: true },
  { label: 'G4 - 数据实体', count: 23, checked: true },
];

// MOCK: 筛选 - 数据源
const SOURCE_FILTERS = [
  { label: 'PostgreSQL', count: 42, checked: true },
  { label: 'Neo4j', count: 18, checked: true },
  { label: 'Milvus', count: 15, checked: true },
  { label: 'API', count: 14, checked: true },
];

// MOCK: 属性列表
const PROPERTIES = [
  { label: '名称', value: '华为技术有限公司' },
  { label: '客户编码', value: 'CUS-2024-00128', mono: true },
  { label: '行业', value: '信息传输、软件和信息技术服务业' },
  { label: '地区', value: '广东省 · 深圳市' },
  { label: '客户级别', value: '战略客户', badge: true },
  { label: '创建时间', value: '2024-01-15 09:23:00', mono: true },
  { label: '更新时间', value: '2026-07-20 14:05:32', mono: true },
  { label: '状态', value: '活跃', statusDot: true },
  { label: '实体数量', value: '1,247' },
  { label: '数据源', value: 'PostgreSQL / Neo4j / Milvus' },
];

// MOCK: 关联关系
const RELATIONS = [
  { name: '下单', target: '订单', icon: FileText, type: '1:N' },
  { name: '签署', target: '合同', icon: FileSignature, type: '1:N' },
  { name: '所属', target: '组织', icon: Building2, type: 'N:1' },
  { name: '联系人', target: '人员', icon: Users, type: '1:N' },
  { name: '采购', target: '供应商', icon: Truck, type: 'N:M' },
  { name: '配送', target: '仓库', icon: Warehouse, type: 'N:M' },
];

const nodeIconColor = (nodeClass: string) => {
  switch (nodeClass) {
    case 'node-g1': return 'var(--success)';
    case 'node-g2': return '#60a5fa';
    case 'node-g3': return 'var(--warning)';
    case 'node-g4': return '#c084fc';
    default: return 'var(--foreground)';
  }
};

export default function OntologyGraphPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedNode, setSelectedNode] = useState('n1');

  return (
    <div>
      <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>知识图谱</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>基于本体引擎的可视化知识关系网络，支持多数据源实体关系探索</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn"><Upload style={{ width: 16, height: 16 }} />导入</button>
          <button className="v-btn"><Download style={{ width: 16, height: 16 }} />导出</button>
          <button className="v-btn"><Settings2 style={{ width: 16, height: 16 }} />配置</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><CircleDot style={{ width: 14, height: 14 }} /> 实体总数</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>1,247</div>
          <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp style={{ width: 12, height: 12 }} /> +32 本周新增</div>
        </div>
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><GitBranch style={{ width: 14, height: 14 }} /> 关系总数</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>3,892</div>
          <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp style={{ width: 12, height: 12 }} /> +128 本周新增</div>
        </div>
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><Boxes style={{ width: 14, height: 14 }} /> 本体模型</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>12</div>
          <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp style={{ width: 12, height: 12 }} /> +1 本月新增</div>
        </div>
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><Database style={{ width: 14, height: 14 }} /> 数据源映射</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>89</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}><Minus style={{ width: 12, height: 12 }} /> 持平</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><ZoomIn style={{ width: 14, height: 14 }} /></button>
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><ZoomOut style={{ width: 14, height: 14 }} /></button>
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><Maximize style={{ width: 14, height: 14 }} /></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><Download style={{ width: 14, height: 14 }} /></button>
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><ImageIcon style={{ width: 14, height: 14 }} /></button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><LayoutGrid style={{ width: 14, height: 14 }} />力导向</button>
        <button className="v-btn" style={{ height: 32, padding: '0 10px' }}><AlignHorizontalJustifyCenter style={{ width: 14, height: 14 }} />层级</button>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--foreground)', display: 'inline-block' }} /> 8 节点</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-foreground)', display: 'inline-block' }} /> 12 关系</span>
        </div>
      </div>

      {/* 3-Column Graph Layout */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {/* LEFT: Filter Panel */}
        <div style={{ width: 220, flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 620, overflowY: 'auto' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Filter style={{ width: 14, height: 14 }} /> 节点筛选</h3>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="搜索节点名称..."
              style={{ width: '100%', height: 32, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 28px 0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none' }}
            />
            <Search style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--muted-foreground)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>按类型</div>
            {TYPE_FILTERS.map((f) => (
              <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--foreground)', cursor: 'pointer', padding: '3px 0' }}>
                <input type="checkbox" defaultChecked={f.checked} style={{ width: 14, height: 14, accentColor: 'var(--foreground)', cursor: 'pointer' }} />
                {f.label}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 10 }}>{f.count}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>按数据源</div>
            {SOURCE_FILTERS.map((f) => (
              <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--foreground)', cursor: 'pointer', padding: '3px 0' }}>
                <input type="checkbox" defaultChecked={f.checked} style={{ width: 14, height: 14, accentColor: 'var(--foreground)', cursor: 'pointer' }} />
                {f.label}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 10 }}>{f.count}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>已选标签</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['客户', '订单'].map((tag) => (
                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                  {tag} <X style={{ width: 10, height: 10 }} />
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
            <button className="v-btn" style={{ flex: 1, height: 28, fontSize: 11, padding: '0 8px', justifyContent: 'center' }}>重置</button>
            <button className="v-btn" style={{ flex: 1, height: 28, fontSize: 11, padding: '0 8px', justifyContent: 'center', background: 'var(--foreground)', color: 'var(--background)', borderColor: 'var(--foreground)' }}>应用</button>
          </div>
        </div>

        {/* CENTER: Graph Canvas */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 560, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {/* SVG Edge Layer */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} viewBox="0 0 800 560" preserveAspectRatio="xMidYMid meet">
              {EDGES.map((e, i) => (
                <g key={i}>
                  <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#555" strokeWidth={1} strokeDasharray="4 4" />
                  <polygon points={e.px} fill="#555" />
                </g>
              ))}
            </svg>
            {/* Edge Labels */}
            {EDGE_LABELS.map((el, i) => (
              <div key={i} style={{ position: 'absolute', fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--card)', padding: '1px 6px', borderRadius: 4, zIndex: 3, pointerEvents: 'none', whiteSpace: 'nowrap', left: el.left, top: el.top }}>{el.label}</div>
            ))}
            {/* Nodes */}
            {GRAPH_NODES.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                style={{
                  position: 'absolute', width: 110, padding: '10px 14px', background: selectedNode === node.id ? 'var(--accent)' : 'var(--muted)',
                  border: `1px solid ${selectedNode === node.id ? 'var(--foreground)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', textAlign: 'center', cursor: 'pointer', zIndex: 2,
                  transition: 'border-color .15s, background .15s', left: node.left, top: node.top,
                }}
              >
                <div style={{ width: 20, height: 20, margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <node.icon style={{ width: 18, height: 18, color: nodeIconColor(node.nodeClass) }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{node.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{node.type}</div>
              </div>
            ))}
          </div>
          {/* Bottom Stats Bar */}
          <div style={{ display: 'flex', gap: 16, padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--foreground)' }} /> 总节点 <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>8</span></div>
            <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-foreground)' }} /> 总关系 <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>12</span></div>
            <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>平均度 <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>3.0</span></div>
            <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>连通分量 <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>1</span></div>
            <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> 数据源 <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>4</span></div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>布局: 力导向 · 渲染: 16ms</div>
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div style={{ width: 320, flexShrink: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 620, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><User style={{ width: 18, height: 18 }} /> 客户</h3>
            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent', color: 'var(--muted-foreground)' }}><X style={{ width: 14, height: 14 }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--muted)', color: 'var(--foreground)' }}><CircleDot style={{ width: 10, height: 10 }} /> G2 · Concept</span>
            <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(98,209,120,0.12)', color: 'var(--success)' }}><Database style={{ width: 10, height: 10 }} /> PostgreSQL</span>
            <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--muted)', color: 'var(--muted-foreground)' }}><LinkIcon style={{ width: 10, height: 10 }} /> Neo4j</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            所属本体模型: <span style={{ color: 'var(--foreground)' }}>客户域本体</span>
          </div>
          {/* Properties */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}><List style={{ width: 13, height: 13 }} /> 属性列表</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {PROPERTIES.map((p) => (
                  <tr key={p.label} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 0', fontSize: 12, color: 'var(--muted-foreground)', width: 90, whiteSpace: 'nowrap', paddingRight: 12, verticalAlign: 'top' }}>{p.label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12, color: 'var(--foreground)', wordBreak: 'break-all', verticalAlign: 'top' }}>
                      {p.badge ? <span className="v-badge v-badge-neutral">{p.value}</span> :
                       p.statusDot ? <><span style={{ color: 'var(--success)' }}>●</span> {p.value}</> :
                       p.mono ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)' }}>{p.value}</span> :
                       p.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Relations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch style={{ width: 13, height: 13 }} /> 关联关系 <span style={{ marginLeft: 'auto', color: 'var(--foreground)', fontWeight: 400 }}>6</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RELATIONS.map((r) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ color: 'var(--muted-foreground)', fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center' }}><ArrowRight style={{ width: 12, height: 12 }} /></div>
                  <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><r.icon style={{ width: 12, height: 12 }} /> {r.target}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.type}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MOCK: 引用本体实体数据 */}
      <span style={{ display: 'none' }}>{MOCK_ONTOLOGY_ENTITIES.length}</span>
    </div>
  );
}
