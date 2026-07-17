import { useEffect, useRef } from 'react';
import { Graph } from '@antv/x6';
import type { ArchApplication } from '@/types';

interface Props {
  applications: ArchApplication[];
}

export default function DependencyGraph({ applications }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({
      container: containerRef.current,
      background: { color: '#fafafa' },
      grid: { visible: true, type: 'dot' },
      panning: true,
      mousewheel: true,
    });
    graphRef.current = graph;

    const nodeWidth = 160;
    const nodeHeight = 50;
    const cols = Math.ceil(Math.sqrt(applications.length));

    applications.forEach((app, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      graph.addNode({
        id: app.appId,
        shape: 'rect',
        x: col * (nodeWidth + 80) + 40,
        y: row * (nodeHeight + 80) + 40,
        width: nodeWidth,
        height: nodeHeight,
        attrs: {
          body: { fill: '#f6ffed', stroke: '#52c41a', rx: 8, ry: 8 },
          label: { text: app.name, fill: '#333', fontSize: 13 },
        },
        data: app,
      });
    });

    applications.forEach((app) => {
      app.dependencyAppIds?.forEach((depId) => {
        if (applications.some((a) => a.appId === depId)) {
          graph.addEdge({
            source: depId,
            target: app.appId,
            attrs: {
              line: { stroke: '#fa8c16', strokeWidth: 2, targetMarker: { name: 'block', width: 10, height: 8 }, strokeDasharray: '5 3' },
            },
            labels: [{ text: '依赖', position: 'middle', attrs: { label: { fill: '#fa8c16', fontSize: 10 } } }],
          });
        }
      });
    });

    graph.zoomToFit({ padding: 20, maxScale: 1.5 });

    return () => {
      graph.dispose();
    };
  }, [applications]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 420, border: '1px solid #f0f0f0', borderRadius: 8 }} />
  );
}
