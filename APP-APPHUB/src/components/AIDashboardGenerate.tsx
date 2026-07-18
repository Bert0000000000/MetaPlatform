import { useState } from 'react';
import { Button, Card, Empty, Input, Space, Tag, Typography, message, Spin } from 'antd';
import { ThunderboltOutlined, BarChartOutlined } from '@ant-design/icons';
import { generateDashboard } from '@/api/generate';
import type { DashboardWidget, DataSourceBinding } from '@/api/pages';
import type { DashboardGenResult } from '@/types';

interface AIDashboardGenerateProps {
  onApply: (widgets: DashboardWidget[]) => void;
}

export default function AIDashboardGenerate({ onApply }: AIDashboardGenerateProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DashboardGenResult | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('请输入描述');
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
    message.success('已应用');
    setResult(null);
    setPrompt('');
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Title level={5}>
          <BarChartOutlined /> AI 仪表盘生成
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          描述业务场景，AI 自动推荐组件、数据源和 API 示例。
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder="例如：HR 视角的员工管理仪表盘：显示总数、新增趋势、流失率、部门分布"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={loading}
          onClick={handleGenerate}
        >
          生成
        </Button>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        )}

        {result && !loading && (
          <>
            <Card title={result.title} size="small">
              <Typography.Paragraph type="secondary">
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
              <Card title="API 示例" size="small">
                {result.apiExamples.map((ex: DashboardGenResult['apiExamples'][number], i: number) => (
                  <Card key={i} type="inner" size="small" style={{ marginBottom: 8 }}>
                    <Typography.Text strong>
                      {ex.method} {ex.url}
                    </Typography.Text>
                    <Typography.Paragraph style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                      {ex.description}
                    </Typography.Paragraph>
                    <pre
                      style={{
                        background: '#fafafa',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 11,
                        margin: 0,
                      }}
                    >
                      <code>{ex.curl}</code>
                    </pre>
                  </Card>
                ))}
              </Card>
            )}

            <Button type="primary" onClick={handleApply} block>
              应用到画布
            </Button>
          </>
        )}

        {!result && !loading && <Empty description="暂无生成结果" />}
      </Space>
    </div>
  );
}
