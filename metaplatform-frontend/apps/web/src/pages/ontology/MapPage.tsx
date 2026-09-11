// MapPage - 地理空间探索（L6 应用层，Palantir Map 对位）。
//
// 瓦片式轻量地图（不引入 leaflet 等第三方库）：
//   底图：OpenStreetMap tile（https://tile.openstreetmap.org/{z}/{x}/{y}.png，
//         <img> 网格拼接；z 初始 11，+/- 按钮与滚轮缩放）
//   投影：标准 Web Mercator
//         x = (lon+180)/360 × 2^z × 256
//         y = (1-ln(tan(lat°)+sec(lat°))/π)/2 × 2^z × 256
//   实例：类型选择 → format=latlon / geojson 属性 → POST /object-query
//         （source, paging_limit: 1000）拉全量实例；
//         latlon 画 pin（circle + label）；geojson Polygon 画 SVG path
//   交互：pointer 拖拽平移 / 滚轮缩放（光标锚定）/ 点击 pin 弹属性摘要卡
//   降级：OSM 瓦片加载失败（内网/无网）→ 经纬网格线 + 实例点（离线可用）
//
// 纪律：原生 button/select + 内联样式 + CSS 变量。

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Card } from '@douyinfe/semi-ui';
import {
  Layers, Loader2, MapPin, Minus, Plus, WifiOff, X,
} from 'lucide-react';
import {
  errDetailText, getObjectQueryRows, getObjectType, listObjectTypes, propSlug,
  type KernelObjectType, type KernelProperty,
} from '@/api/ont/kernel';

// ── 常量 ──

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 17;
const INIT_Z = 11;
/** Web Mercator 纬度极限。 */
const MAX_LAT = 85.05112878;
/** 数据加载前 / 无地理数据时的默认中心（上海）。 */
const DEFAULT_CENTER = { lat: 31.2304, lon: 121.4737 };
/** 地图视口固定高。 */
const VIEWPORT_H = 560;
/** pin 标签渲染上限（点多时只画点不画字）。 */
const LABEL_LIMIT = 120;

// ── 投影（Web Mercator：经纬度 ↔ z 级世界像素） ──

function lonToX(lon: number, z: number): number {
  return ((lon + 180) / 360) * TILE * 2 ** z;
}

function latToY(lat: number, z: number): number {
  const l = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const s = Math.sin((l * Math.PI) / 180);
  // ln(tan+sec) = atanh(sin) = 0.5·ln((1+s)/(1-s))
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
}

function xToLon(x: number, z: number): number {
  return (x / (TILE * 2 ** z)) * 360 - 180;
}

function yToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** z);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

interface View {
  z: number;
  /** 视口左上角对应的世界像素坐标。 */
  ox: number;
  oy: number;
}

function clampView(z: number, ox: number, oy: number, vw: number, vh: number): { ox: number; oy: number } {
  const size = TILE * 2 ** z;
  const nOx = size <= vw ? (vw - size) / 2 : Math.max(vw - size, Math.min(0, ox));
  const nOy = size <= vh ? (vh - size) / 2 : Math.max(vh - size, Math.min(0, oy));
  return { ox: nOx, oy: nOy };
}

// ── 地理数据解析 ──

/** latlon 属性值：(纬, 经) 二元组；兼容数组 / 对象 / 字符串形态。 */
function parseLatLon(v: unknown): { lat: number; lon: number } | null {
  if (Array.isArray(v) && v.length >= 2) {
    const lat = Number(v[0]);
    const lon = Number(v[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const lat = Number(o.lat ?? o.latitude ?? o.y);
    const lon = Number(o.lon ?? o.lng ?? o.longitude ?? o.x);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  }
  if (typeof v === 'string') {
    const parts = v.split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n));
    if (parts.length >= 2) return { lat: parts[0]!, lon: parts[1]! };
  }
  return null;
}

/** GeoJSON 值：Point → 点；Polygon / MultiPolygon → 外环折线（坐标序 [lon, lat]）。 */
function parseGeoJson(v: unknown): { point?: { lat: number; lon: number }; rings?: Array<Array<{ lat: number; lon: number }>> } | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as { type?: unknown; coordinates?: unknown };
  if (typeof g.type !== 'string' || g.coordinates === undefined) return null;
  const parseLL = (c: unknown): { lat: number; lon: number } | null => {
    if (Array.isArray(c) && c.length >= 2) {
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return null;
  };
  const ringOf = (ring: unknown): Array<{ lat: number; lon: number }> =>
    (Array.isArray(ring) ? ring.map(parseLL).filter((p): p is { lat: number; lon: number } => p !== null) : []);

  if (g.type === 'Point') {
    const p = parseLL(g.coordinates);
    return p ? { point: p } : null;
  }
  if (g.type === 'Polygon') {
    const rings = Array.isArray(g.coordinates) ? (g.coordinates as unknown[]).map(ringOf) : [];
    return rings[0] && rings[0].length >= 3 ? { rings } : null;
  }
  if (g.type === 'MultiPolygon') {
    const rings: Array<Array<{ lat: number; lon: number }>> = [];
    (Array.isArray(g.coordinates) ? g.coordinates : []).forEach((poly) => {
      if (!Array.isArray(poly) || !Array.isArray(poly[0])) return;
      const outer = ringOf(poly[0]);
      if (outer.length >= 3) rings.push(outer);
    });
    return rings.length > 0 ? { rings } : null;
  }
  return null;
}

interface GeoPoint {
  rid: string;
  label: string;
  lat: number;
  lon: number;
  row: Record<string, unknown>;
}

interface GeoPolygon {
  rid: string;
  label: string;
  rings: Array<Array<{ lat: number; lon: number }>>;
  center: { lat: number; lon: number };
  row: Record<string, unknown>;
}

function isGeoProp(p: KernelProperty): boolean {
  return p.format === 'latlon' || p.format === 'geojson';
}

function shortRid(rid: string): string {
  const parts = rid.split('.');
  return parts.length >= 2 ? parts[parts.length - 2]! : rid;
}

const selectStyle = {
  height: 30, background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0 8px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none', cursor: 'pointer',
} as const;

const zoomBtnStyle = {
  width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', background: 'var(--card)', borderRadius: 6,
  color: 'var(--foreground)', cursor: 'pointer', padding: 0,
} as const;

export default function MapPage() {
  // ── 类型 / 属性 / 实例数据 ──
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedType, setSelectedType] = useState('');
  const [detail, setDetail] = useState<KernelObjectType | null>(null);
  const [geoSlug, setGeoSlug] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [err, setErr] = useState('');

  // ── 地图视图 ──
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [vpSize, setVpSize] = useState({ w: 900, h: VIEWPORT_H });
  const [view, setView] = useState<View>(() => ({
    z: INIT_Z,
    ox: lonToX(DEFAULT_CENTER.lon, INIT_Z) - 450,
    oy: latToY(DEFAULT_CENTER.lat, INIT_Z) - VIEWPORT_H / 2,
  }));
  const viewRef = useRef(view);
  viewRef.current = view;
  const vpRef = useRef(vpSize);
  vpRef.current = vpSize;
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  /** 拖拽位移超过该阈值视为平移（否则算点击 → 关闭摘要卡）。 */
  const dragMovedRef = useRef(false);

  // ── 降级 / 交互 ──
  const [tilesOffline, setTilesOffline] = useState(false);
  const [selected, setSelected] = useState<GeoPoint | GeoPolygon | null>(null);
  const fittedKeyRef = useRef('');

  const applyView = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
  }, []);

  // 类型清单 + 自动选中第一个含地理属性的类型
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ots = await listObjectTypes();
        if (cancelled) return;
        setTypes(ots);
        setSelectedType((prev) => {
          if (prev && ots.some((t) => t.rid === prev)) return prev;
          const withGeo = ots.find((t) => t.properties.some(isGeoProp));
          return (withGeo ?? ots[0])?.rid ?? '';
        });
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 选中类型 → 详情 + 地理属性 + 全量实例（paging_limit 1000）
  useEffect(() => {
    if (!selectedType) return;
    let cancelled = false;
    setRows([]);
    setSelected(null);
    setErr('');
    setLoadingRows(true);
    (async () => {
      try {
        const ot = await getObjectType(selectedType);
        if (cancelled) return;
        setDetail(ot);
        const geo = ot.properties.filter(isGeoProp);
        const preferred = geo.find((p) => p.format === 'latlon') ?? geo[0];
        setGeoSlug((cur) => {
          if (cur && geo.some((p) => propSlug(p.rid) === cur)) return cur;
          return preferred ? propSlug(preferred.rid) : '';
        });
        const res = await getObjectQueryRows({ source: selectedType, paging_limit: 1000 });
        if (cancelled) return;
        setRows(res.kind === 'objects' ? res.rows : []);
      } catch (e) {
        if (!cancelled) setErr(errDetailText(e, '实例加载失败'));
      } finally {
        if (!cancelled) setLoadingRows(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedType]);

  // 视口尺寸测量（容器 resize 跟随）
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setVpSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geoProps = useMemo(
    () => (detail?.properties ?? []).filter(isGeoProp), [detail],
  );
  const geoFormat = useMemo(
    () => geoProps.find((p) => propSlug(p.rid) === geoSlug)?.format ?? '',
    [geoProps, geoSlug],
  );

  // 实例 → 地理要素（点 / 多边形）
  const { points, polygons } = useMemo(() => {
    const pts: GeoPoint[] = [];
    const polys: GeoPolygon[] = [];
    if (!geoSlug || rows.length === 0) return { points: pts, polygons: polys };
    const pkSlug = detail?.primary_key?.[0] ? propSlug(detail.primary_key[0]) : '';
    rows.forEach((row) => {
      const rid = String(row.__rid__ ?? '');
      const label = pkSlug && row[pkSlug] !== undefined && row[pkSlug] !== null
        ? String(row[pkSlug]) : shortRid(rid);
      const v = row[geoSlug];
      if (geoFormat === 'latlon') {
        const ll = parseLatLon(v);
        if (ll) pts.push({ rid, label, lat: ll.lat, lon: ll.lon, row });
        return;
      }
      if (geoFormat === 'geojson') {
        const g = parseGeoJson(v);
        if (!g) return;
        if (g.point) {
          pts.push({ rid, label, lat: g.point.lat, lon: g.point.lon, row });
          return;
        }
        if (g.rings) {
          // 外环代表点（质心）作点击锚
          const ring = g.rings[0]!;
          const cLat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
          const cLon = ring.reduce((s, p) => s + p.lon, 0) / ring.length;
          polys.push({ rid, label, rings: g.rings, center: { lat: cLat, lon: cLon }, row });
        }
      }
    });
    return { points: pts, polygons: polys };
  }, [rows, geoSlug, geoFormat, detail]);

  // 自动 fit：数据首次就绪后框住全部要素
  const fitToData = useCallback((pts: GeoPoint[], polys: GeoPolygon[]): boolean => {
    const { w, h } = vpRef.current;
    if (w < 50 || h < 50) return false;
    const lats: number[] = [];
    const lons: number[] = [];
    pts.forEach((p) => { lats.push(p.lat); lons.push(p.lon); });
    polys.forEach((poly) => poly.rings.forEach((ring) => ring.forEach((pt) => {
      lats.push(pt.lat);
      lons.push(pt.lon);
    })));
    if (lats.length === 0) {
      const z = INIT_Z;
      applyView({
        z,
        ox: lonToX(DEFAULT_CENTER.lon, z) - w / 2,
        oy: latToY(DEFAULT_CENTER.lat, z) - h / 2,
      });
      return true;
    }
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    let z = MAX_Z;
    while (z > MIN_Z
      && (lonToX(maxLon, z) - lonToX(minLon, z) > w * 0.85
        || latToY(minLat, z) - latToY(maxLat, z) > h * 0.85)) {
      z -= 1;
    }
    const c = clampView(
      z,
      lonToX((minLon + maxLon) / 2, z) - w / 2,
      latToY((minLat + maxLat) / 2, z) - h / 2,
      w, h,
    );
    applyView({ z, ox: c.ox, oy: c.oy });
    return true;
  }, [applyView]);

  useEffect(() => {
    const key = `${selectedType}|${geoSlug}`;
    if (fittedKeyRef.current === key || loadingRows || !geoSlug) return;
    if (fitToData(points, polygons)) fittedKeyRef.current = key;
  }, [selectedType, geoSlug, loadingRows, points, polygons, fitToData]);

  // 缩放（光标锚定：保持光标下的地理点不动）
  const zoomAt = useCallback((px: number, py: number, dz: number) => {
    const v = viewRef.current;
    const z2 = Math.max(MIN_Z, Math.min(MAX_Z, v.z + dz));
    if (z2 === v.z) return;
    const k = 2 ** (z2 - v.z);
    const c = clampView(z2, (v.ox + px) * k - px, (v.oy + py) * k - py, vpRef.current.w, vpRef.current.h);
    applyView({ z: z2, ox: c.ox, oy: c.oy });
  }, [applyView]);

  // 滚轮缩放须 preventDefault → 原生监听（React onWheel 是 passive）
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // 可见瓦片（<img> 网格）
  const tiles = useMemo(() => {
    if (tilesOffline) return [];
    const n = 2 ** view.z;
    const out: Array<{ key: string; src: string; left: number; top: number }> = [];
    const tx0 = Math.max(0, Math.floor(view.ox / TILE));
    const tx1 = Math.min(n - 1, Math.floor((view.ox + vpSize.w) / TILE));
    const ty0 = Math.max(0, Math.floor(view.oy / TILE));
    const ty1 = Math.min(n - 1, Math.floor((view.oy + vpSize.h) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        out.push({
          key: `${view.z}/${tx}/${ty}`,
          src: `https://tile.openstreetmap.org/${view.z}/${tx}/${ty}.png`,
          left: tx * TILE - view.ox,
          top: ty * TILE - view.oy,
        });
      }
    }
    return out;
  }, [view, vpSize, tilesOffline]);

  // 离线降级：经纬网格线（graticule）
  const graticule = useMemo(() => {
    if (!tilesOffline) return null;
    const { z, ox, oy } = view;
    const lonL = xToLon(ox, z);
    const lonR = xToLon(ox + vpSize.w, z);
    const latT = yToLat(oy, z);
    const latB = yToLat(oy + vpSize.h, z);
    const pxPerDeg = (TILE * 2 ** z) / 360;
    const steps = [30, 15, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02];
    const step = steps.find((s) => s * pxPerDeg >= 80) ?? 0.02;
    const vLines: Array<{ x: number; label: string }> = [];
    for (let lon = Math.ceil(lonL / step) * step; lon <= lonR; lon += step) {
      vLines.push({ x: lonToX(lon, z) - ox, label: `${lon.toFixed(step < 1 ? 2 : 0)}°E` });
    }
    const hLines: Array<{ y: number; label: string }> = [];
    for (let lat = Math.ceil(latB / step) * step; lat <= latT; lat += step) {
      hLines.push({ y: latToY(lat, z) - oy, label: `${lat.toFixed(step < 1 ? 2 : 0)}°N` });
    }
    return { vLines, hLines };
  }, [tilesOffline, view, vpSize]);

  // 属性摘要卡内容（前 6 个属性）
  const popupProps = useMemo(() => {
    if (!selected || !detail) return [];
    return detail.properties.slice(0, 6).map((p) => {
      const slug = propSlug(p.rid);
      const v = selected.row[slug];
      return {
        title: p.title || slug,
        value: v === null || v === undefined ? '—'
          : typeof v === 'object' ? JSON.stringify(v) : String(v),
      };
    });
  }, [selected, detail]);

  const selAnchor = selected
    ? ('lat' in selected ? selected : selected.center)
    : null;

  const selectedTypeHasGeo = detail ? geoProps.length > 0 : false;
  const typeListLoading = loadingTypes;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* 左栏：类型选择 */}
      <div style={{ width: 240, flexShrink: 0 }}>
        <Card style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>对象类型</h3>
          {typeListLoading ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Loader2 style={{ width: 12, height: 12, animation: 'osp-spin 1s linear infinite' }} /> 加载中…
            </div>
          ) : types.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>暂无类型</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 520, overflowY: 'auto' }}>
              {types.map((t) => {
                const hasGeo = t.properties.some(isGeoProp);
                return (
                  <li key={t.rid}>
                    <button
                      type="button"
                      onClick={() => setSelectedType(t.rid)}
                      title={t.rid}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', fontSize: 12, textAlign: 'left',
                        border: 'none', borderRadius: 6, cursor: 'pointer',
                        background: t.rid === selectedType ? 'var(--muted)' : 'transparent',
                        color: t.rid === selectedType ? 'var(--foreground)' : 'var(--muted-foreground)',
                      }}
                    >
                      {hasGeo
                        ? <MapPin style={{ width: 12, height: 12, flexShrink: 0, color: '#f59e0b' }} />
                        : <span style={{ width: 12, height: 12, flexShrink: 0, borderRadius: 2, background: 'var(--muted-foreground)', opacity: 0.4 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.display_name || t.rid}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* 右栏：地图 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
          {/* 工具栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {detail?.display_name ?? '地图'}
            </span>
            {geoProps.length > 1 && (
              <select
                value={geoSlug}
                onChange={(e) => { setGeoSlug(e.target.value); setSelected(null); }}
                style={selectStyle}
                title="地理属性"
              >
                {geoProps.map((p) => {
                  const slug = propSlug(p.rid);
                  return <option key={p.rid} value={slug}>{`${p.title || slug} · ${p.format}`}</option>;
                })}
              </select>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" title="缩小" onClick={() => zoomAt(vpSize.w / 2, vpSize.h / 2, -1)} style={zoomBtnStyle}>
                <Minus style={{ width: 14, height: 14 }} />
              </button>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', minWidth: 30, textAlign: 'center' }}>
                z{view.z}
              </span>
              <button type="button" title="放大" onClick={() => zoomAt(vpSize.w / 2, vpSize.h / 2, 1)} style={zoomBtnStyle}>
                <Plus style={{ width: 14, height: 14 }} />
              </button>
            </div>
            {tilesOffline ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                color: 'var(--warning)', border: '1px solid var(--warning)',
                borderRadius: 4, padding: '1px 8px',
              }}>
                <WifiOff style={{ width: 11, height: 11 }} /> 离线网格模式
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>OSM 瓦片</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
              {`${points.length} 点 · ${polygons.length} 面 · 拖拽平移 / 滚轮缩放`}
            </span>
          </div>

          {/* 地图视口 */}
          <div
            ref={viewportRef}
            style={{
              position: 'relative', overflow: 'hidden', height: VIEWPORT_H,
              background: 'var(--muted)', cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none', userSelect: 'none',
            }}
            onPointerDown={(e) => {
              dragRef.current = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy };
              dragMovedRef.current = false;
              setDragging(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (Math.abs(dx) + Math.abs(dy) > 4) dragMovedRef.current = true;
              const c = clampView(view.z, d.ox - dx, d.oy - dy, vpSize.w, vpSize.h);
              applyView({ z: view.z, ox: c.ox, oy: c.oy });
            }}
            onPointerUp={() => { dragRef.current = null; setDragging(false); }}
            onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
            onClick={() => {
              // 点击（非拖拽）空白处 → 关闭属性摘要卡
              if (!dragMovedRef.current) setSelected(null);
            }}
          >
            {/* 瓦片层（离线时不渲染） */}
            {!tilesOffline && tiles.map((t) => (
              <img
                key={t.key}
                src={t.src}
                alt=""
                draggable={false}
                onError={() => setTilesOffline(true)}
                style={{
                  position: 'absolute', left: t.left, top: t.top,
                  width: TILE, height: TILE, userSelect: 'none', pointerEvents: 'none',
                }}
              />
            ))}

            {/* SVG overlay：网格线 / 多边形 / pin 点与标签 */}
            <svg
              width={vpSize.w}
              height={vpSize.h}
              style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
            >
              {/* 离线降级：经纬网格线 + 刻度 */}
              {graticule && (
                <g>
                  {graticule.vLines.map((l, i) => (
                    <g key={`v${i}`}>
                      <line x1={l.x} y1={0} x2={l.x} y2={vpSize.h} stroke="var(--border)" strokeWidth={1} />
                      <text x={l.x + 3} y={12} fontSize={9} fill="var(--muted-foreground)">{l.label}</text>
                    </g>
                  ))}
                  {graticule.hLines.map((l, i) => (
                    <g key={`h${i}`}>
                      <line x1={0} y1={l.y} x2={vpSize.w} y2={l.y} stroke="var(--border)" strokeWidth={1} />
                      <text x={4} y={l.y - 3} fontSize={9} fill="var(--muted-foreground)">{l.label}</text>
                    </g>
                  ))}
                </g>
              )}

              {/* geojson Polygon / MultiPolygon */}
              {polygons.map((poly) => {
                const d = poly.rings
                  .map((ring) => ring
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${lonToX(pt.lon, view.z) - view.ox} ${latToY(pt.lat, view.z) - view.oy}`)
                    .join(' '))
                  .map((ring) => `${ring} Z`)
                  .join(' ');
                return (
                  <path
                    key={poly.rid}
                    d={d}
                    fill="rgba(59, 130, 246, 0.16)"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setSelected(poly); }}
                  >
                    <title>{poly.label}</title>
                  </path>
                );
              })}

              {/* latlon pin：circle + label（视口裁剪 + 标签上限） */}
              {points.map((p, i) => {
                const sx = lonToX(p.lon, view.z) - view.ox;
                const sy = latToY(p.lat, view.z) - view.oy;
                if (sx < -40 || sy < -40 || sx > vpSize.w + 40 || sy > vpSize.h + 40) return null;
                const isSel = selected?.rid === p.rid;
                return (
                  <g key={p.rid || `pt${i}`}>
                    <circle
                      cx={sx} cy={sy} r={isSel ? 7 : 5.5}
                      fill="var(--destructive)" stroke="#fff" strokeWidth={isSel ? 2.5 : 2}
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setSelected(p); }}
                    >
                      <title>{p.label}</title>
                    </circle>
                    {i < LABEL_LIMIT && (
                      <text
                        x={sx} y={sy + 17} textAnchor="middle" fontSize={10}
                        fill="var(--foreground)" stroke="var(--card)" strokeWidth={3} paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}
                      >
                        {p.label.length > 14 ? `${p.label.slice(0, 14)}…` : p.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* 空态 / 加载 / 错误覆盖层 */}
            {err ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--background)', fontSize: 12, color: 'var(--destructive)', padding: 24, textAlign: 'center',
              }}>
                {err}
              </div>
            ) : !selectedTypeHasGeo && !loadingRows && detail ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8,
                alignItems: 'center', justifyContent: 'center', background: 'var(--background)',
              }}>
                <MapPin style={{ width: 22, height: 22, color: 'var(--muted-foreground)' }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>该类型无 latlon/geojson 属性</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>在左栏选择带 MapPin 标记的类型</div>
              </div>
            ) : loadingRows ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
                background: 'var(--background)', color: 'var(--muted-foreground)', fontSize: 12,
              }}>
                <Loader2 style={{ width: 14, height: 14, animation: 'osp-spin 1s linear infinite' }} /> 拉取实例中…
              </div>
            ) : points.length + polygons.length === 0 && geoSlug ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--background)',
              }}>
                该类型实例无可定位的地理数据
              </div>
            ) : null}

            {/* 属性摘要卡（点击 pin / 多边形弹出） */}
            {selected && selAnchor && (
              <div style={{
                position: 'absolute',
                left: Math.min(Math.max(8, lonToX(selAnchor.lon, view.z) - view.ox + 14), Math.max(8, vpSize.w - 248)),
                top: Math.min(Math.max(8, latToY(selAnchor.lat, view.z) - view.oy - 10), Math.max(8, vpSize.h - 240)),
                width: 240, zIndex: 10,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    style={{
                      ...zoomBtnStyle, width: 20, height: 20, border: 'none', background: 'transparent',
                    }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {popupProps.map((pp) => (
                    <div key={pp.title} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--muted-foreground)', flexShrink: 0, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pp.title}>
                        {pp.title}
                      </span>
                      <span style={{ wordBreak: 'break-all', textAlign: 'right' }}>{pp.value.length > 60 ? `${pp.value.slice(0, 60)}…` : pp.value}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'monospace', wordBreak: 'break-all', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    {selected.rid}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 图例 / 说明 */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10, fontSize: 11, color: 'var(--muted-foreground)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--destructive)', display: 'inline-block' }} /> latlon 实例
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 8, background: 'rgba(59, 130, 246, 0.16)', border: '1px solid #3b82f6', display: 'inline-block' }} /> geojson Polygon
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Layers style={{ width: 11, height: 11 }} /> tile.openstreetmap.org · 仅拉取最多 1000 实例
          </span>
        </div>
      </div>
    </div>
  );
}
