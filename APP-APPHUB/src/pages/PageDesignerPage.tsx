import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Tabs,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { getPage, savePage } from '@/api/pages';
import DashboardCanvas from '@/components/DashboardCanvas';
import TableWidget from '@/components/TableWidget';
import ChartWidget from '@/components/ChartWidget';
import AIDashboardGenerate from '@/components/AIDashboardGenerate';
import type {
  PageDesignerConfig,
  DashboardWidget,
  DataSourceBinding,
  DataSourceType,
} from '@/api/pages';
import type { DashboardGenResult } from '@/types';

const DATA_SOURCE_TYPE_OPTIONS: Array<{ label: string; value: DataSourceType }> = [
  { label: '本体 (TECH-ONT)', value: 'ontology' },
  { label: 'RAG 知识库 (TECH-RAG)', value: 'rag' },
  { label: '数据源 (TECH-DATA)', value: 'data' },
  { label: '静态数据', value: 'static' },
  { label: '自定义 API', value: 'api' },
];

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
  const [dsWidgetId, setDsWidgetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!pageId) return;
    getPage(pageId).then((c) => {
      let widgets = c.widgets;
      try {
        const raw = localStorage.getItem('metaplatform:designer:import');
        if (raw) {
          const data = JSON.parse(raw) as { type?: string; content?: string };
          localStorage.removeItem('metaplatform:designer:import');
          if (data.type === 'dashboard' && data.content) {
            const gen = JSON.parse(data.content) as DashboardGenResult;
            const importedWidgets: DashboardWidget[] = gen.widgets.map((w) => {
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
            widgets = [...widgets, ...importedWidgets];
            message.success(`从 AI 导入 ${importedWidgets.length} 个组件`);
          }
        }
      } catch {
        // ignore parse error
      }
      setConfig({ ...c, widgets });
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

  const handleTestScript = () => {
    const script = config.scripts?.onLoad;
    if (!script || !script.trim()) {
      message.warning('请先输入 onLoad 脚本');
      return;
    }
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('context', script);
      fn({ config, message });
      message.success('onLoad 脚本执行成功');
    } catch (e) {
      message.error(`脚本执行失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleUpdateScripts = (key: 'onLoad' | 'onShow', value: string) => {
    setConfig({
      ...config,
      scripts: { ...config.scripts, [key]: value },
    });
  };

  const selectedDsWidget = config.widgets.find((w) => w.id === dsWidgetId) || config.widgets[0];

  const handleUpdateWidgetDataSource = (id: string, patch: Partial<DataSourceBinding>) => {
    setConfig({
      ...config,
      widgets: config.widgets.map((w) => {
        if (w.id !== id) return w;
        const current: DataSourceBinding = w.dataSource || { type: 'static' };
        return { ...w, dataSource: { ...current, ...patch } };
      }),
    });
  };

  const renderWidget = (w: DashboardWidget) => {
    if (w.type === 'table') return <TableWidget widget={w} />;
    if (
      w.type === 'chart-bar' ||
      w.type === 'chart-line' ||
      w.type === 'chart-pie' ||
      w.type === 'chart-area' ||
      w.type === 'chart-scatter' ||
      w.type === 'gauge'
    ) {
      return <ChartWidget widget={w} />;
    }
    if (w.type === 'iframe') {
      const url = (w.config?.url as string) || '';
      return (
        <Card title={w.title} size="small">
          {url ? (
            <iframe
              title={w.title}
              src={url}
              style={{ width: '100%', height: 240, border: 'none' }}
            />
          ) : (
            <div style={{ color: '#999', padding: 24, textAlign: 'center' }}>
              请在 config.url 中配置嵌入地址
            </div>
          )}
        </Card>
      );
    }
    if (w.type === 'rich-text') {
      const content = (w.config?.content as string) || '';
      return (
        <Card title={w.title} size="small">
          <div style={{ minHeight: 80, padding: 12, whiteSpace: 'pre-wrap' }}>
            {content || '富文本内容为空'}
          </div>
        </Card>
      );
    }
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
            key: 'scripts',
            label: '页面脚本',
            children: (
              <Card>
                <Form layout="vertical" style={{ maxWidth: 720 }}>
                  <Typography.Paragraph type="secondary">
                    编辑页面生命周期脚本（onLoad / onShow）。脚本以字符串形式保存，运行时通过
                    <code> new Function('context', script) </code>
                    执行，<code>context</code> 包含当前页面配置与 antd message。
                  </Typography.Paragraph>
                  <Form.Item label="onLoad（页面加载时执行）">
                    <Input.TextArea
                      rows={8}
                      placeholder="// 可访问 context.config / context.message&#10;context.message.info('页面已加载');"
                      value={config.scripts?.onLoad || ''}
                      onChange={(e) => handleUpdateScripts('onLoad', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="onShow（页面显示时执行）">
                    <Input.TextArea
                      rows={6}
                      placeholder="// 可访问 context.config / context.message&#10;context.message.info('页面已展示');"
                      value={config.scripts?.onShow || ''}
                      onChange={(e) => handleUpdateScripts('onShow', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      icon={<PlayCircleOutlined />}
                      onClick={handleTestScript}
                    >
                      测试运行 onLoad
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'datasource',
            label: '数据源',
            children: (
              <Card>
                <Form layout="vertical" style={{ maxWidth: 720 }}>
                  {config.widgets.length === 0 ? (
                    <Typography.Text type="secondary">
                      画布暂无组件，请先在「设计」Tab 添加组件。
                    </Typography.Text>
                  ) : (
                    <>
                      <Form.Item label="选择组件">
                        <Select
                          value={selectedDsWidget?.id}
                          onChange={(v) => setDsWidgetId(v)}
                          options={config.widgets.map((w) => ({
                            label: `${w.title} (${w.type})`,
                            value: w.id,
                          }))}
                        />
                      </Form.Item>
                      {selectedDsWidget && (
                        <>
                          <Form.Item label="数据源类型">
                            <Select
                              value={selectedDsWidget.dataSource?.type || 'static'}
                              options={DATA_SOURCE_TYPE_OPTIONS}
                              onChange={(v: DataSourceType) =>
                                handleUpdateWidgetDataSource(selectedDsWidget.id, { type: v })
                              }
                            />
                          </Form.Item>
                          <Form.Item label="sourceId（本体概念ID / RAG知识库ID / 数据源ID / API URL）">
                            <Input
                              value={selectedDsWidget.dataSource?.sourceId || ''}
                              placeholder="例如 /v1/ont/concepts/employee 或 https://example.com/api"
                              onChange={(e) =>
                                handleUpdateWidgetDataSource(selectedDsWidget.id, {
                                  sourceId: e.target.value,
                                })
                              }
                            />
                          </Form.Item>
                          <Form.Item label="query（查询语句或 PromQL）">
                            <Input.TextArea
                              rows={3}
                              value={selectedDsWidget.dataSource?.query || ''}
                              placeholder="例如 MATCH (n:Employee) RETURN n 或 员工流失率趋势"
                              onChange={(e) =>
                                handleUpdateWidgetDataSource(selectedDsWidget.id, {
                                  query: e.target.value,
                                })
                              }
                            />
                          </Form.Item>
                          <Form.Item label="refreshInterval（秒，0 = 不自动刷新）">
                            <InputNumber
                              min={0}
                              value={selectedDsWidget.dataSource?.refreshInterval ?? 0}
                              onChange={(v) =>
                                handleUpdateWidgetDataSource(selectedDsWidget.id, {
                                  refreshInterval: typeof v === 'number' ? v : 0,
                                })
                              }
                              style={{ width: 200 }}
                            />
                          </Form.Item>
                          <Typography.Text type="secondary">
                            当前绑定：{JSON.stringify(selectedDsWidget.dataSource || { type: 'static' })}
                          </Typography.Text>
                        </>
                      )}
                    </>
                  )}
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
