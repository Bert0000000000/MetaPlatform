import { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { Graph } from '@antv/x6';
import type { RelationType } from '@/api/relations';

interface RelationGraphViewProps {
  relations: RelationType[];
}

export default function RelationGraphView({ relations }: RelationGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current || relations.length === 0) return;

    const graph = new Graph({
      container: containerRef.current,
      width: containerRef.current.clientWidth,
      height: 500,
      background: { color: '#fafafa' },
      grid: { visible: true, type: 'dot' },
      panning: true,
      mousewheel: { enabled: true },
    });

    relations.forEach((r, i) => {
      const x = 80 + (i % 5) * 160;
      const y = 80 + Math.floor(i / 5) * 120;
      graph.addNode({
        x,
        y,
        width: 140,
        height: 50,
        label: `${r.sourceConcept} → ${r.targetConcept}`,
        attrs: {
          body: { fill: '#e6f4ff', stroke: '#1677ff' },
          label: { fontSize: 11, fill: '#333' },
        },
      });
    });

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
    };
  }, [relations]);

  if (relations.length === 0) {
    return <Empty description="暂无关系类型" />;
  }

  return <div ref={containerRef} style={{ width: '100%', height: 500, border: '1px solid #f0f0f0' }} />;
}
