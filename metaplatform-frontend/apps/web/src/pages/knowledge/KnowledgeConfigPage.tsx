/**
 * KnowledgeConfigPage
 * --------------------------------------------------
 * 知识库模块 → 检索配置 tab
 * 路由：/knowledge/config
 *
 * 真实读写后端 GET/PUT /api/v1/kb/retrieval-config（租户级全局检索配置）。
 * 选项与后端 mate-app-kb RetrievalConfig 对齐：mode / rerank_strategy /
 * chunk_strategy 等均为后端真实支持的枚举值。
 * P1.8: 顶部 v{N} 版本徽章 + GET /retrieval-config/history 只读折叠面板。
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, Switch, InputNumber, Select, Slider, Toast, Spin, Button, Tag, Collapse, Empty } from '@douyinfe/semi-ui';
import { Settings, Save, RefreshCw, History } from 'lucide-react';
import { useApiErrorBoundary } from '@mate/shared';
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

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--foreground)' };
const rowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'center',
  padding: '10px 0', borderBottom: '1px solid var(--border)',
};
/** 卡片内的说明脚注：与 rowStyle 的 label 列对齐，纯文字不占交互 */
const hintStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 10, lineHeight: 1.7,
};
const warnStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--destructive, #f5222d)', paddingTop: 6, lineHeight: 1.7,
};

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
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
              检索配置
              {/* P1.8: 当前 config 的单调递增 version。配置从未保存过时为 v1,首次保存后变 v2。 */}
              <Tag color="blue" shape="circle" style={{ marginLeft: 4 }}>v{version}</Tag>
              {dirty && (
                <span style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--destructive, #f5222d)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  ● 待保存
                </span>
              )}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
              全局检索策略、Top-K、Reranker、分块策略的统一管理（租户级）
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<RefreshCw size={14} />} onClick={onReset} theme="light">恢复前端默认值</Button>
            <Button icon={<Save size={14} />} onClick={onSave} loading={saving} theme="solid" type="primary">保存配置</Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* P1.8: 配置历史只读折叠面板 — 仅展示最近 5 条,不支持回滚(后端未实现)。 */}
          <Card style={{ padding: 18 }}>
            <Collapse
              keepDOM={false}
              defaultActiveKey={history.length > 0 ? ['history'] : []}
            >
              <Collapse.Panel
                itemKey="history"
                header={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <History size={14} style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>配置历史</span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      最近 {Math.min(history.length, 5)} 条 · 只读 · 不支持回滚
                    </span>
                  </span>
                }
              >
                {!historyLoaded ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>
                ) : history.length === 0 ? (
                  <Empty
                    description="尚无历史快照;每次点击「保存配置」时,保存前的旧版本会被记录下来"
                    style={{ padding: '12px 0' }}
                  />
                ) : (
                  <HistoryList snapshots={history.slice(0, 5)} />
                )}
              </Collapse.Panel>
            </Collapse>
          </Card>

          {/* 检索策略 */}
          <Card style={{ padding: 18 }}>
            <GroupHeader title="检索策略" desc="召回模式与混合权重（权重在 RAG_MODE=hybrid/full 下生效）" />
            <div style={rowStyle}><div style={labelStyle}>检索模式</div>
              <Select style={{ width: 260 }} value={config.mode} optionList={MODE_OPTIONS}
                onChange={(v) => update('mode', v as RetrievalMode)} /></div>
            <div style={rowStyle}><div style={labelStyle}>向量召回权重</div>
              <Slider value={config.vectorWeight} min={0} max={1} step={0.1} onChange={(v) => update('vectorWeight', typeof v === 'number' ? v : Number(v))} /></div>
            <div style={rowStyle}><div style={labelStyle}>关键词召回权重</div>
              <Slider value={config.keywordWeight} min={0} max={1} step={0.1} onChange={(v) => update('keywordWeight', typeof v === 'number' ? v : Number(v))} /></div>
            <div style={hintStyle}>
              <div>
                融合公式：<code>{fmtWeight(config.vectorWeight)} × 向量分 + {fmtWeight(config.keywordWeight)} × 关键词分</code>
              </div>
              <div>两值之和 ≠ 1 也能用，按权重加权融合。</div>
            </div>
          </Card>

          {/* Top-K 与阈值 */}
          <Card style={{ padding: 18 }}>
            <GroupHeader title="Top-K 与阈值" desc="控制返回片段数量与相似度下限" />
            <div style={rowStyle}><div style={labelStyle}>Top-K</div>
              <InputNumber min={1} max={100} value={config.topK} onChange={(v) => update('topK', typeof v === 'number' ? v : 10)} /></div>
            <div style={rowStyle}><div style={labelStyle}>相似度阈值</div>
              <Slider value={config.similarityThreshold} min={0} max={1} step={0.05} onChange={(v) => update('similarityThreshold', typeof v === 'number' ? v : Number(v))} /></div>
            <div style={hintStyle}>
              <div>Top-K：返回前 N 个最相似片段，默认 10。</div>
              <div>
                相似度阈值：score &lt; {fmtWeight(config.similarityThreshold)} 的命中会被过滤掉，0 表示不过滤。
              </div>
            </div>
          </Card>

          {/* Reranker */}
          <Card style={{ padding: 18 }}>
            <GroupHeader title="Reranker" desc="对 Top-K 结果二次精排（keyword 策略支持中文）" />
            <div style={rowStyle}><div style={labelStyle}>启用 Reranker</div>
              <Switch checked={config.rerankerEnabled} onChange={(v) => update('rerankerEnabled', v)} /></div>
            <div style={rowStyle}><div style={labelStyle}>Reranker 策略</div>
              <Select style={{ width: 300 } as React.CSSProperties} value={config.rerankStrategy} optionList={RERANK_OPTIONS}
                onChange={(v) => update('rerankStrategy', v as RerankStrategy)} disabled={!config.rerankerEnabled} /></div>
          </Card>

          {/* 引用与可解释 */}
          <Card style={{ padding: 18 }}>
            <GroupHeader title="引用与可解释" desc="返回结果是否附带来源引用" />
            <div style={rowStyle}><div style={labelStyle}>显示引用来源</div>
              <Switch checked={config.showCitations} onChange={(v) => update('showCitations', v)} /></div>
          </Card>

          {/* 分块策略 */}
          <Card style={{ padding: 18 }}>
            <GroupHeader title="分块策略" desc="文档切片策略与大小（在文档入库时生效）" />
            <div style={rowStyle}><div style={labelStyle}>切片策略</div>
              <Select style={{ width: 300 } as React.CSSProperties} value={config.chunkStrategy} optionList={CHUNK_OPTIONS}
                onChange={(v) => update('chunkStrategy', v as ChunkStrategy)} /></div>
            <div style={rowStyle}><div style={labelStyle}>分块最大长度</div>
              <InputNumber min={64} max={2048} value={config.chunkSize} suffix="chars"
                onChange={(v) => update('chunkSize', typeof v === 'number' ? v : 512)} /></div>
            <div style={rowStyle}><div style={labelStyle}>分块重叠</div>
              <InputNumber min={0} max={512} value={config.chunkOverlap} suffix="chars"
                onChange={(v) => update('chunkOverlap', typeof v === 'number' ? v : 64)} /></div>
            <div style={hintStyle}>
              当前切片：{config.chunkStrategy} · {config.chunkSize} 字 / 重叠 {config.chunkOverlap}
            </div>
            {config.chunkOverlap >= config.chunkSize * OVERLAP_WARN_RATIO && (
              <div style={warnStyle}>
                ⚠ 重叠 ≥ 分块长度的 {OVERLAP_WARN_RATIO * 100}% 会导致片段大量重复，请确认重叠明显小于 {config.chunkSize}。
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={14} style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{desc}</div>
    </div>
  );
}

/** P1.8 历史列表:每条 = v{N} · snapshot_at · rerank_strategy/top_k/vector·keyword。
 *  只读展示,刻意不渲染 form-input,防止误以为可以回滚。 */
function HistoryList({ snapshots }: { snapshots: RetrievalConfigSnapshot[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {snapshots.map((s, idx) => (
        <div
          key={s.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '90px 200px 1fr',
            gap: 12,
            alignItems: 'center',
            padding: '10px 4px',
            borderBottom: idx === snapshots.length - 1 ? 'none' : '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          <div>
            <Tag color="blue" shape="circle" size="small">v{s.version}</Tag>
          </div>
          <div style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
            {s.snapshotAt || '—'}
          </div>
          <div style={{ fontFamily: 'var(--semi-font-mono, monospace)', fontSize: 12 }}>
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
