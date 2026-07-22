import { useEffect, useState } from 'react';
import { Card, Button, Space, Empty, Tag } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BorderOutlined,
} from '@ant-design/icons';
import { get, post } from '@/api/client';
import type { PageDesignerConfig, DashboardWidget, DashboardWidgetType, DataSourceBinding } from '@/api/pages';

interface DashboardCanvasProps {
  config: PageDesignerConfig;
  onChange: (c: PageDesignerConfig) => void;
  onPreview: (w: DashboardWidget) => void;
}

const TYPE_LABELS: Record<DashboardWidgetType, { label: string; color: string }> = {
  table: { label: '表格', color: 'blue' },
  'chart-bar': { label: '柱状图', color: 'cyan' },
  'chart-line': { label: '折线图', color: 'green' },
  'chart-pie': { label: '饼图', color: 'orange' },
  'chart-area': { label: '面积图', color: 'geekblue' },
  'chart-scatter': { label: '散点图', color: 'magenta' },
  gauge: { label: '仪表盘', color: 'red' },
  iframe: { label: '嵌入网页', color: 'volcano' },
  'rich-text': { label: '富文本', color: 'gold' },
  stat: { label: '统计', color: 'purple' },
  text: { label: '文本', color: 'default' },
};

interface DataSourceResult {
  data: unknown[];
  loading: boolean;
  error?: string;
}

/**
 * 数据源绑定 hook：根据 DataSourceBinding.type 调用对应后端 API，
 * 失败时直接抛错（由调用方处理），支持 refreshInterval 自动刷新。
 */
export function useDataSource(binding: DataSourceBinding | undefined): DataSourceResult {
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const filterKey = binding?.filter ? JSON.stringify(binding.filter) : '';

  useEffect(() => {
    if (!binding || !binding.type) {
      setData([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    if (binding.type === 'static') {
      const staticData = binding.filter ? Object.values(binding.filter) : [];
      setData(staticData);
      setLoading(false);
      setError(undefined);
      return;
    }

    let cancelled = false;
    const sourceId = binding.sourceId || '';
    const query = binding.query || '';

    const fetchData = async () => {
      setLoading(true);
      try {
        let result: unknown[];
        switch (binding.type) {
          case 'ontology':
            result = await get<unknown[]>(`/v1/ont/concepts/${sourceId}/entities`);
            break;
          case 'rag':
            result = await post<unknown[]>('/v1/rag/search', { query, ...binding.filter });
            break;
          case 'data':
            result = await post<unknown[]>(
              `/v1/data/datasources/${sourceId}/query`,
              { query, ...binding.filter }
            );
            break;
          case 'api':
            result = await get<unknown[]>(sourceId);
            break;
          default:
            result = [];
        }
        if (!cancelled) {
          setData(result);
          setError(undefined);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '数据源加载失败';
        if (!cancelled) {
          setData([]);
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (binding.refreshInterval && binding.refreshInterval > 0) {
      intervalId = setInterval(fetchData, binding.refreshInterval * 1000);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [binding?.type, binding?.sourceId, binding?.query, binding?.refreshInterval, filterKey]);

  return { data, loading, error };
}

function describeDataSource(binding: DataSourceBinding | undefined): string {
  if (!binding || !binding.type) return '';
  const parts: string[] = [binding.type];
  if (binding.sourceId) parts.push(binding.sourceId);
  if (binding.query) parts.push(binding.query);
  return parts.join(' / ');
}

export default function DashboardCanvas({ config, onChange, onPreview }: DashboardCanvasProps) {
  const handleAdd = (type: DashboardWidgetType) => {
    const w: DashboardWidget = {
      id: `w_${Date.now().toString(36)}`,
      type,
      title: `新${TYPE_LABELS[type].label}`,
      position: { x: 0, y: config.widgets.length * 100, w: 6, h: 2 },
      dataSource: { type: 'static' },
      apiExample: '',
    };
    onChange({ ...config, widgets: [...config.widgets, w] });
  };

  const handleDelete = (id: string) => {
    onChange({ ...config, widgets: config.widgets.filter((w) => w.id !== id) });
  };

  return (
    <div>
      <Card size="small" title="添加组件" style={{ marginBottom: 16 }}>
        <Space wrap>
          {(Object.keys(TYPE_LABELS) as DashboardWidgetType[]).map((t) => (
            <Button key={t} icon={<PlusOutlined />} onClick={() => handleAdd(t)}>
              {TYPE_LABELS[t].label}
            </Button>
          ))}
        </Space>
      </Card>

      {config.widgets.length === 0 ? (
        <Empty description="画布为空，点击上方按钮添加组件" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 12,
          }}
        >
          {config.widgets.map((w) => (
            <Card
              key={w.id}
              size="small"
              style={{
                gridColumn: `span ${w.position.w}`,
                minHeight: 120,
              }}
              title={
                <Space>
                  <BorderOutlined />
                  <span>{w.title}</span>
                  <Tag color={TYPE_LABELS[w.type].color}>{TYPE_LABELS[w.type].label}</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onPreview(w)}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(w.id)}
                  />
                </Space>
              }
            >
              <div
                style={{
                  color: '#999',
                  fontSize: 12,
                  padding: '24px 0',
                  textAlign: 'center',
                }}
              >
                {describeDataSource(w.dataSource) ? (
                  <code>{describeDataSource(w.dataSource)}</code>
                ) : (
                  '配置数据源后展示数据'
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
