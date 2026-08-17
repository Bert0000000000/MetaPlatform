// 能力-本体映射图 — Semi DOM 渲染（SemiGraphCanvas，X6 已移除）。
import { useMemo } from 'react';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import type { OntologyMapping } from '@/api/arch/types';
import { analyzeImpact } from '@/api/arch/ontologyMapping';
import type { ImpactAnalysisResult } from '@/api/arch/types';

interface Props {
  mappings: OntologyMapping[];
  onImpact?: (result: ImpactAnalysisResult) => void;
}

export default function OntologyMappingGraph({ mappings, onImpact }: Props) {
  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return { nodes: [] as GraphNodeSpec[], edges: [] as GraphEdgeSpec[], worldWidth: 500, worldHeight: 80 };
    }
    const capSeen = new Set<string>();
    const conSeen = new Set<string>();
    const nodeSpecs: GraphNodeSpec[] = [];
    const edgeSpecs: GraphEdgeSpec[] = [];

    mappings.forEach((m, idx) => {
      const row = idx;
      if (!capSeen.has(m.capabilityId)) {
        capSeen.add(m.capabilityId);
        nodeSpecs.push({
          id: `cap_${m.capabilityId}`,
          x: 40 + 70,
          y: row * 70 + 20 + 22,
          w: 140, h: 44,
          label: m.capabilityName,
          color: '#1677ff',
        });
      }
      if (!conSeen.has(m.conceptId)) {
        conSeen.add(m.conceptId);
        nodeSpecs.push({
          id: `con_${m.conceptId}`,
          x: 320 + 70,
          y: row * 70 + 20 + 22,
          w: 140, h: 44,
          label: m.conceptName,
          color: '#722ed1',
        });
      }
      const color = m.mappingType === 'direct' ? '#52c41a' : m.mappingType === 'partial' ? '#faad14' : '#d9d9d9';
      edgeSpecs.push({
        source: `cap_${m.capabilityId}`,
        target: `con_${m.conceptId}`,
        color,
        width: 2,
        dashed: m.mappingType === 'planned',
        label: `${m.confidence}%`,
      });
    });

    return {
      nodes: nodeSpecs,
      edges: edgeSpecs,
      worldWidth: 500,
      worldHeight: mappings.length * 70 + 80,
    };
  }, [mappings]);

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return <div style={{ width: '100%', height: 400, border: '1px solid var(--semi-color-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)', fontSize: 13 }}>暂无映射数据</div>;
  }

  return (
    <div>
      <SemiGraphCanvas
        nodes={nodes}
        edges={edges}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        height={400}
        autoFit
        showGrid
        onNodeDblClick={(nodeId) => {
          const id = nodeId.replace('cap_', '');
          if (mappings.some((m) => m.capabilityId === id)) {
            analyzeImpact(id).then((result) => onImpact?.(result)).catch(() => undefined);
          }
        }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--semi-color-text-2)' }}>双击能力节点可查看影响分析</div>
    </div>
  );
}
