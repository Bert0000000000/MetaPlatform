import { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { Graph } from '@antv/x6';

interface GraphNodeData {
  id: string;
  label: string;
  type?: 'concept' | 'entity' | 'relation';
}

interface KnowledgeGraphViewerProps {
  nodes: GraphNodeData[];
  edges?: Array<{ source: string; target: string; label?: string }>;
}

export default function KnowledgeGraphViewer({ nodes, edges = [] }: KnowledgeGraphViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!ref.current || nodes.length === 0) return;

    const graph = new Graph({
      container: ref.current,
      width: ref.current.clientWidth,
      height: 600,
      background: { color: '#fafafa' },
      grid: { visible: true, type: 'dot' },
      panning: true,
      mousewheel: { enabled: true },
    });

    nodes.forEach((n, i) => {
      const x = 80 + (i % 4) * 180;
      const y = 80 + Math.floor(i / 4) * 140;
      graph.addNode({
        x,
        y,
        width: 160,
        height: 50,
        label: n.label,
        attrs: {
          body: {
            fill: n.type === 'entity' ? '#fffbe6' : '#e6f4ff',
            stroke: n.type === 'entity' ? '#faad14' : '#1677ff',
          },
          label: { fontSize: 12, fill: '#333' },
        },
      });
    });

    edges.forEach((e) => {
      const source = graph.getCellById(`node_${e.source}`);
      const target = graph.getCellById(`node_${e.target}`);
      if (source && target) {
        graph.addEdge({
          source: { cell: source.id },
          target: { cell: target.id },
          attrs: { line: { stroke: '#999', strokeWidth: 1 } },
          label: e.label || '',
        });
      }
    });

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
    };
  }, [nodes, edges]);

  if (nodes.length === 0) {
    return <Empty description="暂无图谱数据" />;
  }

  return <div ref={ref} style={{ width: '100%', height: 600, border: '1px solid #f0f0f0' }} />;
}
