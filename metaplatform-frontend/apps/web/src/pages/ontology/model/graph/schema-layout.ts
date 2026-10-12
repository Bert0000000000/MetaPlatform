import { graphlib, layout } from '@dagrejs/dagre';

export type SchemaPositions = Record<string, { x: number; y: number }>;

export function positionSchemaNodes(base: graphlib.Graph, positions: SchemaPositions) {
  if (!base.nodes().some((id: string) => positions[id])) return base;
  const graph = new graphlib.Graph({ multigraph: true }).setGraph({ ...base.graph() }).setDefaultEdgeLabel(() => ({}));
  for (const id of base.nodes()) graph.setNode(id, { ...base.node(id), ...positions[id] });
  const anchor = (id: string, toward: { x: number; y: number }) => {
    const node = graph.node(id), dx = toward.x - node.x, dy = toward.y - node.y;
    if (!dx && !dy) return { x: node.x + node.width / 2, y: node.y };
    const scale = Math.min(dx ? node.width / 2 / Math.abs(dx) : Infinity, dy ? node.height / 2 / Math.abs(dy) : Infinity);
    return { x: node.x + dx * scale, y: node.y + dy * scale };
  };
  for (const edge of base.edges()) {
    const value = base.edge(edge);
    if (!positions[edge.v] && !positions[edge.w]) { graph.setEdge(edge, value); continue; }
    const a = base.node(edge.v), b = base.node(edge.w), source = graph.node(edge.v), target = graph.node(edge.w);
    // Blend endpoint displacement along the existing route to retain separate
    // parallel lanes. Self relationships translate as a complete loop.
    const points = value.points.map((p: { x: number; y: number }, i: number) => {
      const t = i / (value.points.length - 1);
      return { x: p.x + (source.x - a.x) * (1 - t) + (target.x - b.x) * t, y: p.y + (source.y - a.y) * (1 - t) + (target.y - b.y) * t };
    });
    if (edge.v !== edge.w) {
      points[0] = anchor(edge.v, points[1]);
      points[points.length - 1] = anchor(edge.w, points[points.length - 2]);
    }
    const center = edge.v === edge.w ? { x: value.x + source.x - a.x, y: value.y + source.y - a.y } : points[Math.floor(points.length / 2)];
    graph.setEdge(edge, { ...value, points, x: center.x, y: center.y });
  }
  const xs = [0], ys = [0];
  for (const id of graph.nodes()) {
    const n = graph.node(id);
    xs.push(n.x - n.width / 2 - 12, n.x + n.width / 2 + 12);
    ys.push(n.y - n.height / 2 - 12, n.y + n.height / 2 + 12);
  }
  for (const edge of graph.edges()) for (const p of graph.edge(edge).points) { xs.push(p.x - 12, p.x + 12); ys.push(p.y - 12, p.y + 12); }
  const minX = Math.min(...xs), minY = Math.min(...ys);
  graph.setGraph({ ...base.graph(), minX, minY, width: Math.max(...xs) - minX || 1, height: Math.max(...ys) - minY || 1 });
  return graph;
}

export function schemaNeighborhood<T extends { source: string; target: string }>(ids: string[], edges: T[], focus: string, all: boolean) {
  const known = new Set(ids);
  const shown = edges.filter(e => known.has(e.source) && known.has(e.target) && (all || e.source === focus || e.target === focus));
  const included = new Set([focus, ...shown.flatMap(e => [e.source, e.target])]);
  return { ids: all ? ids : ids.filter(id => included.has(id)), edges: shown };
}

function routeSelfRelationships(dag: graphlib.Graph, edges: { id: string; source: string; target: string }[], above: boolean) {
  const lanes = new Map<string, number>();
  for (const edge of edges.filter(e => e.source === e.target)) {
    const node = dag.node(edge.source);
    const lane = lanes.get(edge.source) || 0;
    lanes.set(edge.source, lane + 1);
    const boundary = node.y + (above ? -1 : 1) * node.height / 2;
    const outside = boundary + (above ? -1 : 1) * (48 + lane * 24);
    const left = node.x - node.width / 4, right = node.x + node.width / 4;
    dag.setEdge(edge.source, edge.target, { ...dag.edge(edge.source, edge.target, edge.id), points: [
      { x: left, y: boundary }, { x: left, y: outside }, { x: right, y: outside }, { x: right, y: boundary },
    ], x: node.x, y: above ? outside : outside + 16 }, edge.id);
    if (!above) dag.graph().height = Math.max(dag.graph().height || 0, outside + 40);
  }
}

export function layoutLocalSchema(nodes: { id: string }[], edges: { id: string; source: string; target: string }[], focus: string, singleColumn: boolean) {
  const dag = new graphlib.Graph({ multigraph: true }).setGraph({}).setDefaultEdgeLabel(() => ({}));
  const neighbors = nodes.filter(node => node.id !== focus);
  const loops = edges.filter(e => e.source === e.target).length;
  const headroom = loops ? 80 + (loops - 1) * 24 : 0;
  const height = Math.max(150, (neighbors.length + (singleColumn ? 1 : 0)) * 122 + 40) + headroom;
  dag.setGraph({ width: singleColumn ? 290 : 540, height });
  dag.setNode(focus, { x: singleColumn ? 160 : 130, y: 65 + headroom, width: 220, height: 90 });
  neighbors.forEach((node, index) => dag.setNode(node.id, { x: singleColumn ? 160 : 410, y: 65 + headroom + (index + (singleColumn ? 1 : 0)) * 122, width: 220, height: 90 }));
  // Route a one-hop neighborhood independently of edge direction and cycles.
  edges.forEach((edge, index) => {
    const source = dag.node(edge.source), target = dag.node(edge.target);
    const gutter = singleColumn ? 18 + (index % 4) * 6 : 264 + (index % 4) * 5;
    const points = singleColumn
      ? [{ x: source.x - 110, y: source.y }, { x: gutter, y: source.y }, { x: gutter, y: target.y }, { x: target.x - 110, y: target.y }]
      : [{ x: source.x + (edge.source === focus ? 110 : -110), y: source.y }, { x: gutter, y: source.y }, { x: gutter, y: target.y }, { x: target.x + (edge.target === focus ? 110 : -110), y: target.y }];
    dag.setEdge(edge.source, edge.target, { points, x: gutter, y: (source.y + target.y) / 2 }, edge.id);
  });
  routeSelfRelationships(dag, edges, true);
  return dag;
}

export function layoutSchema(nodes: { id: string }[], edges: { id: string; source: string; target: string }[], compact = false) {
  let failure: unknown;
  // Dagre's cycle strategies fail on different multigraphs. Retry from fresh input:
  // a failed layout mutates the graph and cannot safely be reused.
  for (const acyclicer of ['greedy', undefined]) {
    const dag = new graphlib.Graph({ multigraph: true })
      .setGraph({ rankdir: 'LR', acyclicer, nodesep: compact ? 28 : 32, ranksep: compact ? 54 : 90, marginx: 24, marginy: 24 })
      .setDefaultEdgeLabel(() => ({}));
    nodes.forEach(node => dag.setNode(node.id, { width: compact ? 164 : 220, height: compact ? 42 : 90 }));
    edges.forEach(edge => dag.setEdge(edge.source, edge.target, { width: 64, height: 18 }, edge.id));
    try {
      layout(dag);
      // Dagre can leave self-loop endpoints detached in cyclic multigraphs.
      routeSelfRelationships(dag, edges, false);
      const validNodes = nodes.every(node => Number.isFinite(dag.node(node.id).x) && Number.isFinite(dag.node(node.id).y));
      const validEdges = edges.every(edge => dag.edge(edge.source, edge.target, edge.id).points?.every((p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y)));
      if (!validNodes || !validEdges) throw new Error('Invalid schema layout coordinates');
      return dag;
    } catch (error) { failure = error; }
  }
  throw failure;
}

export function layoutConceptSchema(nodes: { id: string }[], edges: { id: string; source: string; target: string }[], aspect: number) {
  const graph = new graphlib.Graph({ multigraph: true }).setGraph({ width: 1, height: 1 }).setDefaultEdgeLabel(() => ({}));
  nodes.forEach(node => graph.setNode(node.id, {}));
  edges.forEach(edge => graph.setEdge(edge.source, edge.target, {}, edge.id));
  const components = graphlib.alg.components(graph).map(ids => {
    const known = new Set(ids);
    const componentNodes = nodes.filter(node => known.has(node.id));
    const componentEdges = edges.filter(edge => known.has(edge.source));
    // Distance from a connected hub supplies layout constraints only. It does not
    // infer inheritance: the returned graph retains every original edge direction.
    const root = ids.reduce((best, id) => graph.neighbors(id)!.length > graph.neighbors(best)!.length ? id : best, ids[0]);
    const ranks = new Map([[root, 0]]);
    const queue = [root];
    for (let i = 0; i < queue.length; i++) for (const id of graph.neighbors(queue[i])!) {
      if (!ranks.has(id)) { ranks.set(id, ranks.get(queue[i])! + 1); queue.push(id); }
    }
    const order = new Map(queue.map((id, i) => [id, i]));
    const candidates = ['LR', 'TB'].map(rankdir => {
      const dag = new graphlib.Graph({ multigraph: true }).setGraph({ rankdir, nodesep: 22, ranksep: 32, edgesep: 12, marginx: 12, marginy: 12 }).setDefaultEdgeLabel(() => ({}));
      const loopSpace = new Map(componentNodes.map(n => {
        const count = componentEdges.filter(e => e.source === n.id && e.target === n.id).length;
        return [n.id, count ? 64 + (count - 1) * 24 : 0];
      }));
      componentNodes.forEach(n => dag.setNode(n.id, { width: 164, height: 42 + loopSpace.get(n.id)! }));
      const oriented = componentEdges.map(edge => {
        const reverse = ranks.get(edge.source)! > ranks.get(edge.target)! || ranks.get(edge.source) === ranks.get(edge.target) && order.get(edge.source)! > order.get(edge.target)!;
        return { edge, source: reverse ? edge.target : edge.source, target: reverse ? edge.source : edge.target, reverse };
      });
      oriented.filter(e => e.source !== e.target).forEach(e => dag.setEdge(e.source, e.target, { width: 1, height: 1 }, e.edge.id));
      layout(dag);
      const result = new graphlib.Graph({ multigraph: true }).setGraph({ ...dag.graph() }).setDefaultEdgeLabel(() => ({}));
      componentNodes.forEach(n => result.setNode(n.id, { ...dag.node(n.id), height: 42, y: dag.node(n.id).y + loopSpace.get(n.id)! / 2 }));
      const anchor = (id: string, toward: { x: number; y: number }) => {
        const node = result.node(id), dx = toward.x - node.x, dy = toward.y - node.y;
        const scale = Math.min(dx ? node.width / 2 / Math.abs(dx) : Infinity, dy ? node.height / 2 / Math.abs(dy) : Infinity);
        return { x: node.x + dx * scale, y: node.y + dy * scale };
      };
      oriented.forEach(e => {
        if (e.source === e.target) { result.setEdge(e.source, e.target, {}, e.edge.id); return; }
        const value = dag.edge(e.source, e.target, e.edge.id);
        const points = e.reverse ? [...value.points].reverse() : [...value.points];
        points[0] = anchor(e.edge.source, points[1]);
        points[points.length - 1] = anchor(e.edge.target, points[points.length - 2]);
        const center = points[Math.floor(points.length / 2)];
        result.setEdge(e.edge.source, e.edge.target, { ...value, points, x: center.x, y: center.y }, e.edge.id);
      });
      routeSelfRelationships(result, componentEdges, true);
      return result;
    });
    return candidates.sort((a, b) => Math.max(a.graph().width! / aspect, a.graph().height!) - Math.max(b.graph().width! / aspect, b.graph().height!))[0];
  }).sort((a, b) => b.graph().height! - a.graph().height! || b.graph().width! - a.graph().width!);
  const ratio = Math.max(.5, Math.min(3, aspect));
  const baseWidth = Math.sqrt(components.reduce((sum, g) => sum + (g.graph().width! + 20) * (g.graph().height! + 20), 0) * ratio);
  const packings = [.85, 1, 1.2, 1.4].map(factor => {
    const limit = Math.max(188, ...components.map(g => g.graph().width!), baseWidth * factor);
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (const component of components) {
      const width = component.graph().width!, height = component.graph().height!;
      const slots = [0, ...placed.map(p => p.x + p.width + 20)].flatMap(x => [0, ...placed.map(p => p.y + p.height + 20)].map(y => ({ x, y, width, height })))
        .filter(p => p.x + width <= limit && placed.every(q => p.x >= q.x + q.width + 20 || q.x >= p.x + width + 20 || p.y >= q.y + q.height + 20 || q.y >= p.y + height + 20))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      placed.push(slots[0]);
    }
    const width = Math.max(1, ...placed.map(p => p.x + p.width)), height = Math.max(1, ...placed.map(p => p.y + p.height));
    return { placed, width, height, score: Math.max(width / ratio, height) };
  });
  const packing = packings.sort((a, b) => a.score - b.score)[0];
  // Place small disconnected components beside the connected network, avoiding
  // the empty vertical space produced by a shelf layout.
  for (const [index, component] of components.entries()) {
    const { x, y } = packing.placed[index];
    for (const id of component.nodes()) {
      const node = component.node(id);
      graph.setNode(id, { ...node, x: node.x + x, y: node.y + y });
    }
    for (const edge of component.edges()) {
      const value = component.edge(edge);
      graph.setEdge(edge.v, edge.w, { ...value, x: value.x + x, y: value.y + y, points: value.points.map((p: { x: number; y: number }) => ({ x: p.x + x, y: p.y + y })) }, edge.name);
    }
  }
  graph.setGraph({ width: packing.width, height: packing.height });
  return graph;
}
