import { Card, Tag, Typography, Button, Space, Rate } from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { TemplateItem } from '@/api/marketplace';

interface TemplateCardProps {
  template: TemplateItem;
  onPreview: (t: TemplateItem) => void;
  onInstall: (t: TemplateItem) => void;
}

const CATEGORY_COLOR: Record<TemplateItem['category'], string> = {
  OA: 'blue',
  CRM: 'orange',
  HR: 'green',
  Finance: 'gold',
  Project: 'purple',
  Other: 'default',
};

export default function TemplateCard({ template, onPreview, onInstall }: TemplateCardProps) {
  return (
    <Card
      hoverable
      cover={
        <div
          style={{
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
            color: '#fff',
            fontSize: 48,
          }}
        >
          <AppstoreOutlined />
        </div>
      }
      actions={[
        <Button
          key="preview"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => onPreview(template)}
        >
          详情
        </Button>,
        <Button
          key="install"
          type="link"
          icon={<DownloadOutlined />}
          onClick={() => onInstall(template)}
        >
          安装
        </Button>,
      ]}
    >
      <Card.Meta
        title={
          <Space>
            <Typography.Text strong>{template.name}</Typography.Text>
            <Tag color={CATEGORY_COLOR[template.category]}>{template.category}</Tag>
          </Space>
        }
        description={
          <div>
            <Typography.Paragraph
              type="secondary"
              ellipsis={{ rows: 2 }}
              style={{ minHeight: 44, marginBottom: 8 }}
            >
              {template.description}
            </Typography.Paragraph>
            <Space size={4} wrap>
              {template.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Space>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Rate disabled defaultValue={template.rating} allowHalf />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {template.downloadCount} 安装
              </Typography.Text>
            </div>
          </div>
        }
      />
    </Card>
  );
}
