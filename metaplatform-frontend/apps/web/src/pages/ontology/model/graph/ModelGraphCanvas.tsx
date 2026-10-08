import { useRef, useState } from 'react';
import {
  propSlug,
  type KernelObjectType,
  type KernelLinkType,
} from '@/api/ont/kernel';
type Point = { x: number; y: number };
export default function ModelGraphCanvas({
  types,
  links,
  selectedRid,
  onSelect,
  onOpen,
}: {
  types: KernelObjectType[];
  links: KernelLinkType[];
  selectedRid?: string;
  onSelect: (rid: string) => void;
  onOpen: (rid: string) => void;
}) {
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [zoom, setZoom] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ rid: string; start: Point; origin: Point } | null>(
    null,
  );
  const point = (rid: string): Point =>
    positions[rid] ?? {
      x: 45 + (types.findIndex((t) => t.rid === rid) % 3) * 280,
      y: 45 + Math.floor(types.findIndex((t) => t.rid === rid) / 3) * 230,
    };
  const width = Math.max(900, ...types.map((t) => point(t.rid).x + 260));
  const height = Math.max(530, ...types.map((t) => point(t.rid).y + 210));
  return (
    <div className="mw-canvas-wrap">
      <div className="mw-zoom" aria-label="画布操作">
        <button
          onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}
          aria-label="缩小"
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          aria-label="放大"
        >
          +
        </button>
        <button
          onClick={() =>
            setZoom(Math.min(1, (stage.current?.clientWidth ?? 900) / width))
          }
        >
          适应画布
        </button>
        <button
          onClick={() => {
            setPositions({});
            setZoom(1);
          }}
        >
          重新布局
        </button>
      </div>
      <div className="mw-canvas" ref={stage}>
        <div style={{ width: width * zoom, height: height * zoom }}>
          <div
            className="mw-canvas-plane"
            style={{
              width,
              height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg
              className="mw-edges"
              width={width}
              height={height}
              aria-label="模型关系"
            >
              {links.map((l) => {
                const a = point(l.src),
                  b = point(l.dst);
                return (
                  <g key={l.rid}>
                    <path
                      d={`M${a.x + 230},${a.y + 95} C${a.x + 265},${a.y + 95} ${b.x - 35},${b.y + 95} ${b.x},${b.y + 95}`}
                    />
                    <text x={(a.x + b.x + 230) / 2} y={(a.y + b.y) / 2 + 85}>
                      {propSlug(l.rid)}
                    </text>
                  </g>
                );
              })}
            </svg>
            {types.map((t) => (
              <button
                key={t.rid}
                aria-label={`选择模型 ${t.display_name || propSlug(t.rid)}`}
                aria-pressed={selectedRid === t.rid}
                className={`mw-model-card ${selectedRid === t.rid ? 'is-selected' : ''}`}
                style={{ left: point(t.rid).x, top: point(t.rid).y }}
                onClick={() => onSelect(t.rid)}
                onDoubleClick={() => onOpen(t.rid)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    onOpen(t.rid);
                  }
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  drag.current = {
                    rid: t.rid,
                    start: { x: e.clientX, y: e.clientY },
                    origin: point(t.rid),
                  };
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d || d.rid !== t.rid) return;
                  setPositions((p) => ({
                    ...p,
                    [t.rid]: {
                      x: Math.max(
                        0,
                        d.origin.x + (e.clientX - d.start.x) / zoom,
                      ),
                      y: Math.max(
                        0,
                        d.origin.y + (e.clientY - d.start.y) / zoom,
                      ),
                    },
                  }));
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                <strong>{t.display_name || propSlug(t.rid)}</strong>
                <small>{propSlug(t.rid)}</small>
                <ul>
                  {t.properties.slice(0, 4).map((p) => (
                    <li key={p.rid}>
                      <span>
                        {p.primary_key ? '⌑' : '·'} {p.title || propSlug(p.rid)}
                      </span>
                      <code>{p.format}</code>
                    </li>
                  ))}
                </ul>
                <footer>
                  {t.properties.length} 属性 ·{' '}
                  {
                    links.filter((l) => l.src === t.rid || l.dst === t.rid)
                      .length
                  }{' '}
                  关系
                </footer>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mw-hint">
        拖动卡片调整布局 · 双击或 Shift+Enter 打开模型 · 布局不修改模型定义
      </p>
    </div>
  );
}
