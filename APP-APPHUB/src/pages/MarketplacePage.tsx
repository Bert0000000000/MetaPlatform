import { useEffect, useState } from 'react';
import { Card, Empty, Modal, Space, Tag, Typography, message, Spin, Result, Button } from 'antd';
import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  listTemplates,
  installTemplate,
} from '@/api/marketplace';
import TemplateCard from '@/components/TemplateCard';
import CategoryFilter from '@/components/CategoryFilter';
import SearchBar from '@/components/SearchBar';
import type { TemplateItem } from '@/api/marketplace';

export default function MarketplacePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<TemplateItem['category']>();
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'rating'>('newest');
  const [previewing, setPreviewing] = useState<TemplateItem | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listTemplates({ keyword, category });
      const sorted = [...items];
      if (sortBy === 'popular') sorted.sort((a, b) => b.downloadCount - a.downloadCount);
      else if (sortBy === 'rating') sorted.sort((a, b) => b.rating - a.rating);
      else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTemplates(sorted);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载模板列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, category, sortBy]);

  const handleInstall = async (t: TemplateItem) => {
    try {
      const res = await installTemplate(t.templateId);
      if (res.success) {
        message.success(`已安装模板：${t.name}（AppID: ${res.appId}）`);
      } else {
        message.error('安装失败');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '安装失败');
    }
  };

  return (
    <div>
      <div className="mcphub-page-header" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <AppstoreOutlined /> 应用市场
        </Typography.Title>
      </div>

      <Space style={{ marginBottom: 16 }} direction="vertical">
        <SearchBar
          keyword={keyword}
          onKeywordChange={setKeyword}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
        <CategoryFilter value={category} onChange={setCategory} />
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="加载中..." />
        </div>
      ) : error ? (
        <Result
          status="error"
          title="加载失败"
          subTitle={error.message}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={load}>
              重试
            </Button>
          }
        />
      ) : templates.length === 0 ? (
        <Empty description="没有匹配的模板" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {templates.map((t) => (
            <TemplateCard
              key={t.templateId}
              template={t}
              onPreview={(tpl) => setPreviewing(tpl)}
              onInstall={handleInstall}
            />
          ))}
        </div>
      )}

      <Modal
        title={previewing?.name}
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={null}
        width={680}
      >
        {previewing && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card>
              <Typography.Paragraph>{previewing.description}</Typography.Paragraph>
              <Space wrap>
                <Tag color="blue">{previewing.category}</Tag>
                {previewing.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </Space>
              <div style={{ marginTop: 12 }}>
                <Typography.Text>评分：</Typography.Text>
                {previewing.rating} / 5 · 安装 {previewing.downloadCount} 次
              </div>
            </Card>
            <Card title="功能预览" size="small">
              <Typography.Paragraph>
                包含：表单（4 个）、流程（2 个）、仪表盘（1 个）、
                仪表盘组件（5+）、权限规则（3 条）。
              </Typography.Paragraph>
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
}
