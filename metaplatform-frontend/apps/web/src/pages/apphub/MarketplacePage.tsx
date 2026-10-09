import { useEffect, useState } from 'react';
import { Card, Empty, Modal, Space, Tag, Typography, Toast, Spin, Button, Table, Badge } from '@douyinfe/semi-ui';
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
import { EmptyState, PageHeader } from '@/components/skeleton';
import './apps.css';

// Semi Badge type 仅支持 primary/secondary/tertiary/danger/warning/success
const INSTALL_STATE_MAP: Record<string, { label: string; badge: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'warning' | 'success' }> = {
  installed: { label: '已安装', badge: 'success' },
  downloading: { label: '下载中', badge: 'primary' },
  verifying: { label: '校验中', badge: 'primary' },
  failed: { label: '失败', badge: 'danger' },
  uninstalled: { label: '已卸载', badge: 'tertiary' },
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
  const [installedError, setInstalledError] = useState<string | null>(null);

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
    setInstalledError(null);
    try {
      const items = await listInstalled();
      setInstalled(items);
    } catch (err) {
      setInstalledError(err instanceof Error ? err.message : '安装记录读取失败');
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
        Toast.info(`「${t.name}」已安装`);
      } else {
        Toast.success(`已安装「${t.name}」（Install ID: ${res.installId}）`);
      }
      loadInstalled();
    } else {
      Toast.error(res.error || '安装失败');
    }
  };

  let previewContent = previewing?.configSnapshot ?? previewing?.preview;
  if (previewContent) {
    try { previewContent = JSON.stringify(JSON.parse(previewContent), null, 2); }
    catch { /* 非 JSON 配置按已读原文展示。 */ }
  }

  return (
    <div>
      <PageHeader title="云市场" desc="浏览模板目录并查看市场制品的安装记录。" />
      <Space vertical className="mp-mb-4">
        <SearchBar
          keyword={keyword}
          onKeywordChange={setKeyword}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
        <CategoryFilter value={category} onChange={setCategory} />
      </Space>

      {loading ? (
        <div className="mp-text-center mp-p-8">
          <Spin tip="加载中..." />
        </div>
      ) : error ? (
        <div className="mp-text-center mp-p-8">
          <div className="mp-fw-600 mp-mb-2 mp-text-xl mp-text-danger">
            加载失败
          </div>
          <div className="mp-mb-4 mp-text-2">{error.message}</div>
          <Button theme="solid" type="primary" icon={<ReloadOutlined />} onClick={load}>
            重试
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState illustration={keyword || category ? 'no-result' : 'no-content'} title={keyword || category ? '没有匹配的模板' : '暂无模板'} desc="当前目录没有符合条件的模板，可调整筛选后重试。" />
      ) : (
        <div
          className="mp-grid mp-gap-4 mp-app-grid-auto-280"
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
      <Card title={installedError || installedLoading ? '我的安装' : `我的安装 (${installed.length})`} className="mp-mt-6">
        <Spin spinning={installedLoading}>
          {installedError ? (
            <div role="alert"><EmptyState illustration="failure" title="安装历史暂不可用" desc={installedError} actions={<Button type="primary" onClick={loadInstalled}>重试安装记录</Button>} /></div>
          ) : installed.length === 0 ? (
            <EmptyState title="还没有安装记录" desc="安装后的本体、Agent 与 MCP 会显示在这里。" />
          ) : (
            <Table
              size="small"
              dataSource={installed}
              rowKey="id"
              pagination={false}
              columns={[
                { title: '类型', dataIndex: 'kind', key: 'kind', render: (k: string) => <Tag size="small" color="blue">{k}</Tag> },
                { title: 'Artifact ID', dataIndex: 'artifactId', key: 'artifactId', ellipsis: true },
                { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
                {
                  title: '状态',
                  dataIndex: 'state',
                  key: 'state',
                  width: 110,
                  render: (s: string) => {
                    const m = INSTALL_STATE_MAP[s] ?? { label: s, badge: 'tertiary' as const };
                    return (
                      <span className="mp-inline-flex mp-items-center mp-gap-1" >
                        <Badge type={m.badge} dot />
                        <span>{m.label}</span>
                      </span>
                    );
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
        visible={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={null}
        width={680}
      >
        {previewing && (
          <Space vertical className="mp-w-full">
            <Card>
              <Typography.Paragraph>{previewing.description}</Typography.Paragraph>
              <Space wrap>
                <Tag color="blue">{previewing.category}</Tag>
                {previewing.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </Space>
            </Card>
            <Card title="功能预览">
              <Typography.Paragraph type="tertiary">
                模块清单未提供
              </Typography.Paragraph>
              {previewContent ? <pre className="mp-app-template-content">{previewContent}</pre> : <Typography.Text type="tertiary">配置内容未提供</Typography.Text>}
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
}
