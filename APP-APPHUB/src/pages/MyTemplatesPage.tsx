import { useEffect, useMemo, useState } from 'react';
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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import * as Icons from '@ant-design/icons';
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  loadUserTemplates,
  removeUserTemplate,
  type UserTemplate,
} from '@/data/templates';

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return <Icons.AppstoreOutlined />;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : <Icons.AppstoreOutlined />;
}

export default function MyTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'installed' | 'created'>('all');

  const refresh = () => {
    setTemplates(loadUserTemplates());
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'installed') return templates.filter((t) => t.source === 'installed');
    if (activeTab === 'created') return templates.filter((t) => t.source === 'created');
    return templates;
  }, [templates, activeTab]);

  const handleDelete = (t: UserTemplate) => {
    removeUserTemplate(t.templateId);
    message.success(`已删除模板：${t.name}`);
    refresh();
  };

  const handlePublish = (t: UserTemplate) => {
    // mock：投稿到应用市场（实际只是 toast）
    message.success(`模板「${t.name}」已投稿到应用市场（mock，等待管理员审核）`);
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

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          items={[
            {
              key: 'all',
              label: `全部 (${templates.length})`,
            },
            {
              key: 'installed',
              label: `已安装 (${templates.filter((t) => t.source === 'installed').length})`,
            },
            {
              key: 'created',
              label: `已创建 (${templates.filter((t) => t.source === 'created').length})`,
            },
          ]}
          style={{ marginBottom: 16 }}
        />

        {filtered.length === 0 ? (
          <Empty description={activeTab === 'created' ? '还没有创建任何模板，点击"投稿新模板"开始' : '还没有安装任何模板，去应用市场看看吧'}>
            {activeTab !== 'created' ? (
              <Button type="primary" onClick={() => navigate('/market')}>
                去应用市场
              </Button>
            ) : (
              <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => navigate('/my-templates/submit')}>
                投稿新模板
              </Button>
            )}
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map((t) => (
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
                        background:
                          t.source === 'created'
                            ? 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)'
                            : 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
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
                    t.source === 'created' ? (
                      <Button
                        key="publish"
                        type="link"
                        icon={<Icons.CloudUploadOutlined />}
                        onClick={() => handlePublish(t)}
                      >
                        投稿市场
                      </Button>
                    ) : (
                      <Button
                        key="view"
                        type="link"
                        icon={<Icons.EyeOutlined />}
                        onClick={() => navigate(`/market/${t.templateId}`)}
                      >
                        查看原模板
                      </Button>
                    ),
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <Typography.Text strong>{t.name}</Typography.Text>
                        <Tag color={CATEGORY_COLOR[t.category]}>{CATEGORY_LABEL[t.category]}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Tag color={t.source === 'created' ? 'purple' : 'green'}>
                          {t.source === 'created' ? '已创建' : '已安装'}
                        </Tag>
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
                            {t.usageCount} 次使用
                          </Typography.Text>
                        </div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t.source === 'created' ? '创建于' : '安装于'}：{' '}
                          {new Date(t.installedAt).toLocaleDateString()}
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
