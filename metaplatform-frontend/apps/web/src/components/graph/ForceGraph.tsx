import { useEffect, useRef } from 'react';
import './graph.css';

/*
 * ForceGraph —— 零依赖力导向知识图谱（移植自 ui-redesign 原型 §13）。
 *
 * 设计约束（与原型一致）：
 *  - SVG DOM 在 effect 里「建一次」，动画帧只 setAttribute 改属性；
 *    60fps 不经过 React state（避免每帧 re-render）。
 *  - nodes/edges 变化时重建并重新加热；卸载时清理 rAF + window 监听。
 *
 * 职责边界：
 *  - ForceGraph 自己负责：tooltip（悬停气泡）、悬停邻接高亮、选中环（.sel）。
 *  - **详情卡片由页面负责**：node 点击 / 背景点击都会回调 onSelect（背景为 null），
 *    页面据此在 Semi Card 里渲染卡片，并把 selectedId 传回来驱动选中环。
 *
 * 颜色由 types prop 注入（页面决定），CSS 只保留极少量中性色。
 * nodes / edges 请由页面 memo 化，否则每次渲染都会触发重建。
 */

export interface ForceGraphNode {
  id: string;
  label: string;
  type: string;
}

export interface ForceGraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ForceGraphProps {
  nodes: ForceGraphNode[];
  edges: ForceGraphEdge[];
  /** 类型 → 颜色/标签，颜色由页面决定 */
  types: Record<string, { label: string; color: string }>;
  /** viewBox 高度，默认 640 */
  height?: number;
  /** viewBox 宽度，默认 1200 */
  width?: number;
  /** 被图例过滤掉的类型 */
  hiddenTypes?: string[];
  showEdgeLabels?: boolean;
  /** 非匹配节点/边隐藏 */
  searchQuery?: string;
  /** 变更此值 → 重新散布 + 重新加热 */
  relayoutToken?: number;
  /** 点节点 / 点背景（null） */
  onSelect?: (node: ForceGraphNode | null) => void;
  selectedId?: string;
  className?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

interface SimEdge {
  a: number;
  b: number;
  rel: string;
  el: SVGLineElement;
  tEl: SVGTextElement;
  /** 当前是否可见（未被子句过滤掉） */
  vis: boolean;
}

interface SimNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  deg: number;
  adj: Set<number>;
  eAdj: SimEdge[];
  el: SVGGElement;
  cEl: SVGCircleElement;
  tEl: SVGTextElement;
  r: number;
}

interface SimState {
  svg: SVGSVGElement;
  stage: HTMLDivElement | null;
  tip: HTMLDivElement | null;
  nodes: SimNode[];
  edges: SimEdge[];
  W: number;
  H: number;
  alpha: number;
  running: boolean;
  raf: number;
  dragN: SimNode | null;
  labelsOn: boolean;
  selectedIdx: number;
  hidden: Set<string>;
  query: string;
  typeMap: Record<string, { label: string; color: string }>;
  onSelect?: (node: ForceGraphNode | null) => void;
}

const radOf = (n: SimNode): number => 7 + Math.min(n.deg * 1.3, 9);

function toPublic(n: SimNode): ForceGraphNode {
  return { id: n.id, label: n.label, type: n.type };
}

function render(sim: SimState): void {
  for (const e of sim.edges) {
    const a = sim.nodes[e.a];
    const b = sim.nodes[e.b];
    e.el.setAttribute('x1', String(a.x));
    e.el.setAttribute('y1', String(a.y));
    e.el.setAttribute('x2', String(b.x));
    e.el.setAttribute('y2', String(b.y));
    if (e.tEl.style.display !== 'none') {
      e.tEl.setAttribute('x', String((a.x + b.x) / 2));
      e.tEl.setAttribute('y', String((a.y + b.y) / 2 - 3));
    }
  }
  for (const n of sim.nodes) {
    n.el.setAttribute('transform', `translate(${n.x},${n.y})`);
  }
}

function tick(sim: SimState): void {
  sim.alpha = Math.max(sim.alpha * 0.992, 0.02);
  const { nodes, edges, W, H } = sim;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy || 1;
      const d = Math.sqrt(d2);
      const f = 3400 / d2;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  for (const e of edges) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - 118) * 0.02;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  for (const n of nodes) {
    n.vx += (W / 2 - n.x) * 0.0045;
    n.vy += (H / 2 - n.y) * 0.0045;
    if (n.fx !== null && n.fy !== null) {
      n.x = n.fx;
      n.y = n.fy;
      n.vx = 0;
      n.vy = 0;
    } else {
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += Math.max(-9, Math.min(9, n.vx));
      n.y += Math.max(-9, Math.min(9, n.vy));
    }
    n.x = Math.max(56, Math.min(W - 56, n.x));
    n.y = Math.max(40, Math.min(H - 42, n.y));
  }

  render(sim);
  if (sim.alpha > 0.021) sim.raf = requestAnimationFrame(() => tick(sim));
  else sim.running = false;
}

function wake(sim: SimState, a = 0.5): void {
  sim.alpha = Math.max(sim.alpha, a);
  if (!sim.running) {
    sim.running = true;
    sim.raf = requestAnimationFrame(() => tick(sim));
  }
}

function applyLabels(sim: SimState): void {
  for (const e of sim.edges) {
    e.tEl.style.display = sim.labelsOn && e.vis ? '' : 'none';
  }
}

function applyFilter(sim: SimState): void {
  const q = sim.query;
  for (const n of sim.nodes) {
    n.el.style.display = (!q || n.label.includes(q)) && !sim.hidden.has(n.type) ? '' : 'none';
  }
  for (const e of sim.edges) {
    const a = sim.nodes[e.a];
    const b = sim.nodes[e.b];
    const byType = sim.hidden.has(a.type) || sim.hidden.has(b.type);
    const byQuery = !!q && !a.label.includes(q) && !b.label.includes(q);
    e.vis = !byType && !byQuery;
    e.el.style.display = e.vis ? '' : 'none';
  }
  applyLabels(sim);
}

function selectNode(sim: SimState, i: number): void {
  sim.nodes.forEach((m, mi) => m.el.classList.toggle('mp-graph-sel', mi === i));
  sim.selectedIdx = i;
  sim.onSelect?.(i >= 0 ? toPublic(sim.nodes[i]) : null);
}

function clearSel(sim: SimState): void {
  if (sim.selectedIdx === -1) return;
  sim.nodes.forEach((m) => m.el.classList.remove('mp-graph-sel'));
  sim.selectedIdx = -1;
  sim.onSelect?.(null);
}

function positionTip(sim: SimState, ev: { clientX: number; clientY: number }): void {
  const st = sim.stage?.getBoundingClientRect();
  if (!st || !sim.tip) return;
  sim.tip.style.left = `${Math.min(ev.clientX - st.left + 14, st.width - 220)}px`;
  sim.tip.style.top = `${ev.clientY - st.top + 12}px`;
}

function hoverNode(sim: SimState, i: number, on: boolean): void {
  const n = sim.nodes[i];
  if (on) {
    sim.nodes.forEach((m, mi) => m.el.classList.toggle('mp-graph-muted', !n.adj.has(mi)));
    sim.edges.forEach((e) => {
      const hit = n.eAdj.includes(e);
      e.el.classList.toggle('mp-graph-muted', !hit);
      e.el.classList.toggle('mp-graph-hi', hit);
      if (sim.labelsOn) e.tEl.style.display = hit ? '' : 'none';
    });
    if (sim.tip) {
      const d1 = document.createElement('div');
      d1.textContent = n.label;
      const d2 = document.createElement('div');
      d2.className = 'mp-graph-tip-sub';
      const typeLabel = sim.typeMap[n.type]?.label ?? n.type;
      d2.textContent = `${typeLabel} · ${n.deg} 个关系 · 点击查看详情`;
      sim.tip.replaceChildren(d1, d2);
      sim.tip.hidden = false;
    }
  } else {
    sim.nodes.forEach((m) => m.el.classList.remove('mp-graph-muted'));
    sim.edges.forEach((e) => e.el.classList.remove('mp-graph-muted', 'mp-graph-hi'));
    applyLabels(sim);
    if (sim.tip) sim.tip.hidden = true;
  }
}

function svgPt(svg: SVGSVGElement, ev: { clientX: number; clientY: number }): DOMPoint | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = svg.createSVGPoint();
  p.x = ev.clientX;
  p.y = ev.clientY;
  return p.matrixTransform(ctm.inverse());
}

export default function ForceGraph({
  nodes,
  edges,
  types,
  height = 640,
  width = 1200,
  hiddenTypes,
  showEdgeLabels = false,
  searchQuery = '',
  relayoutToken = 0,
  onSelect,
  selectedId,
  className,
}: ForceGraphProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const edgesGRef = useRef<SVGGElement>(null);
  const nodesGRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimState | null>(null);
  const typesRef = useRef(types);
  const onSelectRef = useRef(onSelect);
  const relayoutRef = useRef(relayoutToken);

  const hiddenKey = (hiddenTypes ?? []).join('|');

  // ---------- 建立 SVG DOM（数据变化时重建） ----------
  useEffect(() => {
    const svg = svgRef.current;
    const edgesG = edgesGRef.current;
    const nodesG = nodesGRef.current;
    if (!svg || !edgesG || !nodesG) return;

    const prev = simRef.current;
    if (prev) cancelAnimationFrame(prev.raf);
    edgesG.replaceChildren();
    nodesG.replaceChildren();
    if (tipRef.current) tipRef.current.hidden = true;

    const sim: SimState = {
      svg,
      stage: stageRef.current,
      tip: tipRef.current,
      nodes: [],
      edges: [],
      W: width,
      H: height,
      alpha: 0.02,
      running: false,
      raf: 0,
      dragN: null,
      labelsOn: showEdgeLabels,
      selectedIdx: -1,
      hidden: new Set(hiddenTypes ?? []),
      query: searchQuery ?? '',
      typeMap: typesRef.current,
      onSelect: onSelectRef.current,
    };
    // 重建时保留交互状态（图例过滤 / 搜索 / 选中 / 标签开关）
    if (prev) {
      sim.labelsOn = prev.labelsOn;
      sim.hidden = new Set(prev.hidden);
      sim.query = prev.query;
      sim.selectedIdx = prev.selectedIdx;
    }

    const simNodes: SimNode[] = [];
    const byId = new Map<string, number>();
    nodes.forEach((nd, i) => {
      const ang = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
      g.setAttribute('class', 'mp-graph-node');
      const c = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
      const t = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
      g.appendChild(c);
      g.appendChild(t);
      nodesG.appendChild(g);
      const node: SimNode = {
        id: nd.id,
        label: nd.label,
        type: nd.type,
        x: width / 2 + Math.cos(ang) * (150 + (i % 3) * 70),
        y: height / 2 + Math.sin(ang) * (120 + (i % 4) * 50),
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        deg: 0,
        adj: new Set<number>(),
        eAdj: [],
        el: g,
        cEl: c,
        tEl: t,
        r: 7,
      };
      simNodes.push(node);
      if (!byId.has(nd.id)) byId.set(nd.id, i);
    });

    const simEdges: SimEdge[] = [];
    for (const ed of edges) {
      const ai = byId.get(ed.source);
      const bi = byId.get(ed.target);
      if (ai === undefined || bi === undefined) continue;
      const line = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
      line.setAttribute('class', 'mp-graph-edge');
      const txt = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
      txt.setAttribute('class', 'mp-graph-edge-label');
      txt.textContent = ed.label ?? '';
      txt.style.display = 'none';
      edgesG.appendChild(line);
      edgesG.appendChild(txt);
      simEdges.push({ a: ai, b: bi, rel: ed.label ?? '', el: line, tEl: txt, vis: true });
    }
    for (const e of simEdges) {
      simNodes[e.a].deg++;
      simNodes[e.b].deg++;
      simNodes[e.a].adj.add(e.b);
      simNodes[e.b].adj.add(e.a);
      simNodes[e.a].eAdj.push(e);
      simNodes[e.b].eAdj.push(e);
    }

    for (const n of simNodes) {
      n.r = radOf(n);
      n.cEl.setAttribute('r', String(n.r));
      n.cEl.style.fill = sim.typeMap[n.type]?.color ?? 'var(--semi-color-primary)';
      n.tEl.setAttribute('y', String(-(n.r + 6)));
      n.tEl.textContent = n.label;
    }

    simNodes.forEach((n, i) => {
      n.el.addEventListener('pointerenter', (ev) => {
        hoverNode(sim, i, true);
        positionTip(sim, ev as PointerEvent);
      });
      n.el.addEventListener('pointerleave', () => hoverNode(sim, i, false));
      n.el.addEventListener('pointerdown', (ev) => {
        sim.dragN = n;
        n.fx = n.x;
        n.fy = n.y;
        wake(sim, 0.6);
        (ev as PointerEvent).preventDefault();
      });
      n.el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectNode(sim, i);
      });
    });

    sim.nodes = simNodes;
    sim.edges = simEdges;
    simRef.current = sim;

    applyFilter(sim);
    if (sim.selectedIdx >= 0 && sim.selectedIdx < simNodes.length) {
      simNodes[sim.selectedIdx].el.classList.add('mp-graph-sel');
    }
    wake(sim, 1);

    return () => {
      cancelAnimationFrame(sim.raf);
    };
    // nodes/edges/尺寸变化才重建；交互态经 ref/状态 effect 增量同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, width, height]);

  // ---------- 拖拽：window 级 pointermove / pointerup ----------
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const sim = simRef.current;
      if (!sim || !sim.dragN) return;
      const p = svgPt(sim.svg, ev);
      if (!p) return;
      sim.dragN.fx = p.x;
      sim.dragN.fy = p.y;
      wake(sim, 0.4);
    };
    const onUp = () => {
      const sim = simRef.current;
      if (!sim || !sim.dragN) return;
      sim.dragN.fx = null;
      sim.dragN.fy = null;
      sim.dragN = null;
      wake(sim, 0.3);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // ---------- 背景点击 → 取消选中 ----------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onBgClick = () => {
      const sim = simRef.current;
      if (sim) clearSel(sim);
    };
    svg.addEventListener('click', onBgClick);
    return () => svg.removeEventListener('click', onBgClick);
  }, []);

  // ---------- 类型颜色（不重建，仅刷新填充） ----------
  useEffect(() => {
    typesRef.current = types;
    const sim = simRef.current;
    if (!sim) return;
    sim.typeMap = types;
    for (const n of sim.nodes) {
      n.cEl.style.fill = types[n.type]?.color ?? 'var(--semi-color-primary)';
    }
  }, [types]);

  // ---------- onSelect 保持最新 ----------
  useEffect(() => {
    onSelectRef.current = onSelect;
    const sim = simRef.current;
    if (sim) sim.onSelect = onSelect;
  }, [onSelect]);

  // ---------- 图例过滤 ----------
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.hidden = new Set(hiddenTypes ?? []);
    applyFilter(sim);
    wake(sim, 0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey]);

  // ---------- 搜索过滤 ----------
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.query = searchQuery ?? '';
    applyFilter(sim);
    if (sim.query) {
      const hit = sim.nodes.findIndex((n) => n.label.includes(sim.query));
      if (hit >= 0 && hit !== sim.selectedIdx) selectNode(sim, hit);
    }
  }, [searchQuery]);

  // ---------- 关系标签开关 ----------
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.labelsOn = showEdgeLabels;
    applyLabels(sim);
  }, [showEdgeLabels]);

  // ---------- 受控选中环 ----------
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const i = selectedId ? sim.nodes.findIndex((n) => n.id === selectedId) : -1;
    sim.nodes.forEach((m, mi) => m.el.classList.toggle('mp-graph-sel', mi === i));
    sim.selectedIdx = i;
  }, [selectedId, nodes]);

  // ---------- 重新布局（relayoutToken 变更，跳过首次） ----------
  useEffect(() => {
    if (relayoutToken === relayoutRef.current) return;
    relayoutRef.current = relayoutToken;
    const sim = simRef.current;
    if (!sim) return;
    for (const n of sim.nodes) {
      const a = Math.random() * Math.PI * 2;
      n.x = sim.W / 2 + Math.cos(a) * 200;
      n.y = sim.H / 2 + Math.sin(a) * 160;
      n.vx = 0;
      n.vy = 0;
    }
    wake(sim, 1);
  }, [relayoutToken]);

  return (
    <div ref={stageRef} className={className ? `mp-graph-stage ${className}` : 'mp-graph-stage'}>
      <svg ref={svgRef} className="mp-graph-svg" viewBox={`0 0 ${width} ${height}`}>
        <g ref={edgesGRef} />
        <g ref={nodesGRef} />
      </svg>
      <div ref={tipRef} className="mp-graph-tip" hidden />
    </div>
  );
}
