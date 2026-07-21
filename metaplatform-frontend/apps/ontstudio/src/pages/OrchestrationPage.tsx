import { useEffect, useRef } from 'react';
import { Card, Empty, Typography } from 'antd';
import { Graph } from '@antv/x6';

interface OrchestrationStep {
  id: string;
  type: string;
  name: string;
}

interface OrchestrationPageProps {
  steps?: OrchestrationStep[];
}

const DEFAULT_STEPS: OrchestrationStep[] = [
  { id: 's1', type: 'input', name: '读取数据' },
  { id: 's2', type: 'transform', name: '数据清洗' },
  { id: 's3', type: 'condition', name: '校验' },
  { id: 's4', type: 'output', name: '写入数据库' },
];

export default function OrchestrationPage({ steps = DEFAULT_STEPS }: OrchestrationPageProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const graph = new Graph({
      container: ref.current,
      width: ref.current.clientWidth,
      height: 400,
      background: { color: '#fafafa' },
      grid: { visible: true, type: 'dot' },
      panning: true,
    });

    steps.forEach((s, i) => {
      graph.addNode({
        x: 60 + i * 200,
        y: 150,
        width: 160,
        height: 80,
        label: `${s.name}\n(${s.type})`,
        attrs: {
          body: { fill: '#e6f4ff', stroke: '#1677ff', rx: 8 },
          label: { fontSize: 12, fill: '#333' },
        },
      });
    });

    for (let i = 0; i < steps.length - 1; i++) {
      graph.addEdge({
        source: { x: 60 + i * 200 + 160, y: 190 },
        target: { x: 60 + (i + 1) * 200, y: 190 },
        attrs: { line: { stroke: '#52c41a', strokeWidth: 2 } },
      });
    }

    return () => graph.dispose();
  }, [steps]);

  if (steps.length === 0) return <Empty />;

  return (
    <Card title="Action 编排预览">
      <Typography.Paragraph type="secondary">
        基于 X6 渲染编排流程：{steps.length} 个步骤按顺序串联
      </Typography.Paragraph>
      <div ref={ref} style={{ width: '100%', height: 400, border: '1px solid #f0f0f0' }} />
    </Card>
  );
}
