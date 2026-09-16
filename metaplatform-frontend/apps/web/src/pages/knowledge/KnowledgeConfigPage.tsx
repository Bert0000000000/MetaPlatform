/**
 * KnowledgeConfigPage
 * --------------------------------------------------
 * 知识库模块 → 检索配置 tab
 * 路由：/ki/kb/config
 *
 * 真实读写后端 GET/PUT /api/v1/kb/retrieval-config（租户级全局检索配置）。
 * 选项与后端 mate-app-kb RetrievalConfig 对齐：mode / rerank_strategy /
 * chunk_strategy 等均为后端真实支持的枚举值。
 * P1.8: 顶部 v{N} 版本徽章 + GET /retrieval-config/history 只读折叠面板。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Switch, InputNumber, Select, Slider, Toast, Spin, Button, Tag, Collapse } from '@douyinfe/semi-ui';
import { Settings, Save, RefreshCw, History } from 'lucide-react';
import { useApiErrorBoundary } from '@mate/shared';
import { EmptyState, PageHeader } from '@/components/skeleton';
import './kb.css';
import {
  getRetrievalConfig,
  getRetrievalConfigHistory,
  putRetrievalConfig,
  type RetrievalConfig,
  type RetrievalConfigSnapshot,
  type RetrievalConfigUpdate,
  type RetrievalMode,
  type RerankStrategy,
  type ChunkStrategy,
} from '@/api/kb';

const DEFAULT_CONFIG: RetrievalConfigUpdate = {
  mode: 'AUTO',
  rerankStrategy: 'identity',
  topK: 10,
  similarityThreshold: 0,
  chunkStrategy: 'recursive',
  chunkSize: 512,
  chunkOverlap: 64,
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  rerankerEnabled: true,
  showCitations: true,
};

const MODE_OPTIONS: Array<{ value: RetrievalMode; label: string }> = [
  { value: 'AUTO', label: 'AUTO · 自动路由' },
  { value: 'FACTUAL', label: 'FACTUAL · 向量 + 关键词' },
  { value: 'ENTITY', label: 'ENTITY · 实体图谱' },
  { value: 'THEMATIC', label: 'THEMATIC · 主题图谱' },
];
const RERANK_OPTIONS: Array<{ value: RerankStrategy; label: string }> = [
  // heuristic_cross — 启发式重排(关键词重叠 + 位置衰减 + 长度归一 + IDF),
  // 零外部依赖、中文友好,作为中文场景的首选推荐置顶。
  { value: 'heuristic_cross', label: 'heuristic_cross · 启发式(中文友好,推荐)' },
  { value: 'identity', label: 'identity · 不重排' },
  { value: 'keyword', label: 'keyword · 关键词精排（中文可用）' },
  { value: 'length', label: 'length · 长度归一' },
];
const CHUNK_OPTIONS: Array<{ value: ChunkStrategy; label: string }> = [
  { value: 'recursive', label: 'recursive · 递归分隔符' },
  { value: 'markdown', label: 'markdown · 标题结构感知' },
  { value: 'semantic', label: 'semantic · 语句相似度' },
  { value: 'sliding', label: 'sliding · 滑动窗口' },
];

/** 分块重叠的安全上限比例：overlap 超过 chunkSize 的 80% 会产生大量重复片段 */
const OVERLAP_WARN_RATIO = 0.8;

/** 用于展示的权重格式化（避免 0.30000000000000004 这类浮点噪声） */
const fmtWeight = (n: number) => Number(n.toFixed(2));

export default function KnowledgeConfigPage() {
  const { report } = useApiErrorBoundary();
  const [config, setConfig] = useState<RetrievalConfigUpdate | null>(null);
  // 服务端基线快照：用于「待保存」脏检查。保存成功后同步为最新值。
  const [originalConfig, setOriginalConfig] = useState<RetrievalConfigUpdate | null>(null);
  // P1.8: 当前 version(后端单调递增) + 历史快照(只读,不能回滚)。
  // History 默认拿最近 5 条(后端 FIFO 上限 10)。
  const [version, setVersion] = useState<number>(1);
  const [history, setHistory] = useState<RetrievalConfigSnapshot[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  // 配置历史的开合改成受控：原先用 defaultActiveKey，它在首次挂载时求值，
  // 那一刻 history 还是空数组，面板永远不会自动展开。用户手动开合后不再被覆盖。
  const [historyActiveKey, setHistoryActiveKey] = useState<string[]>([]);
  const historyAutoOpened = useRef(false);

  useEffect(() => {
    let alive = true;
    getRetrievalConfig()
      .then((cfg: RetrievalConfig) => {
        if (!alive) return;
        const next = toUpdate(cfg);
        setConfig(next);
        setOriginalConfig(next);
        setVersion(cfg.version);
      })
      .catch((e: Error) => {
        report(e);
        if (!alive) return;
        setConfig(DEFAULT_CONFIG);
        setOriginalConfig(DEFAULT_CONFIG);
        setVersion(1);
      });

    // P1.8: history 拉取失败不阻塞主表单(空数组即可),但要提示。
    getRetrievalConfigHistory()
      .then((snaps) => { if (alive) { setHistory(snaps); setHistoryLoaded(true); } })
      .catch((e: Error) => {
        if (!alive) return;
        setHistory([]);
        setHistoryLoaded(true);
        console.warn('[KnowledgeConfig] history load failed', e);
      });

    return () => { alive = false; };
  }, [report]);

  // 首次拿到非空历史时自动展开一次；此后完全交给用户。
  useEffect(() => {
    if (!historyAutoOpened.current && historyLoaded && history.length > 0) {
      historyAutoOpened.current = true;
      setHistoryActiveKey(['history']);
    }
  }, [historyLoaded, history]);

  // 用 key 排序后的稳定序列化比较，避免不同来源对象（服务端 / DEFAULT_CONFIG）
  // 因字段顺序不同而被误判为 dirty。
  const dirty = useMemo(
    () => (config && originalConfig ? stableStringify(config) !== stableStringify(originalConfig) : false),
    [config, originalConfig],
  );

  const update = <K extends keyof RetrievalConfigUpdate>(key: K, value: RetrievalConfigUpdate[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const saved = await putRetrievalConfig(config);
      setOriginalConfig(config); // 保存成功 → 基线前移，「待保存」消失
      setVersion(saved.version); // P1.8: 同步最新 version,新版历史里的上一版就是这次保存前的版本
      // 保存后立刻拉一次历史:新快照是「前一个版本」,要在面板里立刻可见。
      getRetrievalConfigHistory()
        .then((snaps) => setHistory(snaps))
        .catch(() => { /* history 拉取失败不影响主流程 */ });
      Toast.success(`检索配置已保存(版本 v${saved.version})`);
    } catch (e) {
      report(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setConfig({ ...DEFAULT_CONFIG });
    Toast.info('已重置为前端内置默认值（非服务端初始值），需点击「保存配置」才会写回后端');
  };

  if (!config) {
    return <div className="mp-flex mp-justify-center mp-p-10" ><Spin /></div>;
  }

  return (
    <>
      <PageHeader
        title={
          <span className="mp-inline-flex mp-items-center mp-gap-2">
            检索配置
            {/* P1.8: 当前 config 的单调递增 version。配置从未保存过时为 v1,首次保存后变 v2。 */}
            <Tag color="blue" shape="circle" size="small">v{version}</Tag>
            {dirty && (
              <span className="mp-inline-flex mp-items-center mp-fw-500 mp-gap-1 mp-text-sm mp-text-danger">
                ● 待保存
              </span>
            )}
          </span>
        }
        desc="全局检索策略、Top-K、Reranker、分块策略的统一管理（租户级）"
        actions={
          <>
            <Button icon={<RefreshCw size={14} />} onClick={onReset} theme="light">恢复前端默认值</Button>
            <Button icon={<Save size={14} />} onClick={onSave} loading={saving} theme="solid" type="primary">保存配置</Button>
          </>
        }
      />

      {/* mp-max-w-720：设置项是「标签 + 控件」两列，满宽下拉/Slider 拉出 1200px+ 会看起来失焦 */}
      <div className="mp-flex mp-gap-4 mp-flex-col mp-max-w-720">
        {/* P1.8: 配置历史只读折叠面板 — 仅展示最近 5 条,不支持回滚(后端未实现)。 */}
        <Card className="mp-p-4">
          <Collapse
            keepDOM={false}
            activeKey={historyActiveKey}
            onChange={(keys) =>
              setHistoryActiveKey(Array.isArray(keys) ? keys : keys ? [keys] : [])
            }
          >
            <Collapse.Panel
              itemKey="history"
              header={
                <span className="mp-inline-flex mp-items-center mp-gap-2">
                  <History size={14} className="mp-icon-14 mp-text-2" />
                  <span className="mp-fw-600 mp-text-md">配置历史</span>
                  <span className="mp-text-sm mp-text-2">
                    最近 {Math.min(history.length, 5)} 条 · 只读 · 不支持回滚
                  </span>
                </span>
              }
            >
              {!historyLoaded ? (
                <div className="mp-flex mp-p-6 mp-justify-center" ><Spin /></div>
              ) : history.length === 0 ? (
                <EmptyState
                  title="尚无历史快照"
                  desc="每次点击「保存配置」时，保存前的旧版本会被记录下来。"
                  className="mp-py-3"
                />
              ) : (
                <HistoryList snapshots={history.slice(0, 5)} />
              )}
            </Collapse.Panel>
          </Collapse>
        </Card>

        {/* 检索策略 */}
        <Card className="mp-p-4">
          <GroupHeader title="检索策略" desc="召回模式与混合权重（权重在 RAG_MODE=hybrid/full 下生效）" />
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">检索模式</div>
            <Select className="mp-kb-w-260" value={config.mode} optionList={MODE_OPTIONS}
              onChange={(v) => update('mode', v as RetrievalMode)} /></div>
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">向量召回权重</div>
            <Slider value={config.vectorWeight} min={0} max={1} step={0.1} onChange={(v) => update('vectorWeight', typeof v === 'number' ? v : Number(v))} /></div>
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">关键词召回权重</div>
            <Slider value={config.keywordWeight} min={0} max={1} step={0.1} onChange={(v) => update('keywordWeight', typeof v === 'number' ? v : Number(v))} /></div>
          <div className="mp-kb-config-hint">
            <div>
              融合公式：<code>{fmtWeight(config.vectorWeight)} × 向量分 + {fmtWeight(config.keywordWeight)} × 关键词分</code>
            </div>
            <div>两值之和 ≠ 1 也能用，按权重加权融合。</div>
          </div>
        </Card>

        {/* Top-K 与阈值 */}
        <Card className="mp-p-4">
          <GroupHeader title="Top-K 与阈值" desc="控制返回片段数量与相似度下限" />
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">Top-K</div>
            <InputNumber min={1} max={100} value={config.topK} onChange={(v) => update('topK', typeof v === 'number' ? v : 10)} /></div>
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">相似度阈值</div>
            <Slider value={config.similarityThreshold} min={0} max={1} step={0.05} onChange={(v) => update('similarityThreshold', typeof v === 'number' ? v : Number(v))} /></div>
          <div className="mp-kb-config-hint">
            <div>Top-K：返回前 N 个最相似片段，默认 10。</div>
            <div>
              相似度阈值：score &lt; {fmtWeight(config.similarityThreshold)} 的命中会被过滤掉，0 表示不过滤。
            </div>
          </div>
        </Card>

        {/* Reranker */}
        <Card className="mp-p-4">
          <GroupHeader title="Reranker" desc="对 Top-K 结果二次精排（keyword 策略支持中文）" />
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">启用 Reranker</div>
            <Switch checked={config.rerankerEnabled} onChange={(v) => update('rerankerEnabled', v)} /></div>
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">Reranker 策略</div>
            <Select className="mp-kb-w-300" value={config.rerankStrategy} optionList={RERANK_OPTIONS}
              onChange={(v) => update('rerankStrategy', v as RerankStrategy)} disabled={!config.rerankerEnabled} /></div>
        </Card>

        {/* 引用与可解释 */}
        <Card className="mp-p-4">
          <GroupHeader title="引用与可解释" desc="返回结果是否附带来源引用" />
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">显示引用来源</div>
            <Switch checked={config.showCitations} onChange={(v) => update('showCitations', v)} /></div>
        </Card>

        {/* 分块策略 */}
        <Card className="mp-p-4">
          <GroupHeader title="分块策略" desc="文档切片策略与大小（在文档入库时生效）" />
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">切片策略</div>
            <Select className="mp-kb-w-300" value={config.chunkStrategy} optionList={CHUNK_OPTIONS}
              onChange={(v) => update('chunkStrategy', v as ChunkStrategy)} /></div>
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">分块最大长度</div>
            <InputNumber min={64} max={2048} value={config.chunkSize} suffix="chars"
              onChange={(v) => update('chunkSize', typeof v === 'number' ? v : 512)} /></div>
          <div className="mp-kb-config-row"><div className="mp-kb-config-label">分块重叠</div>
            <InputNumber min={0} max={512} value={config.chunkOverlap} suffix="chars"
              onChange={(v) => update('chunkOverlap', typeof v === 'number' ? v : 64)} /></div>
          <div className="mp-kb-config-hint">
            当前切片：{config.chunkStrategy} · {config.chunkSize} 字 / 重叠 {config.chunkOverlap}
          </div>
          {config.chunkOverlap >= config.chunkSize * OVERLAP_WARN_RATIO && (
            <div className="mp-kb-config-warn">
              ⚠ 重叠 ≥ 分块长度的 {OVERLAP_WARN_RATIO * 100}% 会导致片段大量重复，请确认重叠明显小于 {config.chunkSize}。
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function GroupHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mp-mb-3">
      <div className="mp-fw-600 mp-gap-2 mp-text-md mp-flex-center">
        <Settings size={14} className="mp-icon-14 mp-text-2" />{title}
      </div>
      <div className="mp-text-sm mp-text-2 mp-mt-1" >{desc}</div>
    </div>
  );
}

/** P1.8 历史列表:每条 = v{N} · snapshot_at · rerank_strategy/top_k/vector·keyword。
 *  只读展示,刻意不渲染 form-input,防止误以为可以回滚。 */
function HistoryList({ snapshots }: { snapshots: RetrievalConfigSnapshot[] }) {
  return (
    <div className="mp-flex mp-gap-1 mp-flex-col" >
      {snapshots.map((s, idx) => (
        <div
          key={s.id}
          className="mp-grid mp-items-center mp-gap-3 mp-text-body mp-py-2 mp-px-1 mp-kb-hist-row"
        >
          <div>
            <Tag color="blue" shape="circle" size="small">v{s.version}</Tag>
          </div>
          <div className="mp-num mp-text-2">
            {s.snapshotAt || '—'}
          </div>
          <div className="mp-text-sm mp-mono">
            {s.rerankStrategy}/{s.topK} · vector {Number(s.vectorWeight).toFixed(2)} · kw {Number(s.keywordWeight).toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}

function toUpdate(cfg: RetrievalConfig): RetrievalConfigUpdate {
  // version/tenantId/updatedAt 都是服务端管理字段,剥离以便用 Omit<…,…,…,…> 推导的类型。
  const { tenantId: _t, version: _v, updatedAt: _u, ...rest } = cfg;
  return rest;
}

/** key 排序后的稳定 JSON 序列化（本页配置为一层扁平结构，无需递归） */
function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(obj).sort().map((k) => [k, obj[k]] as const),
  );
}
