/**
 * KnowledgeTestPage - 检索测试
 * --------------------------------------------------
 * 路由: /knowledge/test
 * Phase 1: 從 apps/kb 的 SearchTestPage 迁入,真实走 /api/v1/rag/search。
 *          保留 4-tab 导航壳。
 */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Input, Button, Select, Space, Empty, Tag, Typography, message } from 'antd';
import { Search, FileText, Zap } from 'lucide-react';
import { SubTabs, type SubTabItem, useAsync, useLoadingState, useApiErrorBoundary } from '@mate/shared';
import { listKb, search, type KbEntity, type Evidence } from '@/api/kb';

const KB_TABS: SubTabItem[] = [
  { label: '知识库列表', path: '/knowledge' },
  { label: '文档管理', path: '/knowledge/docs' },
  { label: '检索测试', path: '/knowledge/test' },
  { label: '检索配置', path: '/knowledge/config' },
];

const DEFAULT_TENANT = 'tenant-default';

export default function KnowledgeTestPage() {
  const { report } = useApiErrorBoundary();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [kbId, setKbId] = useState<string | undefined>(undefined);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const run = useLoadingState();

  // KB 列表:走 useAsync,首次加载后缓存
  const { data: kbs } = useAsync<KbEntity[]>(
    () => listKb().catch((error) => { console.warn('[KnowledgeTest] kb list failed', error); message.warning('知识库列表加载失败，请检查后端服务状态'); return [] as KbEntity[]; }),
    [],
    { initialData: [] },
  );

  const onSearch = async () => {
    const q = query.trim();
    if (!q) {
      message.warning('请输入检索内容');
      return;
    }
    try {
      const resp = await run.wrap(
        search({ tenantId: DEFAULT_TENANT, kbId, query: q }),
      );
      setEvidences(resp);
      message.success(`命中 ${resp.length} 条`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      report(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={KB_TABS} activePath={location.pathname} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <Zap size={16} />
              检索测试
            </Space>
          }
          extra={<Tag color="blue">Hybrid: BM25 + 向量</Tag>}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Select
              placeholder="选择 KB"
              style={{ width: 240 }}
              value={kbId}
              onChange={setKbId}
              allowClear
              options={(kbs ?? []).map((kb) => ({ value: kb.id, label: kb.displayName }))}
            />
            <Input
              placeholder="输入检索内容"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={onSearch}
              style={{ width: 'calc(100% - 240px - 96px - 8px)' }}
              prefix={<Search size={14} />}
            />
            <Button type="primary" onClick={onSearch} loading={run.loading}>
              检索
            </Button>
          </Space.Compact>
        </Card>

        <Card title={`命中 ${evidences.length} 条`} style={{ marginTop: 16 }}>
          {evidences.length === 0 ? (
            <Empty description="暂无命中，输入 query 开始检索" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evidences.map((ev) => (
                <div
                  key={ev.evidenceId}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <FileText size={24} color="#1677ff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div>
                        <Typography.Text strong>{ev.title ?? ev.documentId}</Typography.Text>
                      </div>
                      <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                        <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
                          {ev.fragment}
                        </Typography.Paragraph>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Tag color="green">score {ev.score.toFixed(3)}</Tag>
                    <Tag>{ev.type}</Tag>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
