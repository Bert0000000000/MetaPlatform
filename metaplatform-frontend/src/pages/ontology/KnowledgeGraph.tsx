import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Box, GitBranch, ArrowRight, Network, Search } from "lucide-react";
import { ontologyApi, type OntologyObject, type OntologyRelation } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * KnowledgeGraph: 知识图谱视图
 *
 * 节点: 对象 (Customer/Order/...)
 * 边: 关系 (1:N, N:1, N:N)
 *
 * 功能:
 *   - 8 要素全图谱可视化 (SVG)
 *   - 跨对象路径查询 (A → ... → B)
 *   - 邻居展开 (1 跳 / 2 跳 / 3 跳)
 *   - 中心性分析 (度最大的节点)
 * ════════════════════════════════════════════════════════════════════ */

interface GraphNode {
  id: string;
  name: string;
  label: string;
  degree: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
}

export function KnowledgeGraph() {
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [relations, setRelations] = useState<OntologyRelation[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>("");
  const [hops, setHops] = useState(2);
  const [pathFrom, setPathFrom] = useState<string>("");
  const [pathTo, setPathTo] = useState<string>("");
  const [foundPath, setFoundPath] = useState<string[] | null>(null);

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjects().catch(() => [] as OntologyObject[]),
      ontologyApi.listRelations().catch(() => [] as OntologyRelation[]),
    ]).then(([objs, rels]) => {
      setObjects(objs);
      setRelations(rels);
      if (objs.length > 0) {
        setSelectedNode(objs[0].id);
        setPathFrom(objs[0].id);
        setPathTo(objs[Math.min(1, objs.length - 1)].id);
      }
    });
  }, []);

  // 构建图
  const graph = useMemo(() => {
    const degree = new Map<string, number>();
    relations.forEach((r) => {
      degree.set(r.source_object_id, (degree.get(r.source_object_id) || 0) + 1);
      degree.set(r.target_object_id, (degree.get(r.target_object_id) || 0) + 1);
    });
    const nodes: GraphNode[] = objects.map((o) => ({
      id: o.id,
      name: o.name,
      label: o.label || o.name,
      degree: degree.get(o.id) || 0,
    }));
    const edges: GraphEdge[] = relations.map((r) => ({
      source: r.source_object_id,
      target: r.target_object_id,
      type: r.type,
      label: r.label || r.type,
    }));
    return { nodes, edges };
  }, [objects, relations]);

  // BFS 路径查询
  const findPath = (fromId: string, toId: string): string[] | null => {
    if (fromId === toId) return [fromId];
    const adj = new Map<string, string[]>();
    graph.edges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    });
    const visited = new Set<string>([fromId]);
    const queue: string[][] = [[fromId]];
    while (queue.length > 0) {
      const path = queue.shift()!;
      const last = path[path.length - 1];
      for (const next of adj.get(last) || []) {
        if (visited.has(next)) continue;
        const newPath = [...path, next];
        if (next === toId) return newPath;
        visited.add(next);
        queue.push(newPath);
      }
    }
    return null;
  };

  const handleFindPath = () => {
    if (!pathFrom || !pathTo) return;
    const p = findPath(pathFrom, pathTo);
    setFoundPath(p);
  };

  // N 跳邻居
  const neighbors = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const result = new Set<string>([selectedNode]);
    for (let h = 0; h < hops; h++) {
      const newAdds = new Set<string>();
      graph.edges.forEach((e) => {
        if (result.has(e.source)) newAdds.add(e.target);
        if (result.has(e.target)) newAdds.add(e.source);
      });
      newAdds.forEach((n) => result.add(n));
    }
    return result;
  }, [selectedNode, hops, graph]);

  // 中心性排序
  const centralNodes = useMemo(() => {
    return [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 5);
  }, [graph]);

  if (objects.length === 0) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">加载中...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Network className="size-5 text-primary" /> 知识图谱
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Neo4j 本体图谱视图 — {graph.nodes.length} 节点 / {graph.edges.length} 边
        </p>
      </div>

      {/* 中心性 + 路径查询 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">中心节点 (Top 5 度)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {centralNodes.map((n, i) => (
                <div key={n.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground w-4">#{i + 1}</span>
                  <Box className="size-3 text-primary" />
                  <span className="flex-1 font-mono">{n.label}</span>
                  <Badge variant="secondary" className="text-[10px]">度 {n.degree}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">跨对象路径查询</CardTitle>
            <CardDescription>BFS 找两个对象之间的最短路径</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Select value={pathFrom} onValueChange={setPathFrom}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {objects.map((o) => <SelectItem key={o.id} value={o.id}>{o.label || o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <ArrowRight className="size-3 text-muted-foreground" />
              <Select value={pathTo} onValueChange={setPathTo}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {objects.map((o) => <SelectItem key={o.id} value={o.id}>{o.label || o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleFindPath}>
                <Search className="size-3.5 mr-1" /> 查路径
              </Button>
            </div>
            {foundPath && (
              <div className="mt-3 p-2 border rounded text-xs">
                {foundPath.length === 0 || foundPath === null ? (
                  <span className="text-muted-foreground">无路径</span>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap">
                    {foundPath.map((id, i) => {
                      const obj = objects.find((o) => o.id === id);
                      return (
                        <span key={i} className="flex items-center gap-1">
                          <Badge variant="default" className="text-[10px]">{obj?.label || obj?.name}</Badge>
                          {i < foundPath.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                        </span>
                      );
                    })}
                    <span className="ml-2 text-muted-foreground">({foundPath.length - 1} 跳)</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 邻居展开 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs">中心节点:</Label>
            <Select value={selectedNode} onValueChange={setSelectedNode}>
              <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {objects.map((o) => <SelectItem key={o.id} value={o.id}>{o.label || o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="text-xs ml-2">跳数:</Label>
            <Select value={String(hops)} onValueChange={(v) => setHops(Number(v))}>
              <SelectTrigger className="h-8 text-xs w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 跳</SelectItem>
                <SelectItem value="2">2 跳</SelectItem>
                <SelectItem value="3">3 跳</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {neighbors.size} 节点 / {graph.edges.filter((e) => neighbors.has(e.source) && neighbors.has(e.target)).length} 边
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 图谱可视化 (SVG 简单版) */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <GraphView
            nodes={graph.nodes}
            edges={graph.edges}
            highlight={neighbors}
            pathHighlight={foundPath}
            onSelectNode={setSelectedNode}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function GraphView({ nodes, edges, highlight, pathHighlight, onSelectNode }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlight: Set<string>;
  pathHighlight: string[] | null;
  onSelectNode: (id: string) => void;
}) {
  // 圆形布局
  const W = 800, H = 500;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 60;
  const positioned = nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const posMap = new Map(positioned.map((p) => [p.id, p]));

  const pathSet = new Set(pathHighlight || []);

  return (
    <div className="overflow-auto">
      <svg width={W} height={H} className="border rounded">
        {/* 边 */}
        {edges.map((e, i) => {
          const s = posMap.get(e.source);
          const t = posMap.get(e.target);
          if (!s || !t) return null;
          const inHighlight = highlight.has(e.source) && highlight.has(e.target);
          const inPath = pathSet.has(e.source) && pathSet.has(e.target);
          const stroke = inPath ? "#3b82f6" : inHighlight ? "#94a3b8" : "#e2e8f0";
          const width = inPath ? 2.5 : inHighlight ? 1.5 : 0.8;
          return (
            <g key={i}>
              <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={stroke} strokeWidth={width} />
              {inHighlight && (
                <text
                  x={(s.x + t.x) / 2}
                  y={(s.y + t.y) / 2 - 4}
                  fontSize="9"
                  textAnchor="middle"
                  fill="#64748b"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {/* 节点 */}
        {positioned.map((n) => {
          const inHighlight = highlight.has(n.id);
          const inPath = pathSet.has(n.id);
          const radius = inPath ? 22 : inHighlight ? 18 : 12;
          const fill = inPath ? "#3b82f6" : inHighlight ? "#60a5fa" : "#cbd5e1";
          return (
            <g key={n.id} onClick={() => onSelectNode(n.id)} style={{ cursor: "pointer" }}>
              <circle cx={n.x} cy={n.y} r={radius} fill={fill} stroke="#fff" strokeWidth={2} />
              <text
                x={n.x}
                y={n.y + radius + 12}
                fontSize="10"
                textAnchor="middle"
                fill="#0f172a"
              >
                {n.label}
              </text>
              <text
                x={n.x}
                y={n.y + 3}
                fontSize="10"
                textAnchor="middle"
                fill="#fff"
                fontWeight="bold"
              >
                {n.degree}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
