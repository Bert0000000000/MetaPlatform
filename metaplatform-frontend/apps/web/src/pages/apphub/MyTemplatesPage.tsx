import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Empty,
  Popconfirm,
  Rate,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import * as Icons from '@ant-design/icons';
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  removeUserTemplate,
  type TemplateCategory,
} from './data/templates';
import { listTemplates, type TemplateItem } from '@/api/apphub/marketplace';
import { getUser } from '@mate/shared';

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return <Icons.AppstoreOutlined />;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : <Icons.AppstoreOutlined />;
}

export default function MyTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = getUser();
      const all = await listTemplates();
      // listTemplates 不支持 createdBy 过滤，前端按 author 字段过滤当前用户的模板
      const mine = currentUser
        ? all.filter((t) => t.author === currentUser.username)
        : [];
      setTemplates(mine);
    } catch {
      message.error('加载模板列表失败');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = (t: TemplateItem) => {
    removeUserTemplate(t.templateId);
    setTemplates((prev) => prev.filter((x) => x.templateId !== t.templateId));
    message.success(`已删除模板：${t.name}`);
  };

  const handlePublish = (t: TemplateItem) => {
    message.success(`模板「${t.name}」已投稿到应用市场，等待管理员审核`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <Icons.AppstoreOutlined /> 我的模板
        </Typography.Title>
        <Space>
          <Button icon={<Icons.AppstoreOutlined />} onClick={() => navigate('/market')}>
            浏览应用市场
          </Button>
          <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => navigate('/my-templates/submit')}>
            投稿新模板
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        {templates.length === 0 ? (
          <Empty description="还没有创建任何模板，点击&quot;投稿新模板&quot;开始">
            <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => navigate('/my-templates/submit')}>
              投稿新模板
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {templates.map((t) => (
              <Col key={t.templateId} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  cover={
                    <div
                      style={{
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
                        color: '#fff',
                        fontSize: 48,
                      }}
                    >
                      {renderIcon(t.icon)}
                    </div>
                  }
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="确认删除"
                      description={`确定删除模板「${t.name}」吗？`}
                      onConfirm={() => handleDelete(t)}
                    >
                      <Button type="link" icon={<Icons.DeleteOutlined />} danger>
                        删除
                      </Button>
                    </Popconfirm>,
                    <Button
                      key="publish"
                      type="link"
                      icon={<Icons.CloudUploadOutlined />}
                      onClick={() => handlePublish(t)}
                    >
                      投稿市场
                    </Button>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <Typography.Text strong>{t.name}</Typography.Text>
                        <Tag color={CATEGORY_COLOR[t.category as TemplateCategory] ?? 'default'}>
                          {CATEGORY_LABEL[t.category as TemplateCategory] ?? t.category}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ minHeight: 44, marginBottom: 8, marginTop: 8 }}
                        >
                          {t.description}
                        </Typography.Paragraph>
                        <Space size={4} wrap style={{ marginBottom: 4 }}>
                          {t.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Rate disabled value={t.rating} allowHalf style={{ fontSize: 12 }} />
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {t.usageCount ?? 0} 次使用
                          </Typography.Text>
                        </div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          创建于：{new Date(t.createdAt).toLocaleDateString()}
                        </Typography.Text>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
}
