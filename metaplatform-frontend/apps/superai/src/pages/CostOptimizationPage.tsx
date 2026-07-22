import { useState } from 'react';
import { Card, Form, InputNumber, Select, Button, Table, Alert, Statistic, Row, Col } from 'antd';
import { PageContainer } from '@mate/shared';
import { recommendModel, type RoutingRecommendation } from '@/api/costOptimization';

const { Option } = Select;

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
        <Form form={form} layout="inline" onFinish={handleSubmit} initialValues={{ promptTokens: 1000, completionTokens: 500, strategy: 'balanced', requiredCapabilities: ['CHAT'] }}>
          <Form.Item name="promptTokens" label="输入 Token">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="completionTokens" label="输出 Token">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="strategy" label="策略">
            <Select style={{ width: 140 }}>
              <Option value="cheapest">最便宜</Option>
              <Option value="balanced">均衡</Option>
              <Option value="best_quality">质量优先</Option>
            </Select>
          </Form.Item>
          <Form.Item name="requiredCapabilities" label="必需能力">
            <Select mode="multiple" style={{ width: 180 }}>
              <Option value="CHAT">对话</Option>
              <Option value="VISION">视觉</Option>
              <Option value="FUNCTION_CALLING">函数调用</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>获取推荐</Button>
          </Form.Item>
        </Form>
      </Card>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}

      {result && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card><Statistic title="推荐模型" value={result.recommendedDisplayName} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="预估成本" value={`$${result.estimatedCost.toFixed(6)}`} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="可节省" value={`$${result.potentialSavings.toFixed(6)}`} suffix={`(${Math.round(result.savingsRate * 100)}%)`} /></Card>
            </Col>
          </Row>
          <Card title="候选模型排名">
            <Table
              rowKey="modelId"
              dataSource={result.candidates}
              columns={columns}
              pagination={false}
              rowClassName={(record) => (record.modelId === result.recommendedModelId ? 'ant-table-row-selected' : '')}
             scroll={{ x: 'max-content' }}/>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
