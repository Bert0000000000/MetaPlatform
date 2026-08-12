import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Typography, Button, Space, Rating, Input, Select, Empty, Tooltip, Spin, Toast } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import * as Icons from '@ant-design/icons';
import {
  TEMPLATE_CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type TemplateCategory,
} from './data/templates';
import { listTemplates, installTemplate, type TemplateItem } from '@/api/apphub/marketplace';

type SortBy = 'newest' | 'popular' | 'rating';

// Semi Tag 颜色名与 antd 色名差异修正（gold → yellow）
const SEMI_TAG_COLOR: Record<string, string> = { gold: 'yellow', default: 'grey' };

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return <Icons.AppstoreOutlined />;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : <Icons.AppstoreOutlined />;
}

function CheckableTag({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <span
      onClick={onChange}
      style={{
        padding: '4px 12px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 13,
        color: checked ? 'var(--primary)' : 'var(--muted-foreground)',
        background: checked ? 'var(--semi-color-primary-light-default)' : 'transparent',
        userSelect: 'none',
      }}
    >
      {children}
    </span>
  );
}

export default function MarketPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<TemplateCategory | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const data = await listTemplates({
          keyword: keyword.trim() || undefined,
          category,
        });
        setTemplates(data);
      } catch {
        setTemplates([]);
        Toast.error('加载模板列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [keyword, category]);

  const filtered = useMemo(() => {
    let list = [...templates];
    if (sortBy === 'popular') list.sort((a, b) => (b.usageCount ?? b.downloadCount) - (a.usageCount ?? a.downloadCount));
    else if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [templates, sortBy]);

  const handleInstall = async (t: TemplateItem) => {
    try {
      const result = await installTemplate(t.templateId);
      if (result.success) {
        Toast.success(`已安装模板：${t.name}`);
        setInstalledIds((prev) => new Set([...prev, t.templateId]));
      } else {
        Toast.info('该模板已安装，可在"我的模板"中查看');
      }
    } catch {
      Toast.error('安装失败，请稍后重试');
    }
  };

  const tagColor = (c: string | undefined) => SEMI_TAG_COLOR[c ?? ''] ?? c ?? 'grey';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          <Icons.AppstoreOutlined /> 应用市场
        </Typography.Title>
        <Button theme="solid" type="primary" icon={<Icons.PlusOutlined />} onClick={() => navigate('/my-templates/submit')}>
          投稿模板
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input
              prefix={<Icons.SearchOutlined />}
              placeholder="按名称、描述、标签搜索模板"
              value={keyword}
              onChange={(v) => setKeyword(v)}
              showClear
            />
          </div>
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as SortBy)}
            style={{ width: 140 }}
            optionList={[
              { label: '最新', value: 'newest' },
              { label: '最热', value: 'popular' },
              { label: '评分最高', value: 'rating' },
            ]}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Space wrap>
            <CheckableTag checked={!category} onChange={() => setCategory(undefined)}>
              全部
            </CheckableTag>
            {TEMPLATE_CATEGORIES.map((c) => (
              <CheckableTag
                key={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
              >
                {c.label}
              </CheckableTag>
            ))}
          </Space>
        </div>
      </Card>

      <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 12 }}>
        共 {filtered.length} 个模板
      </Typography.Text>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <Empty description="没有匹配的模板" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((t) => {
            const installed = installedIds.has(t.templateId);
            return (
              <Col key={t.templateId} xs={24} sm={12} md={8} lg={6}>
                <Card
                  shadows="hover"
                  cover={
                    <div
                      style={{
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--semi-color-primary-hover) 100%)',
                        color: 'var(--semi-color-white)',
                        fontSize: 48,
                      }}
                      onClick={() => navigate(`/market/${t.templateId}`)}
                    >
                      {renderIcon(t.icon)}
                    </div>
                  }
                  actions={[
                    <Tooltip content={installed ? '已安装，查看详情' : '查看详情'} key="detail">
                      <Button
                        theme="borderless"
                        type="primary"
                        icon={<Icons.EyeOutlined />}
                        onClick={() => navigate(`/market/${t.templateId}`)}
                      >
                        详情
                      </Button>
                    </Tooltip>,
                    <Tooltip content={installed ? '已安装' : '一键安装到我的模板'} key="install">
                      <Button
                        theme="borderless"
                        type="primary"
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
                        <Tag color={tagColor(CATEGORY_COLOR[t.category as TemplateCategory])}>
                          {CATEGORY_LABEL[t.category as TemplateCategory] ?? t.category}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Typography.Paragraph
                          type="tertiary"
                          ellipsis={{ rows: 2 }}
                          style={{ minHeight: 44, marginBottom: 8 }}
                        >
                          {t.description}
                        </Typography.Paragraph>
                        <Space spacing={4} wrap style={{ marginBottom: 4 }}>
                          {t.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Rating disabled value={t.rating} allowHalf style={{ fontSize: 12 }} />
                          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                            {t.usageCount ?? t.downloadCount} 次使用
                          </Typography.Text>
                        </div>
                        {t.author && (
                          <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                            作者：{t.author}
                          </Typography.Text>
                        )}
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
