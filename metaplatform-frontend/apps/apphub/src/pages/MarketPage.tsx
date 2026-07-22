import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Typography, Button, Space, Rate, Input, Select, Row, Col, Empty, Tooltip, message } from 'antd';
import * as Icons from '@ant-design/icons';
import {
  OFFICIAL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  computeTemplateRating,
  installOfficialTemplate,
  loadUserTemplates,
  type OfficialTemplate,
  type TemplateCategory,
} from '@/data/templates';

type SortBy = 'newest' | 'popular' | 'rating';

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return <Icons.AppstoreOutlined />;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : <Icons.AppstoreOutlined />;
}

export default function MarketPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<TemplateCategory | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [installedIds, setInstalledIds] = useState<Set<string>>(
    () => new Set(loadUserTemplates().map((t) => t.templateId)),
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = OFFICIAL_TEMPLATES.filter((t) => {
      if (category && t.category !== category) return false;
      if (!kw) return true;
      const haystack = [t.name, t.description, t.author, ...t.tags].join(' ').toLowerCase();
      return haystack.includes(kw);
    });

    list = [...list];
    if (sortBy === 'popular') list.sort((a, b) => b.usageCount - a.usageCount);
    else if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
  }, [keyword, category, sortBy]);

  const handleInstall = (t: OfficialTemplate) => {
    const result = installOfficialTemplate(t.templateId);
    if (result) {
      message.success(`已安装模板：${t.name}`);
      setInstalledIds((prev) => new Set([...prev, t.templateId]));
    } else {
      message.info('该模板已安装，可在"我的模板"中查看');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <Icons.AppstoreOutlined /> 应用市场
        </Typography.Title>
        <Button type="primary" icon={<Icons.PlusOutlined />} onClick={() => navigate('/my-templates/submit')}>
          投稿模板
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }} size="small">
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Input
              prefix={<Icons.SearchOutlined />}
              placeholder="按名称、描述、标签、作者搜索模板"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 140 }}
              options={[
                { label: '最新', value: 'newest' },
                { label: '最热', value: 'popular' },
                { label: '评分最高', value: 'rating' },
              ]}
            />
          </Col>
        </Row>
        <Row style={{ marginTop: 12 }}>
          <Space wrap>
            <Tag.CheckableTag
              checked={!category}
              onChange={() => setCategory(undefined)}
              style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}
            >
              全部
            </Tag.CheckableTag>
            {TEMPLATE_CATEGORIES.map((c) => (
              <Tag.CheckableTag
                key={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}
              >
                {c.label}
              </Tag.CheckableTag>
            ))}
          </Space>
        </Row>
      </Card>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        共 {filtered.length} 个模板
      </Typography.Text>

      {filtered.length === 0 ? (
        <Empty description="没有匹配的模板" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((t) => {
            const installed = installedIds.has(t.templateId);
            const ratingInfo = computeTemplateRating(t.templateId, {
              rating: t.rating,
              ratingCount: t.ratingCount,
            });
            return (
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
                        background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
                        color: '#fff',
                        fontSize: 48,
                      }}
                      onClick={() => navigate(`/market/${t.templateId}`)}
                    >
                      {renderIcon(t.icon)}
                    </div>
                  }
                  actions={[
                    <Tooltip title={installed ? '已安装，查看详情' : '查看详情'} key="detail">
                      <Button
                        type="link"
                        icon={<Icons.EyeOutlined />}
                        onClick={() => navigate(`/market/${t.templateId}`)}
                      >
                        详情
                      </Button>
                    </Tooltip>,
                    <Tooltip title={installed ? '已安装' : '一键安装到我的模板'} key="install">
                      <Button
                        type="link"
                        icon={<Icons.DownloadOutlined />}
                        disabled={installed}
                        onClick={() => handleInstall(t)}
                      >
                        {installed ? '已安装' : '安装'}
                      </Button>
                    </Tooltip>,
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
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ minHeight: 44, marginBottom: 8 }}
                        >
                          {t.description}
                        </Typography.Paragraph>
                        <Space size={4} wrap style={{ marginBottom: 4 }}>
                          {t.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Rate disabled value={ratingInfo.rating} allowHalf style={{ fontSize: 12 }} />
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {t.usageCount} 次使用
                          </Typography.Text>
                        </div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          作者：{t.author}
                        </Typography.Text>
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
