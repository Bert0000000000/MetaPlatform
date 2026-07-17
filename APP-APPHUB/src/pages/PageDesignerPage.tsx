import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Spin,
  Tabs,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import { getPage, savePage } from '@/api/pages';
import DashboardCanvas from '@/components/DashboardCanvas';
import TableWidget from '@/components/TableWidget';
import ChartWidget from '@/components/ChartWidget';
import AIDashboardGenerate from '@/components/AIDashboardGenerate';
import type { PageDesignerConfig, DashboardWidget } from '@/api/pages';

export default function PageDesignerPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<PageDesignerConfig>({
    name: '新页面',
    widgets: [],
    layout: 'grid',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<DashboardWidget | null>(null);

  useEffect(() => {
    if (!pageId) return;
    getPage(pageId).then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, [pageId]);

  const handleSave = async () => {
    if (!pageId) return;
    setSaving(true);
    try {
      await savePage(pageId, config);
      message.success('已保存');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAIGenerated = (widgets: DashboardWidget[]) => {
    setConfig({
      ...config,
      widgets: [...config.widgets, ...widgets],
    });
    message.success('已应用 AI 生成的组件');
  };

  const renderWidget = (w: DashboardWidget) => {
    if (w.type === 'table') return <TableWidget widget={w} />;
    if (w.type.startsWith('chart-')) return <ChartWidget widget={w} />;
    if (w.type === 'stat') {
      return (
        <Card title={w.title} size="small">
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>
            {Math.floor(Math.random() * 10000)}
          </div>
          <Typography.Text type="secondary">同比 +12%</Typography.Text>
        </Card>
      );
    }
    return (
      <Card title={w.title} size="small">
        <div style={{ minHeight: 80, padding: 12 }}>{(w.config?.text as string) || '文本'}</div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          页面设计器 - {config.name}
        </Typography.Title>
        <Button
          icon={<EyeOutlined />}
          onClick={() => setPreviewing(config.widgets[0] ?? null)}
        >
          预览
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存
        </Button>
      </Space>

      <Tabs
        items={[
          {
            key: 'design',
            label: '设计',
            children: (
              <DashboardCanvas
                config={config}
                onChange={setConfig}
                onPreview={setPreviewing}
              />
            ),
          },
          {
            key: 'settings',
            label: '属性',
            children: (
              <Card>
                <Form layout="vertical" style={{ maxWidth: 720 }}>
                  <Form.Item label="页面名称">
                    <Input
                      value={config.name}
                      onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    />
                  </Form.Item>
                  <Form.Item label="描述">
                    <Input.TextArea
                      rows={2}
                      value={config.description || ''}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    />
                  </Form.Item>
                  <Form.Item label="布局">
                    <Tabs
                      items={[
                        { key: 'grid', label: '网格' },
                        { key: 'free', label: '自由' },
                      ]}
                      activeKey={config.layout}
                      onChange={(k) => setConfig({ ...config, layout: k as 'grid' | 'free' })}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'ai',
            label: 'AI 生成',
            children: (
              <AIDashboardGenerate
                onApply={handleApplyAIGenerated}
              />
            ),
          },
          {
            key: 'preview',
            label: '预览',
            children: (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gap: 12,
                }}
              >
                {config.widgets.map((w) => (
                  <div key={w.id} style={{ gridColumn: `span ${w.position.w}` }}>
                    {renderWidget(w)}
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />

      {previewing && (
        <Card
          title={`预览：${previewing.title}`}
          style={{ marginTop: 16 }}
        >
          {renderWidget(previewing)}
        </Card>
      )}
    </div>
  );
}
