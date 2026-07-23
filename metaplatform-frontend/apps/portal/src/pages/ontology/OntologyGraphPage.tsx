import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Graph } from '@antv/x6';
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
type GNode = { id: string; label: string; type: string; nodeClass: string; x: number; y: number };
const GRAPH_NODES: GNode[] = [
  { id: 'n1', label: '客户', type: 'G2 · Concept', nodeClass: 'node-concept', x: 65, y: 60 },
  { id: 'n2', label: '订单', type: 'G2 · Concept', nodeClass: 'node-concept', x: 265, y: 60 },
  { id: 'n3', label: '产品', type: 'G1 · Concept', nodeClass: 'node-concept', x: 465, y: 60 },
  { id: 'n4', label: '合同', type: 'G2 · Concept', nodeClass: 'node-concept', x: 265, y: 240 },
  { id: 'n5', label: '组织', type: 'G1 · Concept', nodeClass: 'node-g2', x: 65, y: 240 },
  { id: 'n6', label: '人员', type: 'G4 · Concept', nodeClass: 'node-g3', x: 65, y: 420 },
  { id: 'n7', label: '仓库', type: 'G4 · Concept', nodeClass: 'node-g4', x: 465, y: 240 },
  { id: 'n8', label: '供应商', type: 'G1 · Concept', nodeClass: 'node-g1', x: 465, y: 420 },
];

// MOCK: 边（X6: source/target + label）
const EDGES = [
  { source: 'n1', target: 'n2', label: '下单' },
  { source: 'n2', target: 'n4', label: '签署' },
  { source: 'n1', target: 'n5', label: '所属' },
  { source: 'n5', target: 'n6', label: '联系人' },
  { source: 'n2', target: 'n3', label: '包含' },
  { source: 'n2', target: 'n7', label: '配送' },
  { source: 'n3', target: 'n7', label: '关联' },
  { source: 'n5', target: 'n4', label: '包含' },
  { source: 'n2', target: 'n8', label: '采购' },
  { source: 'n3', target: 'n8', label: '供货' },
  { source: 'n7', target: 'n8', label: '入库' },
  { source: 'n4', target: 'n2', label: '依据' },
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
  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphInstanceRef = useRef<Graph | null>(null);

  // X6 初始化
  useEffect(() => {
    if (!graphRef.current) return;
    const container = graphRef.current;
    // 父容器用 flex 布局，首次测量时宽度可能为 0；推迟一帧等布局完成
    let graph: Graph | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;
    const raf = requestAnimationFrame(() => {
      if (disposed || !container.isConnected) return;
      const initW = container.offsetWidth || container.clientWidth || 800;
      const initH = container.offsetHeight || container.clientHeight || 560;
      graph = new Graph({
        container,
        width: initW,
        height: initH,
        autoResize: false,
        background: { color: 'transparent' },
        panning: { enabled: true, modifiers: ['space'] },
        mousewheel: { enabled: true, zoomAtMousePosition: true, modifiers: ['ctrl', 'meta'] },
        interacting: { nodeMovable: true, edgeMovable: false },
        connecting: { connector: 'normal' as any, router: 'normal' as any },
        highlighting: {},
      } as any);
      // 强制同步一次最新尺寸
      try { graph.resize(initW, initH); } catch {}
      graphInstanceRef.current = graph;

      // 用 ResizeObserver 监听 graphRef 父容器（layout 容器），尺寸变化时同步给 graph
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            try { graph?.resize(width, height); } catch {}
          }
        }
      });
      ro.observe(container.parentElement || container);

      const jsonData = {
        nodes: GRAPH_NODES.map((n) => {
          const selected = n.id === selectedNodeRef.current;
          return {
            id: n.id,
            shape: 'rect',
            x: n.x,
            y: n.y,
            width: 110,
            height: 64,
            data: { label: n.label, type: n.type, nodeClass: n.nodeClass, selected },
            attrs: {
              body: {
                rx: 6,
                ry: 6,
                fill: selected ? '#1a1d24' : 'var(--muted, #18181b)',
                stroke: selected ? '#e4e4e7' : '#27272a',
                strokeWidth: selected ? 2 : 1.5,
              },
              label: {
                text: n.label,
                fill: '#fafafa',
                fontSize: 13,
                fontWeight: 600,
                refX: 55,
                refY: 26,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
              },
              // 类型标签（小字）
              sub: {
                text: n.type,
                fill: '#a1a1aa',
                fontSize: 10,
                refX: 55,
                refY: 48,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
              },
            },
          };
        }),
        edges: EDGES.map((e, i) => ({
          id: `e${i}`,
          source: e.source,
          target: e.target,
          shape: 'edge',
          attrs: {
            line: {
              stroke: '#71717a',
              strokeWidth: 1,
              strokeDasharray: '4 4',
              targetMarker: { name: 'block', size: 6, fill: '#71717a' },
            },
          },
          labels: [
            {
              attrs: {
                text: {
                  text: e.label,
                  fill: '#a1a1aa',
                  fontSize: 10,
                },
              },
            },
          ],
        })),
      };
      graph.fromJSON(jsonData as any);

      graph.on('node:click', ({ node }) => {
        setSelectedNode(node.id);
      });

      // 鼠标悬停反馈
      graph.on('node:mouseenter', ({ node }) => {
        const cell = node as any;
        const isSel = cell.id === selectedNodeRef.current;
        cell.attr('body/stroke', isSel ? '#fafafa' : '#71717a');
        cell.attr('body/strokeWidth', isSel ? 2.5 : 1.5);
      });
      graph.on('node:mouseleave', ({ node }) => {
        const cell = node as any;
        const isSel = cell.id === selectedNodeRef.current;
        cell.attr('body/stroke', isSel ? '#e4e4e7' : '#27272a');
        cell.attr('body/strokeWidth', isSel ? 2 : 1.5);
      });
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (graph) {
        graph.dispose();
      }
      graphInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 选中态变化时刷新样式
  useEffect(() => {
    const graph = graphInstanceRef.current;
    if (!graph) return;
    GRAPH_NODES.forEach((n) => {
      const cell = graph.getCellById(n.id) as any;
      if (!cell) return;
      const selected = n.id === selectedNode;
      cell.attr('body', {
        fill: selected ? '#1a1d24' : 'var(--muted, #18181b)',
        stroke: selected ? '#e4e4e7' : '#27272a',
        strokeWidth: selected ? 2 : 1.5,
      });
    });
  }, [selectedNode]);

  return (
    <div>
      <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 20 }}>
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
          <div ref={graphRef} style={{ flex: 1, minHeight: 560, minWidth: 0, width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }} />
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
