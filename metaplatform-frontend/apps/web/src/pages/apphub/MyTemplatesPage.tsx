import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Space,
  Tag,
  Typography,
  Spin,
} from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import * as Icons from '@ant-design/icons';
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type TemplateCategory,
} from './data/templates';
import { listTemplates, type TemplateItem } from '@/api/apphub/marketplace';
import { getUser } from '@mate/shared';
import { EmptyState, PageHeader } from '@/components/skeleton';
import './apps.css';

// Semi Tag 颜色名与 antd 色名差异修正（gold → yellow）
const SEMI_TAG_COLOR: Record<string, string> = { gold: 'yellow', default: 'grey' };

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return <Icons.AppstoreOutlined />;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : <Icons.AppstoreOutlined />;
}

export default function MyTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownershipAvailable, setOwnershipAvailable] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = getUser();
      const all = await listTemplates();
      setOwnershipAvailable(Boolean(currentUser?.username) && all.length > 0 && all.every((item) => Boolean(item.author)));
      // listTemplates 不支持 createdBy 过滤，前端按 author 字段过滤当前用户的模板
      const mine = currentUser
        ? all.filter((t) => t.author === currentUser.username)
        : [];
      setTemplates(mine);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模板列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tagColor = (c: string | undefined): TagColor => (SEMI_TAG_COLOR[c ?? ''] ?? c ?? 'grey') as TagColor;

  return (
    <div className="mp-apps-page">
      <PageHeader title="我的模板" desc="查看个人模板与可用的模板配置入口。" actions={<Button icon={<Icons.PlusOutlined />} onClick={() => navigate('/apps/templates?submit=1')}>配置新模板</Button>} />
      <Card>
        {loading ? (
          <div className="mp-app-loading"><Spin tip="正在读取模板…" /></div>
        ) : error ? (
          <div role="alert"><EmptyState illustration="failure" title="模板列表读取失败" desc={error} actions={<Button type="primary" onClick={refresh}>重试</Button>} /></div>
        ) : !ownershipAvailable ? (
          <EmptyState illustration="idle" title="无法确认个人模板" desc="当前模板服务未提供作者信息，暂时无法区分个人模板。可先浏览共享模板目录。" actions={<Button onClick={() => navigate('/apps/market')}>查看模板目录</Button>} />
        ) : templates.length === 0 ? (
          <EmptyState title="暂无个人模板" desc="当前账户还没有可用的个人模板。" />
        ) : (
          <Row gutter={[16, 16]}>
            {templates.map((t) => (
              <Col key={t.templateId} xs={24} sm={12} md={8} lg={6}>
                <Card
                  shadows="hover"
                  cover={
                    <div
                      className="mp-justify-center mp-text-xl mp-flex-center mp-app-cover mp-app-cover-purple"
                    >
                      {renderIcon(t.icon)}
                    </div>
                  }
                  actions={[
                    <Button key="delete" theme="borderless" type="danger" icon={<Icons.DeleteOutlined />} disabled title="当前服务尚未开放模板删除">
                      删除暂不可用
                    </Button>,
                    <Button
                      key="publish"
                      theme="borderless"
                      type="primary"
                      icon={<Icons.CloudUploadOutlined />}
                      disabled
                      title="当前服务尚未开放模板市场投稿"
                    >
                      投稿暂不可用
                    </Button>,
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
                          className="mp-mt-2 mp-mb-2 mp-app-min-44"
                        >
                          {t.description}
                        </Typography.Paragraph>
                        <Space spacing={4} wrap className="mp-mb-1">
                          {t.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                        <Typography.Text type="tertiary" className="mp-text-sm">
                          {t.createdAt ? `创建于：${new Date(t.createdAt).toLocaleDateString()}` : '创建时间未提供'}
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
