import { useEffect, useRef } from 'react';
import { Graph } from '@antv/x6';
import type { OntologyMapping } from '@/types';
import { analyzeImpact } from '@/api/ontologyMapping';
import type { ImpactAnalysisResult } from '@/types';

interface Props {
  mappings: OntologyMapping[];
  onImpact?: (result: ImpactAnalysisResult) => void;
}

export default function OntologyMappingGraph({ mappings, onImpact }: Props) {
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

    const capNodes = new Map<string, string>();
    const conNodes = new Map<string, string>();

    mappings.forEach((m, idx) => {
      const row = idx;
      if (!capNodes.has(m.capabilityId)) {
        capNodes.set(m.capabilityId, m.capabilityName);
        graph.addNode({
          id: `cap_${m.capabilityId}`,
          shape: 'rect',
          x: 40,
          y: row * 70 + 20,
          width: 140,
          height: 44,
          attrs: { body: { fill: '#e6f4ff', stroke: '#1677ff', rx: 6 }, label: { text: m.capabilityName, fill: '#1677ff', fontSize: 12 } },
        });
      }
      if (!conNodes.has(m.conceptId)) {
        conNodes.set(m.conceptId, m.conceptName);
        graph.addNode({
          id: `con_${m.conceptId}`,
          shape: 'rect',
          x: 320,
          y: row * 70 + 20,
          width: 140,
          height: 44,
          attrs: { body: { fill: '#f9f0ff', stroke: '#722ed1', rx: 6 }, label: { text: m.conceptName, fill: '#722ed1', fontSize: 12 } },
        });
      }
      const color = m.mappingType === 'direct' ? '#52c41a' : m.mappingType === 'partial' ? '#faad14' : '#d9d9d9';
      graph.addEdge({
        source: `cap_${m.capabilityId}`,
        target: `con_${m.conceptId}`,
        attrs: { line: { stroke: color, strokeWidth: 2, strokeDasharray: m.mappingType === 'planned' ? '4 4' : '0' } },
        labels: [{ text: `${m.confidence}%`, position: 'middle', attrs: { label: { fill: color, fontSize: 10 } } }],
      });
    });

    graph.on('node:dblclick', async ({ node }) => {
      const id = node.id.replace('cap_', '');
      if (mappings.some((m) => m.capabilityId === id)) {
        const result = await analyzeImpact(id);
        onImpact?.(result);
      }
    });

    graph.zoomToFit({ padding: 20, maxScale: 1.5 });

    return () => {
      graph.dispose();
    };
  }, [mappings, onImpact]);

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height: 400, border: '1px solid #f0f0f0', borderRadius: 8 }} />
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>双击能力节点可查看影响分析</div>
    </div>
  );
}
