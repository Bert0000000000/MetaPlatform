import { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FolderTree, Database, ChevronRight, ArrowRightLeft, Info, ShieldCheck,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

// MOCK
const stats = [
  { label: '数据源', value: '12', sub: '已接入并纳管' },
  { label: '数据模型', value: '48', sub: '跨域数据实体' },
  { label: '同步任务', value: '15', sub: 'CDC + 批量 ETL' },
  { label: '数据质量', value: '94.2%', sub: '综合质量评分', valueColor: 'var(--success)' },
];

// MOCK
const treeGroups = [
  {
    label: '关系型数据库', icon: 'database',
    items: [
      { name: 'PostgreSQL 主库', status: 'on', active: true },
      { name: 'PostgreSQL 只读', status: 'on' },
      { name: 'MySQL 业务库', status: 'on' },
    ],
  },
  {
    label: 'NoSQL', icon: 'fork',
    items: [
      { name: 'Neo4j 5.x', status: 'on' },
      { name: 'Redis 7.4', status: 'on' },
      { name: 'Milvus 2.5', status: 'on' },
    ],
  },
  {
    label: '消息队列', icon: 'radio',
    items: [
      { name: 'Kafka 3.9', status: 'on' },
      { name: 'RabbitMQ 4.x', status: 'on' },
    ],
  },
  {
    label: '文件 / 对象', icon: 'archive',
    items: [
      { name: 'MinIO', status: 'on' },
      { name: 'Hudi 数据湖', status: 'warn' },
    ],
  },
  {
    label: '外部 API', icon: 'globe',
    items: [{ name: 'LLM Provider API', status: 'on' }],
  },
];

// MOCK
const qualityRows = [
  { name: 'PostgreSQL 主库', type: '关系型', complete: '99.2%', accurate: '98.7%', timely: '99.5%', score: '99.1%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Neo4j 5.x', type: '图数据库', complete: '96.8%', accurate: '95.3%', timely: '97.1%', score: '96.4%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Milvus 2.5', type: '向量库', complete: '94.1%', accurate: '92.8%', timely: '98.4%', score: '95.1%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Hudi 数据湖', type: '数据湖', complete: '91.6%', accurate: '93.2%', timely: '88.4%', score: '91.1%', scoreColor: 'var(--warning)', status: '关注', badge: 'warning', cBar: 'warning', aBar: 'success', tBar: 'warning' },
  { name: 'StarRocks 3.4', type: 'OLAP', complete: '97.5%', accurate: '96.1%', timely: '95.8%', score: '96.5%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Kafka 3.9', type: '消息队列', complete: '99.8%', accurate: '99.6%', timely: '99.9%', score: '99.8%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Redis 7.4', type: '缓存', complete: '98.1%', accurate: '97.9%', timely: '99.2%', score: '98.4%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'MinIO', type: '对象存储', complete: '89.3%', accurate: '91.7%', timely: '94.5%', score: '91.8%', scoreColor: 'var(--warning)', status: '关注', badge: 'warning', cBar: 'warning', aBar: 'warning', tBar: 'success' },
];

// MOCK: graph nodes (id + geometry)
const fgNodes = [
  { id: 'src', name: '源系统', sub: '业务数据库 + 外部 API', x: 10, y: 40, w: 150, h: 80, highlight: true },
  { id: 'cdc', name: 'CDC', sub: 'Debezium + Flink', tp: '~12K events/s', x: 205, y: 40, w: 150, h: 80 },
  { id: 'lake', name: '数据湖', sub: 'Hudi (CDC/upsert)', tp: '吞吐 2.1TB', x: 400, y: 40, w: 150, h: 80 },
  { id: 'wh', name: '数据仓库', sub: 'StarRocks 3.4 OLAP', tp: '查询 <3s P99', x: 595, y: 40, w: 150, h: 80 },
  { id: 'app', name: '应用层', sub: 'APP / TECH 服务消费', x: 790, y: 40, w: 150, h: 80 },
  { id: 'doc', name: '文档', x: 130, y: 240, w: 110, h: 48, branch: true },
  { id: 'rag', name: 'TECH-RAG', x: 285, y: 240, w: 120, h: 48, branch: true },
  { id: 'milvus', name: 'Milvus 2.5', x: 450, y: 240, w: 120, h: 48, branch: true, muted: true },
  { id: 'ont', name: '本体', x: 595, y: 240, w: 110, h: 48, branch: true },
  { id: 'ontsvc', name: 'TECH-ONT', x: 750, y: 240, w: 120, h: 48, branch: true },
];

// MOCK: graph edges (from -> to, path d, arrowhead position + direction)
const fgEdges = [
  { id: 'e1', from: 'src', to: 'cdc', d: 'M160,80 L205,80', ax: 205, ay: 80, dir: 'right' },
  { id: 'e2', from: 'cdc', to: 'lake', d: 'M355,80 L400,80', ax: 400, ay: 80, dir: 'right' },
  { id: 'e3', from: 'lake', to: 'wh', d: 'M550,80 L595,80', ax: 595, ay: 80, dir: 'right' },
  { id: 'e4', from: 'wh', to: 'app', d: 'M745,80 L790,80', ax: 790, ay: 80, dir: 'right' },
  { id: 'e5', from: 'lake', to: 'doc', d: 'M475,120 V170 H185 V240', ax: 185, ay: 240, dir: 'down' },
  { id: 'e6', from: 'lake', to: 'ont', d: 'M475,120 V170 H650 V240', ax: 650, ay: 240, dir: 'down' },
  { id: 'e7', from: 'doc', to: 'rag', d: 'M240,264 L285,264', ax: 285, ay: 264, dir: 'right' },
  { id: 'e8', from: 'rag', to: 'milvus', d: 'M405,264 L450,264', ax: 450, ay: 264, dir: 'right' },
  { id: 'e9', from: 'ont', to: 'ontsvc', d: 'M705,264 L750,264', ax: 750, ay: 264, dir: 'right' },
];

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

export default function ArchDataPage() {
  const location = useLocation();
  const [selectedDs, setSelectedDs] = useState('PostgreSQL 主库');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgWrapRef = useRef<HTMLDivElement>(null);

  // Wheel zoom centered on cursor
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3, Math.max(0.5, zoom * factor));
    // Adjust pan so zoom centers on cursor
    const rect = svgWrapRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = newZoom / zoom;
      setPan({ x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio });
    }
    setZoom(newZoom);
  };

  const zoomBy = (factor: number) => {
    setZoom((z) => Math.min(3, Math.max(0.5, z * factor)));
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Drag to pan
  const draggingRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    setPan({
      x: draggingRef.current.panX + (e.clientX - draggingRef.current.startX),
      y: draggingRef.current.panY + (e.clientY - draggingRef.current.startY),
    });
  };
  const onMouseUp = () => { draggingRef.current = null; };

  const renderFlowSvg = () => (
    <svg className="ad-flow-svg" viewBox="0 0 900 320" preserveAspectRatio="xMidYMid meet" style={{ cursor: 'grab' }}>
      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
      <text className="fg-branch-label" x={130} y={225}>向量链路</text>
      <text className="fg-branch-label" x={595} y={225}>图谱链路</text>
      {fgEdges.map((e) => {
        const active = selectedNode !== null && (e.from === selectedNode || e.to === selectedNode);
        const headPts = e.dir === 'right'
          ? `${e.ax},${e.ay} ${e.ax - 6},${e.ay - 4} ${e.ax - 6},${e.ay + 4}`
          : `${e.ax},${e.ay} ${e.ax - 4},${e.ay - 6} ${e.ax + 4},${e.ay - 6}`;
        return (
          <g key={e.id}>
            <path className={`fg-arrow${active ? ' flowing' : ''}`} d={e.d} />
            <polygon className={`fg-arrow-head${active ? ' flowing' : ''}`} points={headPts} />
          </g>
        );
      })}
      {fgNodes.filter((n) => !n.branch).map((n) => (
        <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(selectedNode === n.id ? null : n.id)}>
          <rect className={`fg-node-rect${n.highlight ? ' highlight' : ''}${selectedNode === n.id ? ' selected' : ''}`} x={n.x} y={n.y} width={n.w} height={n.h} rx={8} />
          <circle className="fg-status" cx={n.x + 14} cy={n.y + 20} r={4} />
          <text className="fg-node-name" x={n.x + 26} y={n.y + 24}>{n.name}</text>
          <text className="fg-node-sub" x={n.x + 14} y={n.y + 44}>{n.sub}</text>
          {n.tp && <text className="fg-node-tp" x={n.x + 14} y={n.y + 62}>{n.tp}</text>}
        </g>
      ))}
      {fgNodes.filter((n) => n.branch).map((n) => (
        <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(selectedNode === n.id ? null : n.id)}>
          <rect className={`fg-node-rect${selectedNode === n.id ? ' selected' : ''}`} x={n.x} y={n.y} width={n.w} height={n.h} rx={6} />
          <text className={n.muted ? 'fg-branch-node-muted' : 'fg-branch-node'} x={n.x + n.w / 2} y={n.y + 29} textAnchor="middle">{n.name}</text>
        </g>
      ))}
      </g>
    </svg>
  );

  return (
    <>
      <style>{`
        :root { --info:#60a5fa; --info-subtle:#141824; }
        .ad-page-header { margin-bottom:24px; }
        .ad-page-header h1 { font-size:24px; font-weight:700; margin-bottom:6px; }
        .ad-page-header p { font-size:14px; color:var(--muted-foreground); }
        .ad-v-card-title { font-size:14px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .ad-v-card-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .ad-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .ad-stat-card { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:16px; }
        .ad-stat-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; }
        .ad-stat-value { font-size:28px; font-weight:700; }
        .ad-stat-sub { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ad-data-layout { display:flex; gap:16px; margin-bottom:20px; align-items:stretch; }
        .ad-tree-group { margin-bottom:16px; }
        .ad-tree-group:last-child { margin-bottom:0; }
        .ad-tree-group-label { font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted-foreground); padding:8px 0 6px; display:flex; align-items:center; gap:6px; }
        .ad-tree-group-label svg { width:12px; height:12px; color:var(--muted-foreground); }
        .ad-tree-item { padding:7px 10px 7px 18px; border-radius:var(--radius); cursor:pointer; font-size:13px; color:var(--muted-foreground); border:1px solid transparent; transition:all .15s; display:flex; align-items:center; gap:8px; }
        .ad-tree-item:hover { background:var(--muted); color:var(--foreground); }
        .ad-tree-item.active { background:var(--muted); color:var(--foreground); border-color:var(--border); }
        .ad-tree-item .ds-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .ad-tree-item .ds-dot.on { background:var(--success); }
        .ad-tree-item .ds-dot.warn { background:var(--warning); }
        .ad-flow-graph { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:24px; min-height:200px; }
        .ad-flow-svg { width:100%; height:auto; display:block; overflow:visible; }
        .ad-flow-svg .fg-node-rect { fill:var(--card); stroke:var(--border); stroke-width:1; transition:stroke .15s; }
        .ad-flow-svg .fg-node-rect.highlight { stroke:var(--info); stroke-width:1.5; }
        .ad-flow-svg .fg-node-name { font-size:12px; font-weight:600; fill:var(--foreground); font-family:var(--font-sans); }
        .ad-flow-svg .fg-node-sub { font-size:10px; fill:var(--muted-foreground); font-family:var(--font-sans); }
        .ad-flow-svg .fg-node-tp { font-size:10px; fill:var(--muted-foreground); font-family:var(--font-mono); }
        .ad-flow-svg .fg-status { fill:var(--success); }
        .ad-flow-svg .fg-arrow { stroke:var(--border); stroke-width:1.5; fill:none; transition:stroke .2s,stroke-width .2s; }
        .ad-flow-svg .fg-arrow.flowing { stroke:var(--info); stroke-width:2; stroke-dasharray:6 4; animation:fg-flow .8s linear infinite; }
        .ad-flow-svg .fg-arrow-head.flowing { fill:var(--info); }
        .ad-flow-svg .fg-node-rect.selected { stroke:var(--info); stroke-width:2; }
        @keyframes fg-flow { to { stroke-dashoffset:-10; } }
        .ad-flow-svg .fg-branch-label { font-size:10px; fill:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.04em; font-family:var(--font-sans); }
        .ad-flow-svg .fg-branch-node { font-size:11px; fill:var(--foreground); font-family:var(--font-sans); }
        .ad-flow-svg .fg-branch-node-muted { font-size:11px; fill:var(--muted-foreground); font-family:var(--font-sans); }
        .ad-detail-section { margin-bottom:16px; }
        .ad-detail-section:last-child { margin-bottom:0; }
        .ad-detail-title { font-size:16px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
        .ad-detail-title .status-dot { width:8px; height:8px; border-radius:50%; background:var(--success); flex-shrink:0; }
        .ad-detail-desc { font-size:13px; color:var(--muted-foreground); margin-bottom:14px; line-height:1.5; }
        .ad-detail-field { margin-bottom:12px; }
        .ad-detail-field-label { font-size:11px; color:var(--muted-foreground); margin-bottom:3px; text-transform:uppercase; letter-spacing:0.04em; }
        .ad-detail-field-value { font-size:13px; color:var(--foreground); }
        .ad-detail-field-value.mono { font-family:var(--font-mono); font-size:12px; }
        .ad-detail-metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .ad-detail-metric { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:12px; text-align:center; }
        .ad-detail-metric-value { font-size:22px; font-weight:700; }
        .ad-detail-metric-label { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ad-v-table { width:100%; border-collapse:collapse; }
        .ad-v-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:500; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); }
        .ad-v-table td { padding:10px 14px; font-size:13px; color:var(--foreground); border-bottom:1px solid var(--border); }
        .ad-v-table tr:last-child td { border-bottom:none; }
        .ad-v-table tr:hover td { background:var(--muted); }
        .ad-q-bar-track { width:64px; height:4px; background:var(--card); border-radius:2px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:6px; }
        .ad-q-bar-fill { height:100%; border-radius:2px; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="ad-page-header">
          <h1>数据架构</h1>
          <p>数据源、数据流向与数据质量全景</p>
        </div>

        {/* Stats */}
        <div className="ad-stats-row">
          {stats.map((s) => (
            <div className="ad-stat-card" key={s.label}>
              <div className="ad-stat-label">{s.label}</div>
              <div className="ad-stat-value" style={s.valueColor ? { color: s.valueColor } : undefined}>{s.value}</div>
              <div className="ad-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Three-column layout */}
        <div className="ad-data-layout">
          {/* Left: Data source tree */}
          <div className="v-card" style={{ width: 200, flexShrink: 0, padding: 16, overflowY: 'auto' }}>
            <div className="ad-v-card-title" style={{ fontSize: 13, marginBottom: 8 }}><FolderTree />数据源</div>
            {treeGroups.map((group) => (
              <div className="ad-tree-group" key={group.label}>
                <div className="ad-tree-group-label"><Database />{group.label}</div>
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className={`ad-tree-item${item.name === selectedDs ? ' active' : ''}`}
                    onClick={() => setSelectedDs(item.name)}
                  >
                    <span className={`ds-dot ${item.status}`} />
                    {item.name}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Middle: Data flow diagram */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
            <div className="v-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="ad-v-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ArrowRightLeft />数据流向图</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => zoomBy(0.8)} title="缩小" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ZoomOut style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={resetView} title="重置" style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={() => zoomBy(1.25)} title="放大" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ZoomIn style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
              <div
                ref={svgWrapRef}
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                className="ad-flow-graph"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'grab', userSelect: 'none' }}
              >
                {renderFlowSvg()}
              </div>
            </div>
          </div>

          {/* Right: Data source detail */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <div className="v-card" style={{ height: '100%' }}>
              <div className="ad-v-card-title"><Info />数据源详情</div>
              <div className="ad-detail-section">
                <div className="ad-detail-title"><span className="status-dot" />{selectedDs}</div>
                <div className="ad-detail-desc">平台核心关系型数据库，承载本体元数据、业务对象持久化与事务处理。</div>
                <div className="ad-detail-field">
                  <div className="ad-detail-field-label">连接信息</div>
                  <div className="ad-detail-field-value mono">mate-pg-primary.cluster:5432</div>
                </div>
                <div className="ad-detail-field">
                  <div className="ad-detail-field-label">版本</div>
                  <div className="ad-detail-field-value">PostgreSQL 17</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />
              <div className="ad-detail-metrics">
                <div className="ad-detail-metric"><div className="ad-detail-metric-value">23</div><div className="ad-detail-metric-label">表数量</div></div>
                <div className="ad-detail-metric"><div className="ad-detail-metric-value">2.1TB</div><div className="ad-detail-metric-label">数据量</div></div>
                <div className="ad-detail-metric"><div className="ad-detail-metric-value">08:32</div><div className="ad-detail-metric-label">最近同步</div></div>
                <div className="ad-detail-metric"><div className="ad-detail-metric-value" style={{ color: 'var(--success)' }}>&lt;5s</div><div className="ad-detail-metric-label">同步延迟</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Data quality */}
        <div className="v-card">
          <div className="ad-v-card-title"><ShieldCheck />数据质量面板</div>
          <table className="ad-v-table">
            <thead>
              <tr>
                <th>数据源</th><th>类型</th><th>完整率</th><th>准确率</th><th>及时率</th><th>综合评分</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              {qualityRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{row.name}</td>
                  <td><span className="v-badge v-badge-neutral">{row.type}</span></td>
                  <td><span className="ad-q-bar-track"><span className="ad-q-bar-fill" style={{ width: row.complete, background: `var(--${row.cBar})` }} /></span>{row.complete}</td>
                  <td><span className="ad-q-bar-track"><span className="ad-q-bar-fill" style={{ width: row.accurate, background: `var(--${row.aBar})` }} /></span>{row.accurate}</td>
                  <td><span className="ad-q-bar-track"><span className="ad-q-bar-fill" style={{ width: row.timely, background: `var(--${row.tBar})` }} /></span>{row.timely}</td>
                  <td style={{ fontWeight: 600, color: row.scoreColor }}>{row.score}</td>
                  <td><span className={`v-badge v-badge-${row.badge}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}
