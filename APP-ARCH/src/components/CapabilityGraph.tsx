import { useEffect, useRef } from 'react';
import { Graph } from '@antv/x6';
import { Spin } from 'antd';
import type { Capability } from '@/types';

interface Props {
  data: Capability[];
}

function buildNodes(caps: Capability[], parentId?: string, x = 0, y = 0, level = 0): Array<{ id: string; name: string; parentId?: string; level: number }> {
  const result: Array<{ id: string; name: string; parentId?: string; level: number }> = [];
  const children = caps.filter((c) => c.parentCapabilityId === parentId);
  children.forEach((c) => {
    result.push({ id: c.capabilityId, name: c.name, parentId, level });
    result.push(...buildNodes(caps, c.capabilityId, x, y, level + 1));
  });
  if (!parentId) {
    const roots = caps.filter((c) => !c.parentCapabilityId);
    roots.forEach((c) => {
      if (!result.find((r) => r.id === c.capabilityId)) {
        result.push({ id: c.capabilityId, name: c.name, level: 0 });
        result.push(...buildNodes(caps, c.capabilityId, x, y, level + 1));
      }
    });
  }
  return result;
}

export default function CapabilityGraph({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({
      container: containerRef.current,
      background: { color: '#fafafa' },
      grid: { visible: true, type: 'dot' },
      interacting: { nodeMovable: true },
      panning: true,
      mousewheel: true,
    });
    graphRef.current = graph;

    const flatNodes = buildNodes(data);
    const nodeMap = new Map(flatNodes.map((n) => [n.id, n]));

    const colWidth = 200;
    const rowHeight = 80;

    flatNodes.forEach((node, idx) => {
      const col = node.level;
      const sameLevel = flatNodes.filter((n) => n.level === node.level);
      const row = sameLevel.findIndex((n) => n.id === node.id);
      graph.addNode({
        id: node.id,
        shape: 'rect',
        x: col * colWidth + 40,
        y: row * rowHeight + 40,
        width: 140,
        height: 40,
        attrs: {
          body: { fill: col === 0 ? '#1677ff' : '#f0f5ff', stroke: '#1677ff', rx: 6, ry: 6 },
          label: { text: node.name, fill: col === 0 ? '#fff' : '#333', fontSize: 13 },
        },
      });
    });

    flatNodes.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        graph.addEdge({
          source: node.parentId,
          target: node.id,
          attrs: {
            line: { stroke: '#bbb', strokeWidth: 1.5, targetMarker: { name: 'block', width: 8, height: 6 } },
          },
        });
      }
    });

    graph.zoomToFit({ padding: 20, maxScale: 1.5 });

    return () => {
      graph.dispose();
    };
  }, [data]);

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height: 480, border: '1px solid #f0f0f0', borderRadius: 8 }} />
      {data.length === 0 && <Spin />}
    </div>
  );
}
