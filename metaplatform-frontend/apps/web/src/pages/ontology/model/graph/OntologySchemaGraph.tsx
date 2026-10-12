import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus, RotateCcw, Scan, Search } from 'lucide-react';
import { layoutConceptSchema, positionSchemaNodes, schemaNeighborhood, type SchemaPositions } from './schema-layout';
import './schema-graph.css';
function classPurpose(name: string) {
  if (/明细|结存|流水|批次|结果|BOM行|工序|记录/.test(name)) return '明细与记录';
  if (/订单|任务单|工单|变更单|计划|MPS|到货单/.test(name)) return '业务单据与计划';
  if (/主数据|物料|产成品|单机|组件|型号|仓库|库位|货位|设备|供应商|工艺路线/.test(name)) return '基础对象';
  return '其他业务对象';
}
interface ModelClass { id: string; name: string; description: string; properties: unknown[] }
interface Relationship { id: string; name: string; source: string; target: string }

const purposes = ['基础对象', '业务单据与计划', '明细与记录', '其他业务对象'];
const category = (name: string) => purposes.indexOf(classPurpose(name));

function readPositions(key: string): SchemaPositions {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return Object.fromEntries(Object.entries(data).filter((entry): entry is [string, { x: number; y: number }] => {
      const p = entry[1];
      const point = p as { x?: number; y?: number } | null;
      return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
    }));
  } catch { return {}; }
}

export default function OntologySchemaGraph({ classes, relationships, selected, onSelect, onOpen, compact = false, selectedRelation, onRelationSelect, layoutKey = 'schema' }: {
  classes: ModelClass[]; relationships: Relationship[]; selected?: string; onSelect: (id: string) => void; onOpen?: (id: string) => void; compact?: boolean;
  selectedRelation?: string; onRelationSelect?: (id: string) => void;
  layoutKey?: string;
}) {
  const [all, setAll] = useState(true);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState(purposes);
  const [labels, setLabels] = useState(false);
  const [hovered, setHovered] = useState('');
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [size, setSize] = useState({ width: 800, height: 580 });
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState('');
  const [moving, setMoving] = useState(false);
  const [reset, setReset] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; camera: typeof camera; id?: string; origin?: { x: number; y: number }; positions: SchemaPositions; initialPositions: SchemaPositions; moved: boolean } | null>(null);
  const marker = useId().replace(/:/g, '');
  const filtered = useMemo(() => classes.filter(c => categories.includes(classPurpose(c.name)) && `${c.name} ${c.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [classes, categories, search]);
  const focus = filtered.find(c => c.id === selected)?.id || filtered.find(c => /产成品|单机|型号/.test(c.name))?.id || filtered[0]?.id || '';
  const layoutFocus = all ? '' : focus;
  const storageKey = `mate-ontology-graph-layout:${layoutKey}:${all ? 'all' : focus}`;
  const storedPositions = useMemo(() => readPositions(storageKey), [storageKey]);
  const [manualLayout, setManualLayout] = useState({ key: storageKey, positions: storedPositions });
  const positions = manualLayout.key === storageKey ? manualLayout.positions : storedPositions;
  const diagram = useMemo(() => {
    const neighborhood = schemaNeighborhood(filtered.map(c => c.id), relationships, layoutFocus, all);
    const nodes = filtered.filter(c => neighborhood.ids.includes(c.id));
    try {
      const dag = layoutConceptSchema(nodes, neighborhood.edges, size.width / size.height);
      return { nodes, edges: neighborhood.edges, dag, width: dag.graph().width || 1, height: dag.graph().height || 1, error: '' };
    } catch { return { nodes: [], edges: [], dag: null, width: 1, height: 1, error: '结构图暂时无法布局，可继续查看类与关系定义。' }; }
  }, [filtered, relationships, layoutFocus, all, size.width, size.height]);
  const positioned = useMemo(() => diagram.dag ? positionSchemaNodes(diagram.dag, positions) : null, [diagram, positions]);
  const related = useMemo(() => {
    const relation = relationships.find(r => r.id === selectedRelation);
    if (relation && !dragging) return { ids: new Set([relation.source, relation.target]), active: '', relation: relation.id };
    const active = dragging || hovered || selected || (!all ? focus : '');
    const ids = new Set(active ? [active] : []);
    if (active) relationships.filter(r => r.source === active || r.target === active).forEach(r => { ids.add(r.source); ids.add(r.target); });
    return { ids, active, relation: '' };
  }, [relationships, selectedRelation, selected, hovered, all, focus, dragging]);
  const fit = () => {
    const bounds = positioned?.graph() || { width: 1, height: 1 };
    const width = bounds.width || 1, height = bounds.height || 1;
    const scale = Math.min(1.1, Math.max(.08, (size.width - 36) / width), Math.max(.08, (size.height - 36) / height));
    setCamera({ x: (size.width - width * scale) / 2 - (bounds.minX || 0) * scale, y: (size.height - height * scale) / 2 - (bounds.minY || 0) * scale, scale });
  };
  useEffect(() => { setHovered(''); fit(); }, [diagram, size, storageKey, reset]);
  const endDrag = (pointerId: number, canceled = false) => {
    const current = drag.current;
    drag.current = null;
    setDragging(''); setMoving(false);
    if (svg.current?.hasPointerCapture(pointerId)) svg.current.releasePointerCapture(pointerId);
    if (!current?.id) return;
    if (canceled) { setManualLayout({ key: storageKey, positions: current.initialPositions }); return; }
    if (current.moved) {
      try { localStorage.setItem(storageKey, JSON.stringify(current.positions)); } catch { /* Layout remains available for this view if storage is full. */ }
    } else onSelect(current.id);
  };
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) }));
    if (svg.current) observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [expanded]);
  const zoom = (factor: number) => setCamera(c => {
    const scale = Math.min(3, Math.max(.08, c.scale * factor)), ratio = scale / c.scale;
    return { x: size.width / 2 - (size.width / 2 - c.x) * ratio, y: size.height / 2 - (size.height / 2 - c.y) * ratio, scale };
  });
  const resetLayout = () => {
    setManualLayout({ key: storageKey, positions: {} });
    setReset(v => v + 1);
    try { localStorage.removeItem(storageKey); } catch { /* Keep reset usable without browser storage. */ }
  };
  if (diagram.error) return <div role="alert" className="ms-empty ms-error">{diagram.error}</div>;
  return <div className={`mp-schema-graph ms-schema-diagram ms-concept-diagram${compact ? ' is-overview' : ''}${expanded ? ' ms-schema-expanded' : ''}`}>
    <div className="ms-schema-toolbar"><div className="ms-concept-heading"><b>本体关系</b><small>{diagram.nodes.length} / {classes.length} 类 · {diagram.edges.length} 关系</small></div><label className="ms-concept-search"><Search size={14} /><input aria-label="搜索图谱对象" placeholder="搜索对象" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="ms-segmented"><button aria-pressed={all} onClick={() => setAll(true)}>全部类型</button><button aria-pressed={!all} onClick={() => setAll(false)}>局部关联</button></div><div className="ms-schema-actions"><button title="缩小本体图" aria-label="缩小本体图" onClick={() => zoom(.8)}><Minus size={15} /></button><output aria-label="图谱缩放比例" className="ms-concept-zoom">{Math.round(camera.scale * 100)}%</output><button title="放大本体图" aria-label="放大本体图" onClick={() => zoom(1.25)}><Plus size={15} /></button><button title="适应本体图" aria-label="适应本体图" onClick={fit}><Scan size={15} /></button><button title="重新布局本体图" aria-label="重新布局本体图" onClick={resetLayout}><RotateCcw size={15} /></button><button title={expanded ? '退出展开视图' : '展开本体图'} aria-label="展开本体图" aria-pressed={expanded} onClick={() => setExpanded(v => !v)}><Maximize size={15} /></button></div></div>
    <div className="ms-concept-canvas">
      <svg ref={svg} role="img" aria-label="本体类与关系结构图" className={`ms-schema-svg${moving || dragging ? ' is-interacting' : ''}`} onWheel={e => { if (e.ctrlKey && !drag.current) { e.preventDefault(); zoom(e.deltaY > 0 ? .9 : 1.1); } }} onPointerDown={e => { if (e.button !== 0 || !e.isPrimary) return; drag.current = { x: e.clientX, y: e.clientY, camera, positions, initialPositions: positions, moved: false }; setMoving(true); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => {
        const current = drag.current;
        if (!current) return;
        const dx = e.clientX - current.x, dy = e.clientY - current.y;
        if (!current.moved && Math.hypot(dx, dy) < 4) return;
        current.moved = true;
        if (current.id && current.origin) {
          current.positions = { ...current.positions, [current.id]: { x: current.origin.x + dx / current.camera.scale, y: current.origin.y + dy / current.camera.scale } };
          setManualLayout({ key: storageKey, positions: current.positions });
        } else setCamera({ ...current.camera, x: current.camera.x + dx, y: current.camera.y + dy });
      }} onPointerUp={e => endDrag(e.pointerId)} onPointerCancel={e => endDrag(e.pointerId, true)} onLostPointerCapture={e => { if (drag.current) endDrag(e.pointerId, true); }}>
        <defs>{[false, true].map(active => <marker key={String(active)} id={`${marker}${active ? '-active' : ''}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={active ? 'var(--ms-accent)' : 'var(--concept-line)'} /></marker>)}</defs>
        <g className="ms-schema-scene" transform={`translate(${camera.x},${camera.y}) scale(${camera.scale})`}>
          {diagram.edges.map(r => {
            const edge = positioned!.edge(r.source, r.target, r.id), points = edge.points;
            const active = related.relation ? r.id === related.relation : r.source === related.active || r.target === related.active;
            return <g key={r.id} className={`ms-schema-edge${selectedRelation === r.id ? ' is-selected' : ''}${active ? ' is-connected' : related.ids.size ? ' is-dimmed' : ''}`} role="button" tabIndex={0} aria-label={`查看关系 ${r.name}`} onPointerDown={e => e.stopPropagation()} onClick={() => onRelationSelect?.(r.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRelationSelect?.(r.id); } }}><title>{r.name}</title><rect x={edge.x - 10} y={edge.y - 10} width="20" height="20" fill="transparent" /><polyline className="ms-schema-edge-hit" points={points.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ')} /><polyline points={points.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ')} markerEnd={`url(#${marker}${active || selectedRelation === r.id ? '-active' : ''})`} />{(labels || selectedRelation === r.id) && camera.scale > .45 && <text x={edge.x} y={edge.y - 8} textAnchor="middle">{r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name}</text>}</g>;
          })}
          {diagram.nodes.map(c => {
            const node = positioned!.node(c.id);
            return <g key={c.id} transform={`translate(${node.x - node.width / 2},${node.y - node.height / 2})`} className={`ms-schema-node ms-concept-kind-${category(c.name)}${dragging === c.id ? ' is-dragging' : ''}${selected === c.id || !all && focus === c.id ? ' is-selected' : ''}${related.ids.size && !related.ids.has(c.id) ? ' is-dimmed' : ''}`} role="button" tabIndex={0} aria-label={`查看本体类 ${c.name}`} onDoubleClick={() => onOpen?.(c.id)} onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => { if (!drag.current) setHovered(''); }} onPointerDown={e => {
              e.stopPropagation();
              if (e.button !== 0 || !e.isPrimary) return;
              drag.current = { x: e.clientX, y: e.clientY, camera, id: c.id, origin: { x: node.x, y: node.y }, positions, initialPositions: positions, moved: false };
              setDragging(c.id); setHovered(c.id);
              svg.current?.setPointerCapture(e.pointerId);
            }} onClick={e => { if (e.detail === 0) onSelect(c.id); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.id); } }}><title>{c.name} · {c.properties.length} 属性 · {c.description || '尚未填写业务定义'}</title><rect width={node.width} height={node.height} rx="5" /><circle className="ms-concept-dot" cx="14" cy="21" r="3" /><text className="ms-schema-node-title" x="25" y="26">{c.name.length > 9 ? `${c.name.slice(0, 8)}…` : c.name}</text></g>;
          })}
        </g>
      </svg>
      {!diagram.nodes.length && <div className="ms-concept-empty">没有匹配的对象</div>}
    </div>
    <div className="ms-concept-footer"><div className="ms-concept-legend" aria-label="图谱用途筛选">{purposes.filter(p => classes.some(c => classPurpose(c.name) === p)).map(p => <label key={p} title="用途分组建议"><input type="checkbox" checked={categories.includes(p)} onChange={e => setCategories(v => e.target.checked ? [...v, p] : v.filter(k => k !== p))} /><i className={`ms-concept-kind-${purposes.indexOf(p)}`} />{p}</label>)}</div><label className="ms-concept-label-toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />关系名称</label></div>
    {!!selectedRelation && <div className="ms-concept-selected-relation">{relationships.filter(r => r.id === selectedRelation).map(r => <button key={r.id} onClick={() => onRelationSelect?.(r.id)}><strong>{r.name}</strong><span>{classes.find(c => c.id === r.source)?.name} → {classes.find(c => c.id === r.target)?.name}</span></button>)}</div>}
  </div>;
}
