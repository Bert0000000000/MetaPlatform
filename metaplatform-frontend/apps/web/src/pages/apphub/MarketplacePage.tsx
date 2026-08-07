import { useEffect, useState } from 'react';
import { Card, Empty, Modal, Space, Tag, Typography, message, Spin, Result, Button, Table, Badge } from 'antd';
import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  listTemplates,
  installTemplate,
  listInstalled,
} from '@/api/apphub/marketplace';
import TemplateCard from './components/TemplateCard';
import CategoryFilter from './components/CategoryFilter';
import SearchBar from './components/SearchBar';
import type { TemplateItem, InstallResult, InstalledItem } from '@/api/apphub/marketplace';

const INSTALL_STATE_MAP: Record<string, { label: string; badge: 'success' | 'processing' | 'warning' | 'error' | 'default' }> = {
  installed: { label: '已安装', badge: 'success' },
  downloading: { label: '下载中', badge: 'processing' },
  verifying: { label: '校验中', badge: 'processing' },
  failed: { label: '失败', badge: 'error' },
  uninstalled: { label: '已卸载', badge: 'default' },
};

export default function MarketplacePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<TemplateItem['category']>();
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'rating'>('newest');
  const [previewing, setPreviewing] = useState<TemplateItem | null>(null);
  const [installed, setInstalled] = useState<InstalledItem[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

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

  const loadInstalled = async () => {
    setInstalledLoading(true);
    try {
      const items = await listInstalled();
      setInstalled(items);
    } catch {
      setInstalled([]);
    } finally {
      setInstalledLoading(false);
    }
  };

  useEffect(() => {
    loadInstalled();
  }, []);

  const handleInstall = async (t: TemplateItem) => {
    const res: InstallResult = await installTemplate(t.templateId);
    if (res.success) {
      if (res.alreadyInstalled) {
        message.info(`「${t.name}」已安装`);
      } else {
        message.success(`已安装「${t.name}」（Install ID: ${res.installId}）`);
      }
      loadInstalled();
    } else {
      message.error(res.error || '安装失败');
    }
  };

  return (
    <div>
      <div className="mcphub-page-header" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <AppstoreOutlined /> 应用市场
        </Typography.Title>
      </div>

      <Space style={{ marginBottom: 16 }} orientation="vertical">
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

      {/* 我的安装 */}
      <Card size="small" title={`我的安装 (${installed.length})`} style={{ marginTop: 24 }}>
        <Spin spinning={installedLoading}>
          {installed.length === 0 ? (
            <Empty description="还没有安装记录，安装后的本体/Agent/MCP 会显示在这里" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              size="small"
              dataSource={installed}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '类型', dataIndex: 'kind', key: 'kind', render: (k: string) => <Tag color="blue">{k}</Tag> },
                { title: 'Artifact ID', dataIndex: 'artifactId', key: 'artifactId', ellipsis: true },
                { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
                {
                  title: '状态',
                  dataIndex: 'state',
                  key: 'state',
                  width: 110,
                  render: (s: string) => {
                    const m = INSTALL_STATE_MAP[s] ?? { label: s, badge: 'default' as const };
                    return <Badge status={m.badge} text={m.label} />;
                  },
                },
                {
                  title: '安装时间',
                  dataIndex: 'installedAt',
                  key: 'installedAt',
                  width: 170,
                  render: (v?: string) => (v ? new Date(v).toLocaleString() : '-'),
                },
              ]}
            />
          )}
        </Spin>
      </Card>

      <Modal
        title={previewing?.name}
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={null}
        width={680}
      >
        {previewing && (
          <Space orientation="vertical" style={{ width: '100%' }}>
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
