import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Tag, Typography, List, Button } from 'antd';
import { getOntologyMappings } from '@/api/ontologyMapping';
import OntologyMappingGraph from '@/components/OntologyMapping';
import type { OntologyMapping, ImpactAnalysisResult } from '@/types';

const MAPPING_TAG: Record<string, { color: string; label: string }> = {
  direct: { color: 'green', label: '直接映射' },
  partial: { color: 'orange', label: '部分映射' },
  planned: { color: 'default', label: '计划映射' },
};

export default function OntologyMappingPage() {
  const [mappings, setMappings] = useState<OntologyMapping[]>([]);
  const [impact, setImpact] = useState<ImpactAnalysisResult | null>(null);

  useEffect(() => {
    getOntologyMappings().then(setMappings);
  }, []);

  const handleImpact = useCallback((result: ImpactAnalysisResult) => {
    setImpact(result);
  }, []);

  const RISK_TAG: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };

  return (
    <div>
      <Card title="能力-本体映射可视化">
        <OntologyMappingGraph mappings={mappings} onImpact={handleImpact} />
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card title="映射列表" size="small">
            <List
              dataSource={mappings}
              renderItem={(m) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Typography.Text>{m.capabilityName} <span style={{ color: '#999' }}>→</span> {m.conceptName}</Typography.Text>}
                    description={<Tag color={MAPPING_TAG[m.mappingType]?.color}>{MAPPING_TAG[m.mappingType]?.label}</Tag>}
                  />
                  <Typography.Text type="secondary">置信度 {m.confidence}%</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="影响分析" size="small">
            {impact ? (
              <div>
                <Tag color={RISK_TAG[impact.riskLevel]}>风险等级: {impact.riskLevel}</Tag>
                <Typography.Title level={5} style={{ marginTop: 16 }}>受影响能力</Typography.Title>
                <List size="small" dataSource={impact.affectedCapabilities} renderItem={(id) => <List.Item>{mappings.find((m) => m.capabilityId === id)?.capabilityName || id}</List.Item>} />
                <Typography.Title level={5} style={{ marginTop: 16 }}>受影响应用</Typography.Title>
                <List size="small" dataSource={impact.affectedApplications} renderItem={(id) => <List.Item>{id}</List.Item>} />
                <Typography.Title level={5} style={{ marginTop: 16 }}>受影响流程</Typography.Title>
                <List size="small" dataSource={impact.affectedProcesses} renderItem={(id) => <List.Item>{id}</List.Item>} />
              </div>
            ) : (
              <Typography.Text type="secondary">双击左侧能力节点查看影响分析</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
