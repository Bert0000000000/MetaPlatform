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
        Toast.info(`「${t.name}」已安装`);
      } else {
        Toast.success(`已安装「${t.name}」（Install ID: ${res.installId}）`);
      }
      loadInstalled();
    } else {
      Toast.error(res.error || '安装失败');
    }
  };

  return (
    <div>
      <div className="v-page-header" style={{ marginBottom: 16 }}>
      </div>

      <Space vertical style={{ marginBottom: 16 }}>
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
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--destructive)', marginBottom: 8 }}>
            加载失败
          </div>
          <div style={{ color: 'var(--muted-foreground)', marginBottom: 16 }}>{error.message}</div>
          <Button theme="solid" type="primary" icon={<ReloadOutlined />} onClick={load}>
            重试
          </Button>
        </div>
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
      <Card title={`我的安装 (${installed.length})`} style={{ marginTop: 24 }}>
        <Spin spinning={installedLoading}>
          {installed.length === 0 ? (
            <Empty description="还没有安装记录，安装后的本体/Agent/MCP 会显示在这里" />
          ) : (
            <Table
              size="small"
              dataSource={installed}
              rowKey="id"
              pagination={false}
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
                    const m = INSTALL_STATE_MAP[s] ?? { label: s, badge: 'tertiary' as const };
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
          <Space vertical style={{ width: '100%' }}>
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
            <Card title="功能预览">
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
