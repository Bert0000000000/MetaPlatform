// SemiGraphCanvas — Semi DOM 渲染的关系图画布（@antv/x6 / G6 替代件）。
// 节点 = 定位 div + Semi Card（或椭圆 span）；边 = SVG 贝塞尔 + marker 箭头。
// 缩放 = CSS transform scale（视口中心锚定）；平移 = 原生滚动 + 空白拖拽。
// 坐标系：节点 x/y 为中心坐标；worldWidth/worldHeight 为布局世界尺寸。

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@douyinfe/semi-ui';

export interface GraphNodeSpec {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sublabel?: string;
  /** 强调色：边框/文字/椭圆描边 */
  color?: string;
  /** true = color 作背景 + 白字（根/主节点） */
  solid?: boolean;
  shape?: 'rect' | 'ellipse';
  /** 虚线边框（如「有被折叠的邻居」） */
  dashed?: boolean;
  selected?: boolean;
  dim?: boolean;
  /** 椭圆模式下标签放在形状下方（矩形恒为卡内） */
  labelBelow?: boolean;
  title?: string;
}

export interface GraphEdgeSpec {
  id?: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  dashed?: boolean;
  width?: number;
  highlighted?: boolean;
  dim?: boolean;
}

interface Props {
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
  worldWidth: number;
  worldHeight: number;
  height: number;
  /** 容器宽度；缺省 100% */
  width?: number | string;
  /** 数据/尺寸变化后自动 zoomToFit（含挂载时） */
  autoFit?: boolean;
  /** 外部重置信号：值变化时 zoom→1 并回到世界中心 */
  resetSignal?: number;
  /** 点阵网格背景 */
  showGrid?: boolean;
  /** 缩放范围 */
  minZoom?: number;
  maxZoom?: number;
  onNodeClick?: (id: string) => void;
  onNodeDblClick?: (id: string) => void;
  style?: React.CSSProperties;
  /** 画布背景（默认透明，由容器背景决定） */
  background?: string;
}

const DEFAULT_W = 140;
const DEFAULT_H = 44;

const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** 源节点边缘 → 目标节点边缘 三次贝塞尔（纵向/横向均覆盖）。 */
export function buildEdgePath(
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number,
): string {
  const x1 = sx, y1 = sy + sh / 2;
  const x2 = tx, y2 = ty - th / 2;
  const dy = y2 - y1;
  if (Math.abs(dy) > 4) {
    const k = Math.max(32, Math.abs(dy) * 0.5);
    const s = Math.sign(dy);
    return `M ${x1} ${y1} C ${x1} ${y1 + s * k}, ${x2} ${y2 - s * k}, ${x2} ${y2}`;
  }
  const dx = x2 - x1;
  const sgn = Math.sign(dx) || 1;
  return `M ${x1} ${y1} C ${x1 + sgn * Math.max(24, Math.abs(dx) * 0.4)} ${y1}, ${x2 - sgn * Math.max(24, Math.abs(dx) * 0.4)} ${y2}, ${x2} ${y2}`;
}

export default function SemiGraphCanvas({
  nodes, edges, worldWidth, worldHeight, height, width,
  autoFit = false, resetSignal = 0, showGrid = false, minZoom = 0.3, maxZoom = 3,
  onNodeClick, onNodeDblClick, style, background,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean } | null>(null);
  const wasDragRef = useRef(false);
  const lastClickRef = useRef<{ id: string; t: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const [fitted, setFitted] = useState(false);

  const clamp = useCallback((z: number) => Math.min(maxZoom, Math.max(minZoom, z)), [minZoom, maxZoom]);

  const zoomTo = useCallback((nextRaw: number) => {
    const next = clamp(nextRaw);
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
  }, [clamp]);

  /** 暴露给父组件（通过 ref 转发场景少，这里挂在 DOM 上给工具栏用）。 */
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      (el as HTMLDivElement & { __fitView?: () => void }).__fitView = () => {
        const w = worldWidth, h = worldHeight;
        const fit = clamp(Math.min(el.clientWidth / w, el.clientHeight / h));
        zoomTo(Math.min(fit, 1));
        requestAnimationFrame(() => {
          el.scrollLeft = Math.max(0, (w * zoomRef.current - el.clientWidth) / 2);
          el.scrollTop = Math.max(0, (h * zoomRef.current - el.clientHeight) / 2);
        });
      };
    }
  }, [worldWidth, worldHeight, zoomTo, clamp]);

  useEffect(() => {
    if (!autoFit || !containerRef.current) return;
    const el = containerRef.current;
    const raf = requestAnimationFrame(() => {
      if (el.clientWidth === 0) return; // 容器未布局，等下次
      const fit = clamp(Math.min(el.clientWidth / worldWidth, el.clientHeight / worldHeight));
      zoomTo(Math.min(fit, 1));
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, (worldWidth * zoomRef.current - el.clientWidth) / 2);
        el.scrollTop = Math.max(0, (worldHeight * zoomRef.current - el.clientHeight) / 2);
      });
      setFitted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [autoFit, worldWidth, worldHeight, nodes, edges, zoomTo, clamp]);

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-node-id]')) return;
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, moved: false };
    setPanning(true);
  };

  // 外部重置信号：zoom → 1 并回到世界中心
  useEffect(() => {
    if (resetSignal === 0) return;
    const el = containerRef.current;
    if (!el) return;
    zoomTo(1);
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (worldWidth - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (worldHeight - el.clientHeight) / 2);
    });
  }, [resetSignal, worldWidth, worldHeight, zoomTo]);
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

  const handleNodeClick = (id: string) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === id && now - last.t < 350) {
      lastClickRef.current = null;
      onNodeDblClick?.(id);
      return;
    }
    lastClickRef.current = { id, t: now };
    onNodeClick?.(id);
  };

  const nodePos = new Map(nodes.map((n) => [n.id, n]));
  const markerId = (active: boolean) => `sgc-arrow${active ? '-active' : ''}`;
  const uid = useRef(`sgc${Math.floor(Math.random() * 100000)}`).current;

  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden', width: width ?? '100%', height,
        border: '1px solid var(--semi-color-border)', borderRadius: 8,
        background: background ?? 'var(--semi-color-bg-2)',
        backgroundImage: showGrid
          ? 'radial-gradient(circle, var(--semi-color-border) 1px, transparent 1px)'
          : undefined,
        backgroundSize: showGrid ? '16px 16px' : undefined,
        ...style,
      }}
    >
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, overflow: 'auto', cursor: panning ? 'grabbing' : 'default', userSelect: panning ? 'none' : 'auto' }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
      >
        <div style={{ position: 'relative', width: worldWidth * zoom, height: worldHeight * zoom }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: worldWidth, height: worldHeight, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg width={worldWidth} height={worldHeight} style={{ position: 'absolute', left: 0, top: 0, zIndex: 0, pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id={`${uid}-arrow`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M 0 0 L 9 4.5 L 0 9 Z" style={{ fill: 'var(--semi-color-border)' }} />
                </marker>
                <marker id={`${uid}-arrow-active`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M 0 0 L 9 4.5 L 0 9 Z" style={{ fill: 'var(--semi-color-primary)' }} />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const s = nodePos.get(e.source);
                const t = nodePos.get(e.target);
                if (!s || !t) return null;
                const active = e.highlighted;
                const color = active ? 'var(--semi-color-primary)' : (e.color ?? 'var(--semi-color-border)');
                const m = mid(s, t);
                return (
                  <g key={e.id ?? i} opacity={e.dim ? 0.15 : 1}>
                    <path
                      d={buildEdgePath(s.x, s.y, s.w ?? DEFAULT_W, s.h ?? DEFAULT_H, t.x, t.y, t.w ?? DEFAULT_W, t.h ?? DEFAULT_H)}
                      fill="none"
                      stroke={color}
                      strokeWidth={e.width ?? (active ? 2 : 1.4)}
                      strokeDasharray={e.dashed ? '5 3' : undefined}
                      markerEnd={`url(#${uid}-${markerId(!!active)})`}
                    />
                    {e.label && (
                      <text x={m.x} y={m.y - 4} textAnchor="middle" fontSize={10}
                        fill={active ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)'}
                        stroke="var(--semi-color-bg-2)" strokeWidth={3} paintOrder="stroke">
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {nodes.map((n) => {
              const w = n.w ?? DEFAULT_W, h = n.h ?? DEFAULT_H;
              const color = n.color ?? 'var(--semi-color-primary)';
              if (n.shape === 'ellipse') {
                const rx = w / 2, ry = h / 2;
                return (
                  <div key={n.id} data-node-id={n.id}
                    onClick={(e) => { e.stopPropagation(); handleNodeClick(n.id); }}
                    title={n.title ?? n.label}
                    style={{
                      position: 'absolute', left: n.x - rx, top: n.y - ry, width: w,
                      zIndex: n.selected ? 3 : 2, opacity: n.dim ? 0.25 : 1, cursor: 'pointer',
                    }}>
                    <div style={{
                      width: w, height: h, borderRadius: '50%',
                      background: n.solid ? color : `${color}33`,
                      border: `${n.selected ? 3 : 2}px ${n.dashed ? 'dashed' : 'solid'} ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, overflow: 'hidden',
                      color: 'var(--semi-color-text-0)', padding: 2, textAlign: 'center',
                    }}>
                      {n.label.length > 8 ? n.label.slice(0, 7) + '…' : n.label}
                    </div>
                    {n.labelBelow && (
                      <div style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: 'var(--semi-color-text-2)', fontWeight: n.solid ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={n.id} data-node-id={n.id}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(n.id); }}
                  title={n.title ?? n.label}
                  style={{
                    position: 'absolute', left: n.x - w / 2, top: n.y - h / 2,
                    zIndex: n.selected ? 3 : 2, opacity: n.dim ? 0.25 : 1, cursor: 'pointer',
                  }}>
                  <Card
                    bordered
                    style={{
                      width: w,
                      borderColor: n.selected ? color : (n.color && n.solid ? color : undefined),
                      borderStyle: n.dashed ? 'dashed' : undefined,
                      boxShadow: n.selected ? `0 0 0 2px ${n.solid ? color : color + '55'}` : undefined,
                      background: n.solid ? color : undefined,
                    }}
                    bodyStyle={{ padding: '6px 10px', textAlign: 'center' }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      color: n.solid ? '#fff' : (n.color ?? 'var(--semi-color-text-0)'),
                    }}>{n.label}</div>
                    {n.sublabel && (
                      <div style={{ fontSize: 10, color: n.solid ? 'rgba(255,255,255,0.8)' : 'var(--semi-color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.sublabel}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 由节点/边规格生成独立 SVG 字符串（用于导出 SVG/PNG；节点用 foreignObject 内嵌）。 */
export function graphSpecsToSvg(nodes: GraphNodeSpec[], edges: GraphEdgeSpec[], worldWidth: number, worldHeight: number): string {
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const edgeSvg = edges.map((e) => {
    const s = pos.get(e.source); const t = pos.get(e.target);
    if (!s || !t) return '';
    const d = buildEdgePath(s.x, s.y, s.w ?? DEFAULT_W, s.h ?? DEFAULT_H, t.x, t.y, t.w ?? DEFAULT_W, t.h ?? DEFAULT_H);
    const m = mid(s, t);
    return `<path d="${d}" fill="none" stroke="${e.color ?? '#999'}" stroke-width="${e.width ?? 1.4}" ${e.dashed ? 'stroke-dasharray="5 3"' : ''} marker-end="url(#exp-arrow)"/>`
      + (e.label ? `<text x="${m.x}" y="${m.y - 4}" text-anchor="middle" font-size="10" fill="#666">${e.label}</text>` : '');
  }).join('');
  const nodeSvg = nodes.map((n) => {
    const w = n.w ?? DEFAULT_W, h = n.h ?? DEFAULT_H;
    const color = n.color ?? '#1677ff';
    if (n.shape === 'ellipse') {
      return `<ellipse cx="${n.x}" cy="${n.y}" rx="${w / 2}" ry="${h / 2}" fill="${n.solid ? color : color + '33'}" stroke="${color}" stroke-width="2"/>`
        + `<text x="${n.x}" y="${n.y + h / 2 + 14}" text-anchor="middle" font-size="11" fill="#333">${n.label}</text>`;
    }
    return `<foreignObject x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h + 4}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;box-sizing:border-box;border:1px solid ${color};border-radius:6px;background:${n.solid ? color : '#fff'};color:${n.solid ? '#fff' : color};font-size:12px;font-weight:600;text-align:center;padding:6px 8px;font-family:sans-serif;overflow:hidden">${n.label}</div>`
      + `</foreignObject>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${worldWidth}" height="${worldHeight}" viewBox="0 0 ${worldWidth} ${worldHeight}"><defs><marker id="exp-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 9 4.5 L 0 9 Z" fill="#999"/></marker></defs><rect width="100%" height="100%" fill="#fafafa"/>${edgeSvg}${nodeSvg}</svg>`;
}

/** 导出 PNG：SVG → Image → canvas。返回 dataURL。 */
export async function graphSpecsToPngDataUrl(svg: string): Promise<string> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 800;
    canvas.height = img.height || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
