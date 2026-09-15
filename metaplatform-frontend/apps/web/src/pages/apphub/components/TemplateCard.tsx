import { Card, Tag, Typography, Button, Space, Rating } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  DownloadOutlined,
  EyeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { TemplateItem } from '@/api/apphub/marketplace';
import '../apps.css';

interface TemplateCardProps {
  template: TemplateItem;
  onPreview: (t: TemplateItem) => void;
  onInstall: (t: TemplateItem) => void;
}

const CATEGORY_COLOR: Record<TemplateItem['category'], TagColor> = {
  OA: 'blue',
  CRM: 'orange',
  HR: 'green',
  Finance: 'yellow',
  Project: 'purple',
  Other: 'grey',
};

export default function TemplateCard({ template, onPreview, onInstall }: TemplateCardProps) {
  return (
    <Card
      shadows="hover"
      cover={
        <div
          className="mp-justify-center mp-text-xl mp-flex-center mp-app-cover"
        >
          <AppstoreOutlined />
        </div>
      }
      actions={[
        <Button
          key="preview"
          theme="borderless"
          type="tertiary"
          icon={<EyeOutlined />}
          onClick={() => onPreview(template)}
        >
          详情
        </Button>,
        <Button
          key="install"
          theme="borderless"
          type="tertiary"
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
              type="tertiary"
              ellipsis={{ rows: 2 }}
              className="mp-mb-2 mp-app-min-44"
            >
              {template.description}
            </Typography.Paragraph>
            <Space spacing={4} wrap>
              {template.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </Space>
            <div className="mp-flex mp-justify-between mp-mt-2">
              <Rating disabled defaultValue={template.rating} allowHalf />
              <Typography.Text type="tertiary" className="mp-text-sm">
                {template.downloadCount} 安装
              </Typography.Text>
            </div>
          </div>
        }
      />
    </Card>
  );
}
