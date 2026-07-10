/**
 * 图形布局算法 —— 用于血缘 / 关系图等节点坐标计算
 *
 * 抽出自原 ERGraphDialog 的内联布局函数 + LineageCanvas 内部 layoutNodes
 * 现在统一在此处管理，方便被多处复用，且支持外部传入"上一帧位置"做布局动画插值
 */

export interface Point {
  x: number;
  y: number;
}

export type LayoutMode = "circular" | "grid" | "hierarchical";

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  /** 旧帧位置，留任可以保留节点位置避免闪烁 */
  prev?: Record<string, Point>;
}

export interface LayoutInput {
  ids: string[]; // 节点 id 列表
  relations?: { source: string; target: string }[];
  options?: LayoutOptions;
}

/* ────────────────────────────────────────────────────────────
 * 1. 圆形布局 - 适合节点少或随机关系图的"鸟瞰感"
 * ──────────────────────────────────────────────────────────── */
export function layoutCircular({
  ids,
  options = {},
}: LayoutInput): Record<string, Point> {
  const cx = 500;
  const cy = 360;
  const r = Math.min(320, 150 + ids.length * 18);
  const prev = options.prev ?? {};
  const next: Record<string, Point> = {};
  ids.forEach((id, i) => {
    if (prev[id]) {
      next[id] = prev[id];
      return;
    }
    const angle = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
    next[id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
  return next;
}

/* ────────────────────────────────────────────────────────────
 * 2. 网格布局 - 适合节点多但关系稀疏的"索引"视图
 * ──────────────────────────────────────────────────────────── */
export function layoutGrid({
  ids,
  options = {},
}: LayoutInput): Record<string, Point> {
  const cols = Math.ceil(Math.sqrt(ids.length * 1.5));
  const gapX = 220;
  const gapY = 160;
  const totalW = cols * gapX;
  const startX = 500 - totalW / 2 + gapX / 2;
  const startY = 200;
  const prev = options.prev ?? {};
  const next: Record<string, Point> = {};
  ids.forEach((id, i) => {
    if (prev[id]) {
      next[id] = prev[id];
      return;
    }
    const c = i % cols;
    const row = Math.floor(i / cols);
    next[id] = { x: startX + c * gapX, y: startY + row * gapY };
  });
  return next;
}

/* ────────────────────────────────────────────────────────────
 * 3. 分层布局 (Sugiyama-like 减边交叉)
 *    - BFS 给每个节点一个层级
 *    - Barycenter 排序（12 次上下扫）减交叉
 * ──────────────────────────────────────────────────────────── */
export function layoutHierarchical({
  ids,
  relations = [],
  options = {},
}: LayoutInput): Record<string, Point> {
  if (ids.length === 0) return {};

  const idSet = new Set(ids);
  const outAdj: Record<string, string[]> = {};
  const inAdj: Record<string, string[]> = {};
  const inDeg: Record<string, number> = {};
  ids.forEach((id) => {
    outAdj[id] = [];
    inAdj[id] = [];
    inDeg[id] = 0;
  });
  relations.forEach((r) => {
    if (!idSet.has(r.source) || !idSet.has(r.target)) return;
    if (r.source === r.target) return;
    outAdj[r.source].push(r.target);
    inAdj[r.target].push(r.source);
    inDeg[r.target]++;
  });

  // BFS 分层
  const layer: Record<string, number> = {};
  const queue: string[] = [];
  ids.forEach((id) => {
    if (inDeg[id] === 0) {
      layer[id] = 0;
      queue.push(id);
    }
  });
  ids.forEach((id) => {
    if (!(id in layer)) layer[id] = 0;
  });
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    outAdj[u].forEach((v) => {
      if (layer[v] < layer[u] + 1) layer[v] = layer[u] + 1;
      inDeg[v]--;
      if (inDeg[v] === 0) queue.push(v);
    });
  }

  // 按层分组
  const layers: string[][] = [];
  ids.forEach((id) => {
    const l = layer[id];
    if (!layers[l]) layers[l] = [];
    layers[l].push(id);
  });

  // Barycenter 重排
  const ORDER_ITER = 12;
  for (let iter = 0; iter < ORDER_ITER; iter++) {
    // 下行
    for (let l = 1; l < layers.length; l++) {
      const bary: Record<string, number> = {};
      const lyr = layers[l];
      const parentLyr = layers[l - 1] ?? [];
      lyr.forEach((id, i) => {
        const parents = inAdj[id];
        if (parents.length === 0) {
          bary[id] = i;
          return;
        }
        let sum = 0;
        let cnt = 0;
        parents.forEach((p) => {
          const idx = parentLyr.indexOf(p);
          if (idx >= 0) {
            sum += idx;
            cnt++;
          }
        });
        bary[id] = cnt > 0 ? sum / cnt : i;
      });
      lyr.sort((a, b) => bary[a] - bary[b]);
    }
    // 上行
    for (let l = layers.length - 2; l >= 0; l--) {
      const bary: Record<string, number> = {};
      const lyr = layers[l];
      const childLyr = layers[l + 1] ?? [];
      lyr.forEach((id, i) => {
        const children = outAdj[id];
        if (children.length === 0) {
          bary[id] = i;
          return;
        }
        let sum = 0;
        let cnt = 0;
        children.forEach((c) => {
          const idx = childLyr.indexOf(c);
          if (idx >= 0) {
            sum += idx;
            cnt++;
          }
        });
        bary[id] = cnt > 0 ? sum / cnt : i;
      });
      lyr.sort((a, b) => bary[a] - bary[b]);
    }
  }

  // 坐标
  const colW = 200;
  const rowH = 120;
  const totalW = Math.max(...layers.map((ly) => ly.length)) * colW;
  const startX = 500 - totalW / 2 + colW / 2;
  const startY = 180;
  const next: Record<string, Point> = {};
  layers.forEach((ly, li) => {
    ly.forEach((id, i) => {
      const layerWidth = ly.length * colW;
      const offsetX = (totalW - layerWidth) / 2;
      next[id] = { x: startX + offsetX + i * colW, y: startY + li * rowH };
    });
  });
  return next;
}

/* ────────────────────────────────────────────────────────────
 * 4. 分列分层 (血缘图专用 - 按 type 分列)
 * ──────────────────────────────────────────────────────────── */
export function layoutByColumn<T extends { id: string; type: string }>(
  nodes: T[],
  typeOrder: string[],
  options: { nodeWidth?: number; nodeHeight?: number; colGap?: number; rowGap?: number } = {},
): Record<string, Point> {
  const nodeWidth = options.nodeWidth ?? 168;
  const nodeHeight = options.nodeHeight ?? 56;
  const colGap = options.colGap ?? 80;
  const rowGap = options.rowGap ?? 24;

  const byType = new Map<string, T[]>();
  for (const n of nodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(n);
  }
  const maxRows = Math.max(...Array.from(byType.values()).map((a) => a.length), 1);
  const positions: Record<string, Point> = {};
  typeOrder.forEach((t, col) => {
    const list = byType.get(t) ?? [];
    list.forEach((n, i) => {
      const yOffset = (maxRows - list.length) * ((nodeHeight + rowGap) / 2);
      positions[n.id] = {
        x: 80 + col * (nodeWidth + colGap),
        y: 60 + i * (nodeHeight + rowGap) + yOffset,
      };
    });
  });
  return positions;
}

/* ────────────────────────────────────────────────────────────
 * 顶层 dispatch
 * ──────────────────────────────────────────────────────────── */
export function computeLayout(
  mode: LayoutMode | "column",
  input: LayoutInput & { typeOrder?: string[]; layoutType?: (id: string) => string },
): Record<string, Point> {
  if (mode === "circular") return layoutCircular(input);
  if (mode === "grid") return layoutGrid(input);
  if (mode === "hierarchical") return layoutHierarchical(input);
  // column 模式：调用方需自行处理 nodes+typeOrder
  return {};
}
