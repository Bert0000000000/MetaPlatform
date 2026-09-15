import { useCallback, useMemo, useState } from 'react';
import { Banner, Button, Card, Form, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Sparkles } from 'lucide-react';
import { recommendModel, type CandidateModel, type RoutingRecommendation } from '@/api/superai/costOptimization';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';

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

interface RoutingFormValues {
  promptTokens: number;
  completionTokens: number;
  strategy?: 'cheapest' | 'balanced' | 'best_quality';
  requiredCapabilities?: string[];
}

/**
 * SuperAI · 成本优化。
 *
 * 数据面沿用 src/api/superai/costOptimization：recommendModel → POST /copilot/routing/recommend。
 * 保留原有请求体形状（promptTokens/completionTokens/requiredCapabilities/strategy）。
 * 推荐行改用「推荐」标签标注，不再用行内 background 样式。
 */
export default function CostOptimizationPage() {
  const [form] = Form.useForm<RoutingFormValues>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutingRecommendation | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (values: RoutingFormValues) => {
    setLoading(true);
    setError('');
    try {
      const rec = await recommendModel({
        promptTokens: values.promptTokens,
        completionTokens: values.completionTokens,
        requiredCapabilities: values.requiredCapabilities?.length ? values.requiredCapabilities : ['CHAT'],
        strategy: values.strategy ?? 'balanced',
      });
      setResult(rec);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const columns: ColumnProps<CandidateModel>[] = useMemo(
    () => [
      {
        title: '模型',
        dataIndex: 'displayName',
        width: 200,
        ellipsis: true,
        render: (v: string, row: CandidateModel) => (
          <span className="mp-exec-step-head">
            <span className="mp-exec-step-title">{v}</span>
            {row.modelId === result?.recommendedModelId ? (
              <Tag size="small" type="light" color="green">
                推荐
              </Tag>
            ) : null}
          </span>
        ),
      },
      { title: '供应方', dataIndex: 'provider', width: 120 },
      {
        title: '预估成本',
        dataIndex: 'estimatedCost',
        width: 130,
        render: (v: number) => `$${(v ?? 0).toFixed(6)}`,
      },
      {
        title: '预计延迟',
        dataIndex: 'estimatedLatencyMs',
        width: 120,
        render: (v: number) => (typeof v === 'number' ? `${v} ms` : '—'),
      },
      { title: '评分', dataIndex: 'score', width: 90, render: (v: number) => (typeof v === 'number' ? v : '—') },
      { title: '原因', dataIndex: 'reason', ellipsis: true },
    ],
    [result],
  );

  return (
    <>
      <PageHeader title="成本优化" desc="按 token 用量与能力要求，选择性价比最高的模型" />

      <Card title="路由模拟">
        <Form
          form={form}
          onSubmit={(values) => void handleSubmit(values as RoutingFormValues)}
          initValues={{
            promptTokens: 1000,
            completionTokens: 500,
            strategy: 'balanced',
            requiredCapabilities: ['CHAT'],
          }}
        >
          <Form.InputNumber field="promptTokens" label="输入 Token" min={1} rules={[{ required: true }]} />
          <Form.InputNumber field="completionTokens" label="输出 Token" min={1} rules={[{ required: true }]} />
          <Form.Select field="strategy" label="策略" optionList={STRATEGY_OPTIONS} />
          <Form.Select field="requiredCapabilities" label="必需能力" multiple optionList={CAPABILITY_OPTIONS} />
          <Button
            theme="solid"
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<Sparkles size={15} strokeWidth={1.5} />}
          >
            获取推荐
          </Button>
        </Form>
      </Card>

      {error ? <Banner type="danger" closeIcon={null} description={error} /> : null}

      {result ? (
        <>
          <div className="mp-exec-kpis">
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">推荐模型</span>
                <span className="mp-exec-kpi-value">{result.recommendedDisplayName}</span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">预估成本</span>
                <span className="mp-exec-kpi-value">${(result.estimatedCost ?? 0).toFixed(6)}</span>
              </div>
            </Card>
            <Card>
              <div className="mp-exec-kpi">
                <span className="mp-exec-kpi-label">可节省</span>
                <span className="mp-exec-kpi-value">
                  ${(result.potentialSavings ?? 0).toFixed(6)} · {Math.round((result.savingsRate ?? 0) * 100)}%
                </span>
              </div>
            </Card>
          </div>

          <Card title="候选模型排名">
            <DataTablePro<CandidateModel>
              columns={columns}
              dataSource={result.candidates ?? []}
              rowKey="modelId"
              empty={
                <EmptyState
                  illustration="no-content"
                  title="没有候选模型"
                  desc="后端未返回 candidates。"
                />
              }
            />
          </Card>
        </>
      ) : (
        <EmptyState
          illustration="idle"
          title="还没有推荐结果"
          desc="填写 token 用量与能力要求，获取模型路由推荐。"
        />
      )}
    </>
  );
}
