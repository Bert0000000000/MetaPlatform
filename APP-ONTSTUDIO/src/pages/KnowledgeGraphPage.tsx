import { Card, Space, Typography } from 'antd';
import { listConcepts } from '@/api/concepts';
import { useEffect, useState } from 'react';
import KnowledgeGraphViewer from '@/components/KnowledgeGraphViewer';
import type { Concept } from '@/types';

export default function KnowledgeGraphPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);

  useEffect(() => {
    listConcepts({}).then((r) => setConcepts(r.items));
  }, []);

  const nodes = concepts.map((c) => ({
    id: c.conceptId,
    label: c.name,
    type: 'concept' as const,
  }));

  const edges = concepts
    .filter((c) => c.parentConceptId)
    .map((c) => ({
      source: c.parentConceptId!,
      target: c.conceptId,
      label: 'is-a',
    }));

  return (
    <div>
      <Typography.Title level={4}>知识图谱</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary">
            共 {nodes.length} 个节点 · {edges.length} 条关系
          </Typography.Text>
        </Space>
        <KnowledgeGraphViewer nodes={nodes} edges={edges} />
      </Card>
    </div>
  );
}
