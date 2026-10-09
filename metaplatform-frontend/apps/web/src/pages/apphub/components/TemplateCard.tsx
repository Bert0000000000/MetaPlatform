import { Card, Tag, Typography, Button, Space } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  DownloadOutlined,
  EyeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { canInstallTemplate, type TemplateItem } from '@/api/apphub/marketplace';
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
          disabled={!canInstallTemplate(template.templateId)}
          title={!canInstallTemplate(template.templateId) ? '该模板尚未关联可安装的市场制品' : undefined}
          onClick={() => onInstall(template)}
        >
          {canInstallTemplate(template.templateId) ? '安装' : '安装暂不可用'}
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
          </div>
        }
      />
    </Card>
  );
}
