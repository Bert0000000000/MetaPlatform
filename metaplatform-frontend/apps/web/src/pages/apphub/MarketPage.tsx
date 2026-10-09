import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Typography, Button, Space, Input, Select, Tooltip, Spin, Toast } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import * as Icons from '@ant-design/icons';
import { EmptyState, PageHeader } from '@/components/skeleton';
import { canInstallTemplate, listTemplates, installTemplate, type TemplateItem } from '@/api/apphub/marketplace';
import './apps.css';

type SortBy = 'newest' | 'popular' | 'rating';
const TEMPLATE_TYPES = [
  { value: 'workflow', label: '工作流' },
  { value: 'form', label: '表单' },
  { value: 'approval', label: '审批' },
];
const TYPE_COLORS: Record<string, TagColor> = { workflow: 'purple', form: 'blue', approval: 'orange' };

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
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={`mp-clickable mp-border mp-text-body mp-py-1 mp-px-3 mp-rounded-sm mp-app-chip${checked ? ' mp-app-chip-on' : ''}`}
    >
      {children}
    </button>
  );
}

export default function MarketPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listTemplates({
          keyword: keyword.trim() || undefined,
          category,
        });
        if (!cancelled) setTemplates(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载模板列表失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTemplates();
    return () => { cancelled = true; };
  }, [keyword, category, refreshKey]);

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
        if (result.alreadyInstalled) Toast.info(`该模板已安装：${t.name}`);
        else Toast.success(`已安装模板：${t.name}`);
        setInstalledIds((prev) => new Set([...prev, t.templateId]));
      } else {
        Toast.error(result.error || '安装失败，请稍后重试');
      }
    } catch {
      Toast.error('安装失败，请稍后重试');
    }
  };

  const tagColor = (c: string | undefined): TagColor => (SEMI_TAG_COLOR[c ?? ''] ?? c ?? 'grey') as TagColor;

  return (
    <div className="mp-apps-page">
      <PageHeader title="应用市场" desc="浏览当前可用的工作流、表单与审批模板。" />
      <Card className="mp-mb-4">
        <div className="mp-app-market-filter">
          <div className="mp-app-market-search">
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
              { label: '目录顺序', value: 'newest' },
            ]}
          />
        </div>
        <div className="mp-mt-3">
          <Space wrap>
            <CheckableTag checked={!category} onChange={() => setCategory(undefined)}>
              全部
            </CheckableTag>
            {TEMPLATE_TYPES.map((c) => (
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

      {!loading && !error && <Typography.Text type="tertiary" className="mp-mb-3 mp-block" >
        共 {filtered.length} 个模板
      </Typography.Text>}

      {loading ? (
        <div className="mp-text-center mp-p-9">
          <Spin tip="正在读取模板…" />
        </div>
      ) : error ? (
        <div role="alert">
          <EmptyState illustration="failure" title="模板列表读取失败" desc={error} actions={<Button type="primary" onClick={() => setRefreshKey((key) => key + 1)}>重试</Button>} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={keyword.trim() || category ? 'no-result' : 'no-content'}
          title={keyword.trim() || category ? '没有匹配的模板' : '暂无模板'}
          desc={keyword.trim() || category ? '尝试其他关键词或清除筛选条件。' : '当前模板目录为空，可以稍后刷新。'}
          actions={<Button onClick={() => { setKeyword(''); setCategory(undefined); setRefreshKey((key) => key + 1); }}>{keyword.trim() || category ? '清除筛选' : '刷新模板'}</Button>}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((t) => {
            const installed = installedIds.has(t.templateId);
            const installable = canInstallTemplate(t.templateId);
            return (
              <Col key={t.templateId} xs={24} sm={12} md={8} lg={6}>
                <Card
                  shadows="hover"
                  cover={
                    <div
                      className="mp-justify-center mp-text-xl mp-flex-center mp-app-cover mp-app-cover-hover"
                      onClick={() => navigate(`/apps/market?tid=${encodeURIComponent(t.templateId)}`)}
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
                        onClick={() => navigate(`/apps/market?tid=${encodeURIComponent(t.templateId)}`)}
                      >
                        详情
                      </Button>
                    </Tooltip>,
                    <Tooltip content={!installable ? '该模板尚未关联可安装的市场制品' : installed ? '已安装' : '安装市场制品'} key="install">
                      <Button
                        theme="borderless"
                        type="primary"
                        icon={<Icons.DownloadOutlined />}
                        disabled={installed || !installable}
                        onClick={() => handleInstall(t)}
                      >
                        {installed ? '已安装' : installable ? '安装' : '安装暂不可用'}
                      </Button>
                    </Tooltip>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <Typography.Text strong>{t.name}</Typography.Text>
                        <Tag color={tagColor(TYPE_COLORS[t.category])}>
                          {TEMPLATE_TYPES.find((type) => type.value === t.category)?.label ?? t.category}
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
