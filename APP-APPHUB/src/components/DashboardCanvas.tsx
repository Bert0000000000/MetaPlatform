import { Card, Button, Space, Empty, Tag } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BorderOutlined,
} from '@ant-design/icons';
import type { PageDesignerConfig, DashboardWidget } from '@/api/pages';

interface DashboardCanvasProps {
  config: PageDesignerConfig;
  onChange: (c: PageDesignerConfig) => void;
  onPreview: (w: DashboardWidget) => void;
}

const TYPE_LABELS: Record<DashboardWidget['type'], { label: string; color: string }> = {
  table: { label: '表格', color: 'blue' },
  'chart-bar': { label: '柱状图', color: 'cyan' },
  'chart-line': { label: '折线图', color: 'green' },
  'chart-pie': { label: '饼图', color: 'orange' },
  stat: { label: '统计', color: 'purple' },
  text: { label: '文本', color: 'default' },
};

export default function DashboardCanvas({ config, onChange, onPreview }: DashboardCanvasProps) {
  const handleAdd = (type: DashboardWidget['type']) => {
    const w: DashboardWidget = {
      id: `w_${Date.now().toString(36)}`,
      type,
      title: `新${TYPE_LABELS[type].label}`,
      position: { x: 0, y: config.widgets.length * 100, w: 6, h: 2 },
      dataSource: '',
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
          {(Object.keys(TYPE_LABELS) as DashboardWidget['type'][]).map((t) => (
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
                {w.dataSource ? (
                  <code>{w.dataSource}</code>
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
