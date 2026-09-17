import { useState } from 'react';
import { Button, Card, Empty, Input, Space, Spin, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { ThunderboltOutlined, BarChartOutlined } from '@ant-design/icons';
import { generateDashboard } from '@/api/apphub/generate';
import type { DashboardWidget, DataSourceBinding } from '@/api/apphub/pages';
import type { DashboardGenResult } from '@/api/apphub/types';

interface AIDashboardGenerateProps {
  onApply: (widgets: DashboardWidget[]) => void;
}

export default function AIDashboardGenerate({ onApply }: AIDashboardGenerateProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DashboardGenResult | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Toast.warning('请输入描述');
      return;
    }
    setLoading(true);
    try {
      const r = await generateDashboard(prompt);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    const widgets: DashboardWidget[] = result.widgets.map((w: DashboardGenResult['widgets'][number]) => {
      const ds: DataSourceBinding = w.dataSource
        ? { type: 'api', sourceId: w.dataSource }
        : { type: 'static' };
      return {
        id: `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: (w.type as DashboardWidget['type']) || 'stat',
        title: w.title,
        dataSource: ds,
        apiExample: w.apiExample,
        position: { x: 0, y: 0, w: 6, h: 2 },
      };
    });
    onApply(widgets);
    Toast.success('已应用');
    setResult(null);
    setPrompt('');
  };

  return (
    <div>
      <Space vertical className="mp-w-full">
        <Typography.Title heading={5}>
          <BarChartOutlined /> AI 仪表盘生成
        </Typography.Title>
        <Typography.Paragraph type="tertiary">
          描述业务场景，AI 自动推荐组件、数据源和 API 示例。
        </Typography.Paragraph>
        <TextArea
          rows={3}
          placeholder="例如：HR 视角的员工管理仪表盘：显示总数、新增趋势、流失率、部门分布"
          value={prompt}
          onChange={(value) => setPrompt(value)}
        />
        <Button
          theme="solid"
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={handleGenerate}
        >
          生成
        </Button>

        {loading && (
          <div className="mp-text-center mp-p-8">
            <Spin />
          </div>
        )}

        {result && !loading && (
          <>
            <Card title={result.title}>
              <Typography.Paragraph type="tertiary">
                {result.description}
              </Typography.Paragraph>
              <Space wrap>
                {result.widgets.map((w: DashboardGenResult['widgets'][number]) => (
                  <Tag key={w.id} color="blue">
                    {w.title} - {w.type}
                  </Tag>
                ))}
              </Space>
            </Card>

            {result.apiExamples.length > 0 && (
              <Card title="API 示例">
                {result.apiExamples.map((ex: DashboardGenResult['apiExamples'][number], i: number) => (
                  <Card key={i} className="mp-mb-2">
                    <Typography.Text strong>
                      {ex.method} {ex.url}
                    </Typography.Text>
                    <Typography.Paragraph className="mp-mb-1 mp-text-sm mp-text-2">
                      {ex.description}
                    </Typography.Paragraph>
                    <pre
                      className="mp-p-2 mp-m-0 mp-text-xs mp-bg-fill-0 mp-rounded-sm"
                    >
                      <code>{ex.curl}</code>
                    </pre>
                  </Card>
                ))}
              </Card>
            )}

            <Button theme="solid" type="primary" onClick={handleApply} block>
              应用到画布
            </Button>
          </>
        )}

        {!result && !loading && <Empty description="暂无生成结果" />}
      </Space>
    </div>
  );
}
