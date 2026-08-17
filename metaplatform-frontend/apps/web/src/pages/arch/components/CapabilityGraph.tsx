// 能力树图 — Semi DOM 渲染（SemiGraphCanvas，X6 已移除）。
import { useMemo } from 'react';
import { Spin } from '@douyinfe/semi-ui';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import type { Capability } from '@/api/arch/types';

interface Props {
  data: Capability[];
}

interface FlatNode { id: string; name: string; parentId?: string; level: number }

function buildNodes(caps: Capability[], parentId?: string, level = 0): FlatNode[] {
  const result: FlatNode[] = [];
  const getId = (c: Capability) => c.capabilityId || (c as unknown as Record<string, unknown>).id as string || '';
  const getParent = (c: Capability) => c.parentCapabilityId || (c as unknown as Record<string, unknown>).parent_id as string || '';
  const visited = new Set<string>();

  const children = caps.filter((c) => getParent(c) === (parentId ?? '') && !visited.has(getId(c)));
  children.forEach((c) => {
    const id = getId(c);
    if (visited.has(id)) return;
    visited.add(id);
    result.push({ id, name: c.name, parentId, level });
    result.push(...buildNodes(caps, id, level + 1));
  });
  if (!parentId) {
    const roots = caps.filter((c) => !getParent(c) && !visited.has(getId(c)));
    roots.forEach((c) => {
      const id = getId(c);
      if (visited.has(id)) return;
      visited.add(id);
      result.push({ id, name: c.name, level: 0 });
      result.push(...buildNodes(caps, id, level + 1));
    });
  }
  return result;
}

export default function CapabilityGraph({ data }: Props) {
  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    const flat = buildNodes(data);
    const colWidth = 200;
    const rowHeight = 80;
    const nodeSpecs: GraphNodeSpec[] = flat.map((node) => {
      const col = node.level;
      const sameLevel = flat.filter((n) => n.level === node.level);
      const row = sameLevel.findIndex((n) => n.id === node.id);
      return {
        id: node.id,
        x: col * colWidth + 40 + 70,
        y: row * rowHeight + 40 + 20,
        w: 140, h: 40,
        label: node.name,
        color: '#1677ff',
        solid: col === 0,
      };
    });
    const edgeSpecs: GraphEdgeSpec[] = flat
      .filter((n) => n.parentId && flat.some((p) => p.id === n.parentId))
      .map((n) => ({ source: n.parentId as string, target: n.id }));
    const maxCol = Math.max(0, ...flat.map((n) => n.level));
    const levels = Array.from(new Set(flat.map((n) => n.level)));
    const maxRows = Math.max(1, ...levels.map((l) => flat.filter((n) => n.level === l).length), 1);
    return {
      nodes: nodeSpecs,
      edges: edgeSpecs,
      worldWidth: (maxCol + 1) * colWidth + 80,
      worldHeight: maxRows * rowHeight + 80,
    };
  }, [data]);

  return (
    <div>
      <SemiGraphCanvas
        nodes={nodes}
        edges={edges}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        height={480}
        autoFit
        showGrid
      />
      {data.length === 0 && <Spin />}
    </div>
  );
}
