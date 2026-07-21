import { Card, Space, Typography } from 'antd';
import { listConcepts } from '@/api/concepts';
import { useEffect, useState } from 'react';
import KnowledgeGraphViewer from '@/components/KnowledgeGraphViewer';
import CypherConsole from '@/components/CypherConsole';
import type { Concept } from '@/types';

export default function KnowledgeGraphPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);

  useEffect(() => {
    listConcepts().then((r) => setConcepts(r.items));
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
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card>
          <Space style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary">
              共 {nodes.length} 个节点 · {edges.length} 条关系
            </Typography.Text>
          </Space>
          <KnowledgeGraphViewer nodes={nodes} edges={edges} />
        </Card>
        <Card title="Cypher 查询控制台" size="small">
          <CypherConsole />
        </Card>
      </Space>
    </div>
  );
}
