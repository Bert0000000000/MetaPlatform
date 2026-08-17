// 知识图谱 — 真实 kernel 数据版，画布为 Semi DOM 渲染（对齐 DataGraphView 先例）。
// 数据源：mate-tech-ont v2 kernel（object-types / link-types / action-types）。
// 画布：Semi Card 节点 + SVG 贝塞尔边（marker 箭头）+ CSS transform 缩放 + 滚动/拖拽平移。
// 布局：按领域分列（领域语义优先于 dagre 自动分层）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Checkbox, Input, Table, Tag } from '@douyinfe/semi-ui';
import {
  GitBranch, Boxes, Columns3, Zap, Download, ZoomIn, ZoomOut, Maximize,
  LayoutGrid, Link as LinkIcon, Database,
} from 'lucide-react';
import {
  listObjectTypes, listLinkTypes, listActionTypes, domainOfObjectType,
  slugAndVersionOfObjectType,
  type KernelObjectType, type KernelLinkType, type KernelActionType,
} from '@/api/ont/kernel';

const DOMAIN_LABELS: Record<string, string> = {
  crm: '客户关系', scm: '供应链', fin: '财务核算', org: '组织人力',
  hr: '人力资源', employee: '人事档案', 'leave-request': '请假申请',
  ticket: '工单', superai: 'SuperAI', 'dw-digital-employee': '数字员工',
};

const domainLabel = (d: string) => DOMAIN_LABELS[d] ?? d;

// 领域色（节点强调色）
const DOMAIN_COLORS = ['#60a5fa', '#62d178', '#fbbf24', '#c084fc', '#fb923c', '#4dd0e1', '#f472b6', '#a3e635', '#94a3b8'];
const domainColor = (i: number) => DOMAIN_COLORS[i % DOMAIN_COLORS.length];

// 画布常量（节点尺寸固定，边锚点依赖它）
const NODE_W = 176;
const NODE_H = 58;
const COL_W = 232;   // 列距（含节点 + 间隙）
const ROW_H = 106;   // 行距
const PAD = 48;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface Position { x: number; y: number }

/** 源节点底部中心 → 目标节点顶部中心 三次贝塞尔（列间横向/列内纵向都覆盖）。 */
function buildEdgePath(src: Position, dst: Position): string {
  const sx = src.x, sy = src.y + NODE_H / 2;
  const tx = dst.x, ty = dst.y - NODE_H / 2;
  const dy = ty - sy;
  if (Math.abs(dy) > 4) {
    const k = Math.max(32, Math.abs(dy) * 0.5);
    return `M ${sx} ${sy} C ${sx} ${sy + Math.sign(dy) * k}, ${tx} ${ty - Math.sign(dy) * k}, ${tx} ${ty}`;
  }
  const dx = tx - sx;
  return `M ${sx} ${sy} C ${sx + dx * 0.5} ${sy}, ${tx - dx * 0.5} ${ty}, ${tx} ${ty}`;
}

const edgeMidpoint = (src: Position, dst: Position): Position => ({
  x: (src.x + dst.x) / 2,
  y: (src.y + dst.y) / 2,
});

export default function OntologyGraphPage() {
  const [objectTypes, setObjectTypes] = useState<KernelObjectType[]>([]);
  const [linkTypes, setLinkTypes] = useState<KernelLinkType[]>([]);
  const [actionTypes, setActionTypes] = useState<KernelActionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [domainFilter, setDomainFilter] = useState<Record<string, boolean>>({});
  const [selectedRid, setSelectedRid] = useState('');
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean } | null>(null);
  const wasDragRef = useRef(false);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ots, lts, ats] = await Promise.all([
          listObjectTypes(),
          listLinkTypes().catch(() => [] as KernelLinkType[]),
          listActionTypes().catch(() => [] as KernelActionType[]),
        ]);
        if (!active) return;
        setObjectTypes(ots);
        setLinkTypes(lts);
        setActionTypes(ats);
        const domains = Array.from(new Set(ots.map((o) => domainOfObjectType(o.rid))));
        const init: Record<string, boolean> = {};
        domains.forEach((d) => { init[d] = true; });
        setDomainFilter(init);
        if (ots.length > 0) setSelectedRid(ots[0].rid);
      } catch (e) {
        console.warn('知识图谱数据加载失败', e);
        if (active) setLoadError(String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const domains = useMemo(
    () => Array.from(new Set(objectTypes.map((o) => domainOfObjectType(o.rid)))),
    [objectTypes],
  );

  // 领域分列布局：positions（中心坐标）+ 画布尺寸
  const layout = useMemo(() => {
    const positions = new Map<string, Position & { colorIdx: number }>();
    let di = 0;
    let maxRows = 0;
    domains.forEach((d) => {
      if (!domainFilter[d]) return;
      const items = objectTypes.filter((o) => domainOfObjectType(o.rid) === d);
      items.forEach((ot, i) => {
        positions.set(ot.rid, {
          x: PAD + di * COL_W + NODE_W / 2,
          y: PAD + i * ROW_H + NODE_H / 2,
          colorIdx: di,
        });
      });
      maxRows = Math.max(maxRows, items.length);
      di += 1;
    });
    const cols = Math.max(di, 1);
    return {
      positions,
      width: PAD * 2 + cols * COL_W,
      height: PAD * 2 + Math.max(maxRows, 1) * ROW_H,
    };
  }, [objectTypes, domainFilter, domains]);

  const edges = useMemo(
    () => linkTypes.filter((lt) => layout.positions.has(lt.src) && layout.positions.has(lt.dst)),
    [linkTypes, layout],
  );

  const kw = keyword.trim().toLowerCase();
  const matchedRids = useMemo(() => {
    if (!kw) return null;
    return new Set(
      objectTypes
        .filter((ot) => ot.display_name.toLowerCase().includes(kw) || ot.rid.toLowerCase().includes(kw))
        .map((ot) => ot.rid),
    );
  }, [objectTypes, kw]);

  const stats = useMemo(() => ({
    concepts: objectTypes.length,
    links: linkTypes.length,
    props: objectTypes.reduce((acc, o) => acc + o.properties.length, 0),
    actions: actionTypes.length,
  }), [objectTypes, linkTypes, actionTypes]);

  // ── 缩放（以视口中心为锚）──
  const zoomTo = useCallback((nextRaw: number) => {
    const next = clampZoom(nextRaw);
    const el = containerRef.current;
    const prev = zoomRef.current;
    if (el && prev !== next) {
      const cx = (el.scrollLeft + el.clientWidth / 2) / prev;
      const cy = (el.scrollTop + el.clientHeight / 2) / prev;
      zoomRef.current = next;
      setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = cx * next - el.clientWidth / 2;
        el.scrollTop = cy * next - el.clientHeight / 2;
      });
    } else {
      zoomRef.current = next;
      setZoom(next);
    }
  }, []);
  const handleZoomIn = () => zoomTo(zoomRef.current * 1.2);
  const handleZoomOut = () => zoomTo(zoomRef.current / 1.2);
  const handleFit = () => {
    const el = containerRef.current;
    if (!el) return;
    const fit = clampZoom(Math.min(el.clientWidth / layout.width, el.clientHeight / layout.height));
    zoomTo(Math.min(fit, 1));
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (layout.width * zoomRef.current - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (layout.height * zoomRef.current - el.clientHeight) / 2);
    });
  };

  // ── 拖拽平移 ──
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-node-id]')) return;
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, moved: false };
    setPanning(true);
  };
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    const el = containerRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) {
      el.scrollLeft = d.scrollLeft - dx;
      el.scrollTop = d.scrollTop - dy;
    }
  };
  const onCanvasMouseUp = () => {
    wasDragRef.current = dragRef.current?.moved ?? false;
    dragRef.current = null;
    setPanning(false);
  };
  const onCanvasClick = () => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    setSelectedRid('');
  };

  const selectedOt = objectTypes.find((o) => o.rid === selectedRid) ?? null;
  const selectedLinks = useMemo(() => {
    if (!selectedOt) return [];
    return linkTypes.filter((lt) => lt.src === selectedOt.rid || lt.dst === selectedOt.rid);
  }, [linkTypes, selectedOt]);
  const selectedActions = useMemo(() => {
    if (!selectedOt) return [];
    return actionTypes.filter((at) => at.on.includes(selectedOt.rid));
  }, [actionTypes, selectedOt]);

  const otShort = (rid: string) => {
    const ot = objectTypes.find((o) => o.rid === rid);
    return ot ? ot.display_name : (rid.split('.').slice(-2, -1)[0] ?? rid);
  };

  const exportJson = () => {
    const data = {
      nodes: Array.from(layout.positions.entries()).map(([rid]) => {
        const ot = objectTypes.find((o) => o.rid === rid);
        return { rid, display_name: ot?.display_name ?? rid };
      }),
      links: edges.map((e) => ({ rid: e.rid, src: e.src, dst: e.dst, cardinality: e.cardinality })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ontology-graph.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isDim = (rid: string) => (matchedRids ? !matchedRids.has(rid) : false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

        {/* Stat Cards（真实数据） */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <Card bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}><Boxes style={{ width: 14, height: 14, verticalAlign: -2 }} /> 概念（ObjectType）</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{loading ? '…' : stats.concepts}</div>
          </Card>
          <Card bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}><GitBranch style={{ width: 14, height: 14, verticalAlign: -2 }} /> 关系（LinkType）</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{loading ? '…' : stats.links}</div>
          </Card>
          <Card bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}><Columns3 style={{ width: 14, height: 14, verticalAlign: -2 }} /> 属性总数</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{loading ? '…' : stats.props}</div>
          </Card>
          <Card bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}><Zap style={{ width: 14, height: 14, verticalAlign: -2 }} /> 动作（ActionType）</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{loading ? '…' : stats.actions}</div>
          </Card>
        </div>

        {/* 3 列布局 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {/* LEFT: 筛选（Semi） */}
          <div style={{ width: 220, flexShrink: 0, background: 'var(--semi-color-bg-2)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 620, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>节点筛选</h3>
            <Input placeholder="搜索概念 / rid" value={keyword} onChange={(v) => setKeyword(v)} size="small" showClear />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', fontWeight: 500 }}>按领域</div>
              {domains.length === 0 && <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>暂无领域</div>}
              {domains.map((d, i) => (
                <div key={d} style={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={domainFilter[d] ?? false}
                    onChange={(e) => setDomainFilter((prev: Record<string, boolean>) => ({ ...prev, [d]: e.target.checked as boolean }))}
                  >
                    <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: domainColor(i), display: 'inline-block' }} />
                      {domainLabel(d)}
                    </span>
                  </Checkbox>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--semi-color-text-2)', background: 'var(--semi-color-fill-0)', padding: '1px 6px', borderRadius: 10 }}>
                    {objectTypes.filter((o) => domainOfObjectType(o.rid) === d).length}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <Button size="small" theme="light" style={{ flex: 1 }} onClick={() => { const init: Record<string, boolean> = {}; domains.forEach((d) => { init[d] = true; }); setDomainFilter(init); setKeyword(''); }}>重置</Button>
              <Button size="small" theme="solid" type="primary" style={{ flex: 1 }} onClick={() => handleFit()}>应用</Button>
            </div>
          </div>

          {/* CENTER: 画布（Semi DOM 渲染） */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--semi-color-bg-2)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
              <Button size="small" theme="light" icon={<ZoomIn style={{ width: 14, height: 14 }} />} onClick={() => handleZoomIn()} />
              <Button size="small" theme="light" icon={<ZoomOut style={{ width: 14, height: 14 }} />} onClick={() => handleZoomOut()} />
              <Button size="small" theme="light" icon={<Maximize style={{ width: 14, height: 14 }} />} onClick={() => handleFit()} />
              <span style={{ fontSize: 11, color: 'var(--semi-color-text-2)', fontFamily: 'var(--font-mono)', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <div style={{ width: 1, height: 18, background: 'var(--semi-color-border)' }} />
              <Button size="small" theme="light" icon={<Download style={{ width: 14, height: 14 }} />} onClick={exportJson}>导出 JSON</Button>
              <Button size="small" theme="light" icon={<LayoutGrid style={{ width: 14, height: 14 }} />} onClick={() => handleFit()}>自动布局</Button>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                {layout.positions.size} 节点 · {edges.length} 关系 · 空白处拖拽平移
              </div>
            </div>

            <div style={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 540, background: 'var(--semi-color-bg-2)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--radius)' }}>
              <div
                ref={containerRef}
                style={{ position: 'absolute', inset: 0, overflow: 'auto', cursor: panning ? 'grabbing' : 'default', userSelect: panning ? 'none' : 'auto' }}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                onClick={onCanvasClick}
              >
                {/* 缩放视口：占位真实尺寸保证滚动条正确 */}
                <div style={{ position: 'relative', width: layout.width * zoom, height: layout.height * zoom }}>
                  {/* world 层：transform scale */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                    {/* SVG 边层 */}
                    <svg width={layout.width} height={layout.height} style={{ position: 'absolute', left: 0, top: 0, zIndex: 0, pointerEvents: 'none', overflow: 'visible' }}>
                      <defs>
                        <marker id="og-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                          <path d="M 0 0 L 9 4.5 L 0 9 Z" style={{ fill: 'var(--semi-color-border)' }} />
                        </marker>
                        <marker id="og-arrow-active" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                          <path d="M 0 0 L 9 4.5 L 0 9 Z" style={{ fill: 'var(--semi-color-primary)' }} />
                        </marker>
                      </defs>
                      {edges.map((lt) => {
                        const s = layout.positions.get(lt.src);
                        const t = layout.positions.get(lt.dst);
                        if (!s || !t) return null;
                        const isRelated = selectedRid ? lt.src === selectedRid || lt.dst === selectedRid : false;
                        const dimmed = (isDim(lt.src) || isDim(lt.dst)) || (selectedRid ? !isRelated : false);
                        const mid = edgeMidpoint(s, t);
                        const label = (lt.rid.split('.').slice(-2, -1)[0] ?? '') + (lt.cardinality ? ` ${lt.cardinality}` : '');
                        return (
                          <g key={lt.rid} opacity={dimmed ? 0.15 : 1}>
                            <path
                              d={buildEdgePath(s, t)}
                              fill="none"
                              stroke={isRelated ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}
                              strokeWidth={isRelated ? 2 : 1.4}
                              strokeDasharray="4 3"
                              markerEnd={isRelated ? 'url(#og-arrow-active)' : 'url(#og-arrow)'}
                            />
                            <text
                              x={mid.x} y={mid.y - 4} textAnchor="middle"
                              fontSize={10} fill="var(--semi-color-text-2)"
                              stroke="var(--semi-color-bg-2)" strokeWidth={3} paintOrder="stroke"
                            >
                              {label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {/* DOM 节点层：Semi Card */}
                    {Array.from(layout.positions.entries()).map(([rid, pos]) => {
                      const ot = objectTypes.find((o) => o.rid === rid);
                      if (!ot) return null;
                      const color = domainColor(pos.colorIdx);
                      const isSel = rid === selectedRid;
                      const dim = isDim(rid);
                      return (
                        <div
                          key={rid}
                          data-node-id={rid}
                          style={{
                            position: 'absolute',
                            left: pos.x - NODE_W / 2,
                            top: pos.y - NODE_H / 2,
                            zIndex: isSel ? 3 : 2,
                            opacity: dim ? 0.25 : 1,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                        <div onClick={(e) => { e.stopPropagation(); setSelectedRid(rid); }} style={{ cursor: 'pointer' }}>
                          <Card
                            bordered
                            style={{
                              width: NODE_W,
                              borderColor: isSel ? color : undefined,
                              boxShadow: isSel ? `0 0 0 2px ${color}40` : undefined,
                            }}
                            bodyStyle={{ padding: '8px 12px' }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ot.display_name}</div>
                            <div style={{ fontSize: 10, color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                              {domainLabel(domainOfObjectType(rid))} · {ot.properties.length} 属性
                            </div>
                          </Card>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 空态 */}
                {!loading && layout.positions.size === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--semi-color-text-2)', zIndex: 20 }}>
                    {objectTypes.length === 0 ? '暂无本体概念数据' : '无匹配节点，请调整筛选条件'}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, padding: '10px 16px', background: 'var(--semi-color-bg-2)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--radius)', flexWrap: 'wrap', fontSize: 12, color: 'var(--semi-color-text-2)' }}>
              <span>领域数 <b style={{ color: 'var(--semi-color-text-0)' }}>{domains.length}</b></span>
              <span>|</span>
              <span>展示节点 <b style={{ color: 'var(--semi-color-text-0)' }}>{layout.positions.size}</b> / {objectTypes.length}</span>
              <span>|</span>
              <span>展示关系 <b style={{ color: 'var(--semi-color-text-0)' }}>{edges.length}</b> / {linkTypes.length}</span>
              <span style={{ marginLeft: 'auto' }}>布局：按领域分列</span>
            </div>
          </div>

          {/* RIGHT: 详情面板（真实 ObjectType） */}
          <div style={{ width: 320, flexShrink: 0, background: 'var(--semi-color-bg-2)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 620, overflowY: 'auto' }}>
            {!selectedOt ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--semi-color-text-2)', fontSize: 13 }}>点击画布中的节点查看概念详情</div>
            ) : (
              <>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{selectedOt.display_name}</h3>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--semi-color-text-2)', marginTop: 4, wordBreak: 'break-all' }}>{selectedOt.rid}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag color="blue" size="small">{domainLabel(domainOfObjectType(selectedOt.rid))}</Tag>
                  <Tag color="cyan" size="small">v{slugAndVersionOfObjectType(selectedOt.rid).version || '—'}</Tag>
                  <Tag size="small">{selectedOt.properties.length} 属性</Tag>
                </div>
                {/* 属性列表（Semi Table） */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--semi-color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>属性列表</div>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="rid"
                    dataSource={selectedOt.properties.map((p) => ({
                      rid: p.rid,
                      name: p.rid.split('.').slice(-2, -1)[0] ?? p.rid,
                      type_id: p.type_id,
                      pk: p.primary_key,
                    }))}
                    columns={[
                      { title: '属性名', dataIndex: 'name', width: 110, render: (v: string) => <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{v}</span> },
                      {
                        title: '类型', dataIndex: 'type_id',
                        render: (v: string, r: { pk: boolean }) => (
                          <span>
                            <Tag size="small" style={{ fontFamily: 'var(--font-mono)' }}>{v}</Tag>
                            {r.pk && <Tag color="green" size="small" style={{ marginLeft: 4 }}>主键</Tag>}
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
                {/* 关联关系 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--semi-color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LinkIcon style={{ width: 13, height: 13 }} /> 关联关系 <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{selectedLinks.length}</span>
                  </div>
                  {selectedLinks.length === 0 && <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>暂无关系</div>}
                  {selectedLinks.map((lt) => {
                    const outgoing = lt.src === selectedOt.rid;
                    return (
                      <div key={lt.rid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--semi-color-fill-0)', borderRadius: 'var(--radius)', fontSize: 12, cursor: 'pointer' }}
                        onClick={() => setSelectedRid(outgoing ? lt.dst : lt.src)}>
                        <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(lt.rid.split('.').slice(-2, -1)[0] ?? '')}
                        </span>
                        <span style={{ color: 'var(--semi-color-text-2)', fontSize: 11 }}>{outgoing ? '→' : '←'} {otShort(outgoing ? lt.dst : lt.src)}</span>
                        <span style={{ fontSize: 11, color: 'var(--semi-color-text-2)' }}>{lt.cardinality}</span>
                      </div>
                    );
                  })}
                </div>
                {/* 关联 Action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--semi-color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap style={{ width: 13, height: 13 }} /> 关联动作 <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{selectedActions.length}</span>
                  </div>
                  {selectedActions.length === 0 && <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>暂无关联 Action</div>}
                  {selectedActions.map((at) => (
                    <div key={at.rid} title={at.rid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--semi-color-fill-0)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                      <Database style={{ width: 12, height: 12, color: 'var(--semi-color-text-2)' }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{at.title || at.rid.split('.').slice(-2, -1)[0]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {loadError && (
          <Card bodyStyle={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--semi-color-danger)' }}>知识图谱数据加载失败：{loadError}</div>
          </Card>
        )}
      </div>
    </div>
  );
}
