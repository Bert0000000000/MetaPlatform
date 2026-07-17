import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Rate,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { getTemplate, installTemplate } from '@/api/marketplace';
import type { TemplateItem } from '@/api/marketplace';

export default function MarketplaceDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (templateId) {
      getTemplate(templateId).then((t) => {
        setTemplate(t);
        setLoading(false);
      });
    }
  }, [templateId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  if (!template) return <Empty />;

  const handleInstall = async () => {
    const res = await installTemplate(template.templateId);
    if (res.success) {
      message.success('已安装');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/marketplace')}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {template.name}
        </Typography.Title>
        <Tag color="blue">{template.category}</Tag>
        <Rate disabled defaultValue={template.rating} allowHalf />
      </Space>

      <Card>
        <Typography.Paragraph>{template.description}</Typography.Paragraph>
        <Space wrap>
          {template.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
        <div style={{ marginTop: 16 }}>
          <Typography.Text>已安装 {template.downloadCount} 次</Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          style={{ marginTop: 16 }}
          onClick={handleInstall}
        >
          安装到我的应用
        </Button>
      </Card>
    </div>
  );
}
