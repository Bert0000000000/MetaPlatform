import { useState } from 'react';
import { Card, Form, Button, Table, Banner, Space } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { PageContainer } from '@mate/shared';
import { recommendModel, type RoutingRecommendation } from '@/api/superai/costOptimization';

const STRATEGY_OPTIONS = [
  { value: 'cheapest', label: '最便宜' },
  { value: 'balanced', label: '均衡' },
  { value: 'best_quality', label: '质量优先' },
];

const CAPABILITY_OPTIONS = [
  { value: 'CHAT', label: '对话' },
  { value: 'VISION', label: '视觉' },
  { value: 'FUNCTION_CALLING', label: '函数调用' },
];

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--foreground)' }}>{value}</div>
    </div>
  );
}

export default function CostOptimizationPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutingRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    try {
      const rec = await recommendModel({
        promptTokens: values.promptTokens,
        completionTokens: values.completionTokens,
        requiredCapabilities: values.requiredCapabilities || ['CHAT'],
        strategy: values.strategy || 'balanced',
      });
      setResult(rec);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '模型', dataIndex: 'displayName', key: 'displayName' },
    { title: '供应方', dataIndex: 'provider', key: 'provider' },
    { title: '预估成本', dataIndex: 'estimatedCost', key: 'estimatedCost', render: (v: number) => `$${v.toFixed(6)}` },
    { title: '预计延迟', dataIndex: 'estimatedLatencyMs', key: 'estimatedLatencyMs', render: (v: number) => `${v} ms` },
    { title: '评分', dataIndex: 'score', key: 'score' },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
  ];

  return (
    <PageContainer title="成本优化" description="选择性价比最高的模型">
      <Card title="路由模拟" style={{ marginBottom: 24 }}>
        <Form form={form} onSubmit={handleSubmit} initValues={{ promptTokens: 1000, completionTokens: 500, strategy: 'balanced', requiredCapabilities: ['CHAT'] }}>
          <Space wrap>
            <Form.InputNumber field="promptTokens" label="输入 Token" min={1} />
            <Form.InputNumber field="completionTokens" label="输出 Token" min={1} />
            <Form.Select field="strategy" label="策略" optionList={STRATEGY_OPTIONS} style={{ width: 140 }} />
            <Form.Select field="requiredCapabilities" label="必需能力" multiple optionList={CAPABILITY_OPTIONS} style={{ width: 180 }} />
            <Button theme="solid" type="primary" htmlType="submit" loading={loading}>获取推荐</Button>
          </Space>
        </Form>
      </Card>

      {error && <Banner type="danger" description={error} style={{ marginBottom: 24 }} />}

      {result && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card><StatItem label="推荐模型" value={result.recommendedDisplayName} /></Card>
            </Col>
            <Col span={8}>
              <Card><StatItem label="预估成本" value={`$${result.estimatedCost.toFixed(6)}`} /></Card>
            </Col>
            <Col span={8}>
              <Card><StatItem label="可节省" value={<>{`$${result.potentialSavings.toFixed(6)}`} <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>({Math.round(result.savingsRate * 100)}%)</span></>} /></Card>
            </Col>
          </Row>
          <Card title="候选模型排名">
            <Table
              rowKey="modelId"
              dataSource={result.candidates}
              columns={columns}
              pagination={false}
              onRow={(record) =>
                record && record.modelId === result.recommendedModelId
                  ? { style: { background: 'var(--semi-color-primary-light-default)' } }
                  : {}
              }
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </>
      )}
    </PageContainer>
  );
}
