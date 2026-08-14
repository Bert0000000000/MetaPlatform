/**
 * KnowledgeTestPage - 检索测试
 * --------------------------------------------------
 * 路由: /knowledge/test
 * Phase 1: 從 apps/kb 的 SearchTestPage 迁入,真实走 /api/v1/rag/search。
 *          保留 4-tab 导航壳。
 *
 * v3.0 接 P0.3: 顶部 KB 选择会作为 `kb_id` 传给 /api/v1/rag/search,
 *              后端 mate-tech-rag 据此走 retrieve 路径做 KB 限定过滤。
 * v3.0 接 P2.9: Reranker 选项加上 heuristic_cross(中文友好、零外部依赖)。
 */
import { useState, useEffect } from 'react';
import { Card, Input, Button, Select, Space, Empty, Tag, Typography, Toast, InputNumber } from '@douyinfe/semi-ui';
import { Search, FileText, Zap, Filter } from 'lucide-react';
import { useAsync, useLoadingState, useApiErrorBoundary } from '@mate/shared';
import { listKb, search, getRetrievalConfig, type KbEntity, type Evidence, type RerankStrategy } from '@/api/kb';


const DEFAULT_TENANT = 'tenant-default';

const MODE_OPTIONS = [
  { value: 'AUTO', label: 'AUTO · 自动路由' },
  { value: 'FACTUAL', label: 'FACTUAL · 向量+关键词' },
  { value: 'ENTITY', label: 'ENTITY · 实体图谱' },
  { value: 'THEMATIC', label: 'THEMATIC · 主题图谱' },
];

const RERANK_OPTIONS: Array<{ value: RerankStrategy; label: string }> = [
  { value: 'heuristic_cross', label: 'heuristic_cross · 启发式(中文友好,推荐)' },
  { value: 'identity', label: 'identity · 不重排' },
  { value: 'keyword', label: 'keyword · 关键词精排' },
  { value: 'length', label: 'length · 长度归一' },
];

export default function KnowledgeTestPage() {
  const { report } = useApiErrorBoundary();
  const [query, setQuery] = useState('');
  const [kbId, setKbId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<string>('AUTO');
  const [rerankStrategy, setRerankStrategy] = useState<string>('identity');
  const [topK, setTopK] = useState<number>(10);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const run = useLoadingState();

  // KB 列表:走 useAsync,首次加载后缓存
  const { data: kbs } = useAsync<KbEntity[]>(
    () => listKb().catch((error) => { console.warn('[KnowledgeTest] kb list failed', error); Toast.warning('知识库列表加载失败，请检查后端服务状态'); return [] as KbEntity[]; }),
    [],
    { initialData: [] },
  );

  // Load the tenant's saved retrieval config as the default controls so the
  // config page and the test page stay in sync.
  useEffect(() => {
    getRetrievalConfig()
      .then((cfg) => { setMode(cfg.mode); setRerankStrategy(cfg.rerankStrategy); setTopK(cfg.topK); })
      .catch(() => { /* keep defaults if config endpoint unavailable */ });
  }, []);

  const onSearch = async () => {
    const q = query.trim();
    if (!q) {
      Toast.warning('请输入检索内容');
      return;
    }
    try {
      const resp = await run.wrap(
        search({
          tenantId: DEFAULT_TENANT,
          kbId,
          query: q,
          mode: mode as 'AUTO' | 'FACTUAL' | 'ENTITY' | 'THEMATIC',
          rerankStrategy: rerankStrategy as RerankStrategy,
          topK,
        }),
      );
      setEvidences(resp);
      Toast.success(`命中 ${resp.length} 条`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      report(err);
    }
  };

  // KB 过滤提示:让用户能直观看到「这次检索到底有没有限定 KB」。
  const selectedKb = (kbs ?? []).find((kb) => kb.id === kbId);
  const filterHint = kbId && selectedKb
    ? `当前查询限定 KB: ${selectedKb.displayName} · kb_id=${kbId}`
    : '全量搜索（不限定 KB，将跨所有可见知识库检索）';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <Zap size={16} />
              检索测试
            </Space>
          }
          headerExtraContent={<Tag color="blue">Hybrid: BM25 + 向量</Tag>}
        >
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <Select
              placeholder="选择 KB"
              style={{ width: 240 }}
              value={kbId}
              onChange={(value) => setKbId(value as string | undefined)}
              showClear
              optionList={(kbs ?? []).map((kb) => ({ value: kb.id, label: kb.displayName }))}
            />
            <Input
              placeholder="输入检索内容"
              value={query}
              onChange={(value: string) => setQuery(value)}
              onEnterPress={onSearch}
              style={{ width: 'calc(100% - 240px - 96px - 8px)' }}
              prefix={<Search size={14} />}
            />
            <Button theme="solid" type="primary" onClick={onSearch} loading={run.loading}>
              检索
            </Button>
          </div>

          {/* v3.0 P0.3: KB 过滤提示。用户能直接看到「这次检索走的是 KB 限定还是全量」,
              且会把实际发给后端的 kb_id（如果有）也打出来。 */}
          <div
            data-testid="kb-filter-hint"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 10, fontSize: 12, color: 'var(--muted-foreground)',
            }}
          >
            <Filter size={12} />
            <span style={{ fontFamily: 'var(--semi-font-mono, monospace)' }}>{filterHint}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>检索模式</span>
              <Select
                style={{ width: 200 }}
                value={mode}
                onChange={(value) => setMode(value as string)}
                optionList={MODE_OPTIONS}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Reranker</span>
              <Select
                style={{ width: 180 }}
                value={rerankStrategy}
                onChange={(value) => setRerankStrategy(value as string)}
                optionList={RERANK_OPTIONS}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Top-K</span>
              <InputNumber
                min={1}
                max={100}
                value={topK}
                onChange={(v) => setTopK(typeof v === 'number' ? v : 10)}
                style={{ width: 90 }}
              />
            </div>
          </div>
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
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <FileText size={24} color="var(--semi-color-primary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div>
                        <Typography.Text strong>{ev.title ?? ev.documentId}</Typography.Text>
                      </div>
                      <div style={{ color: 'var(--muted-foreground)', fontSize: 12, marginTop: 4 }}>
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
