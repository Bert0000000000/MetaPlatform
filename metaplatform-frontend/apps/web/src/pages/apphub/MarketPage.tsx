import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Typography, Button, Space, Rating, Input, Select, Empty, Tooltip, Spin, Toast } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import * as Icons from '@ant-design/icons';
import {
  TEMPLATE_CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type TemplateCategory,
} from './data/templates';
import { listTemplates, installTemplate, type TemplateItem } from '@/api/apphub/marketplace';
import './apps.css';

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
      className={`mp-clickable mp-border mp-text-body mp-py-1 mp-px-3 mp-rounded-sm mp-app-chip${checked ? ' mp-app-chip-on' : ''}`}
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

  const tagColor = (c: string | undefined): TagColor => (SEMI_TAG_COLOR[c ?? ''] ?? c ?? 'grey') as TagColor;

  return (
    <div>
      <Card className="mp-mb-4">
        <div className="mp-gap-3 mp-flex-center">
          <div className="mp-flex-1">
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
            className="mp-w-140"
            optionList={[
              { label: '最新', value: 'newest' },
              { label: '最热', value: 'popular' },
              { label: '评分最高', value: 'rating' },
            ]}
          />
        </div>
        <div className="mp-mt-3">
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

      <Typography.Text type="tertiary" className="mp-mb-3 mp-block" >
        共 {filtered.length} 个模板
      </Typography.Text>

      {loading ? (
        <div className="mp-text-center mp-p-9">
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
                      className="mp-justify-center mp-text-xl mp-flex-center mp-app-cover mp-app-cover-hover"
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
                          className="mp-mb-2 mp-app-min-44"
                        >
                          {t.description}
                        </Typography.Paragraph>
                        <Space spacing={4} wrap className="mp-mb-1">
                          {t.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                        <div className="mp-justify-between mp-flex-center">
                          <Rating disabled value={t.rating} allowHalf className="mp-text-sm" />
                          <Typography.Text type="tertiary" className="mp-text-sm">
                            {t.usageCount ?? t.downloadCount} 次使用
                          </Typography.Text>
                        </div>
                        {t.author && (
                          <Typography.Text type="tertiary" className="mp-text-sm">
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
