/**
 * KnowledgeTestPage - 检索测试
 * --------------------------------------------------
 * 路由: /ki/test（历史别名 /ki/kb/test 仍保留，见 routes/ki.tsx）
 * Phase 1: 從 apps/kb 的 SearchTestPage 迁入,真实走 /api/v1/rag/search。
 *          保留 4-tab 导航壳。
 *
 * v3.0 接 P0.3: 顶部 KB 选择会作为 `kb_id` 传给 /api/v1/rag/search,
 *              后端 mate-tech-rag 据此走 retrieve 路径做 KB 限定过滤。
 * v3.0 接 P2.9: Reranker 选项加上 heuristic_cross(中文友好、零外部依赖)。
 */
import { useState, useEffect } from 'react';
import { Card, Input, Button, Select, Tag, Typography, Toast, InputNumber } from '@douyinfe/semi-ui';
import { Search, FileText, Filter } from 'lucide-react';
import { useAsync, useLoadingState, useApiErrorBoundary, getTenantId } from '@mate/shared';
import { EmptyState, PageHeader } from '@/components/skeleton';
import './kb.css';
import { listKb, search, getRetrievalConfig, type KbEntity, type Evidence, type RerankStrategy } from '@/api/kb';


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
          // 取会话租户，不再写死；后端仍以 JWT 的 tenant 为准
          tenantId: getTenantId() ?? 'tenant-default',
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
    <>
      <PageHeader
        title="检索测试"
        desc={filterHint}
        actions={<Tag color="blue" shape="circle">Hybrid: BM25 + 向量</Tag>}
      />

      <Card>
        <div className="mp-w-full mp-flex mp-gap-2">
          <Select
            placeholder="选择 KB"
            className="mp-w-240"
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
            className="mp-kb-search-w"
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
          className="mp-mt-2 mp-gap-1 mp-text-sm mp-text-2 mp-flex-center"
        >
          <Filter size={12} />
          <span className="mp-mono">{filterHint}</span>
        </div>

        <div className="mp-mt-4 mp-gap-6 mp-flex-center mp-wrap">
          <div className="mp-gap-2 mp-flex-center">
            <span className="mp-text-sm mp-text-2 mp-nowrap">检索模式</span>
            <Select
              className="mp-w-200"
              value={mode}
              onChange={(value) => setMode(value as string)}
              optionList={MODE_OPTIONS}
            />
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <span className="mp-text-sm mp-text-2 mp-nowrap">Reranker</span>
            <Select
              className="mp-w-180"
              value={rerankStrategy}
              onChange={(value) => setRerankStrategy(value as string)}
              optionList={RERANK_OPTIONS}
            />
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <span className="mp-text-sm mp-text-2 mp-nowrap">Top-K</span>
            <InputNumber
              min={1}
              max={100}
              value={topK}
              onChange={(v) => setTopK(typeof v === 'number' ? v : 10)}
              className="mp-kb-w-90"
            />
          </div>
        </div>
      </Card>

      <Card title={`命中 ${evidences.length} 条`} className="mp-mt-4">
        {evidences.length === 0 ? (
          <EmptyState
            illustration="no-content"
            title="暂无命中"
            desc="输入检索内容后点击「检索」，命中的片段会显示在这里。"
          />
        ) : (
          <div className="mp-flex mp-gap-2 mp-flex-col">
            {evidences.map((ev) => (
              <div
                key={ev.evidenceId}
                className="mp-flex mp-justify-between mp-border mp-gap-3 mp-items-start mp-py-3"
              >
                <div className="mp-flex mp-flex-1 mp-gap-3 mp-items-start">
                  <div className="mp-shrink-0">
                    <FileText size={24} color="var(--semi-color-primary)" />
                  </div>
                  <div className="mp-flex-1">
                    <div>
                      <Typography.Text strong>{ev.title ?? ev.documentId}</Typography.Text>
                    </div>
                    <div className="mp-mt-1 mp-text-sm mp-text-2">
                      <Typography.Paragraph ellipsis={{ rows: 3 }} className="mp-mb-1">
                        {ev.fragment}
                      </Typography.Paragraph>
                    </div>
                  </div>
                </div>
                <div className="mp-flex mp-gap-2 mp-shrink-0">
                  <Tag color="green">score {ev.score.toFixed(3)}</Tag>
                  <Tag>{ev.type}</Tag>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
