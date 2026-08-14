/**
 * KnowledgeConfigPage
 * --------------------------------------------------
 * 知识库模块 → 检索配置 tab
 * 路由：/knowledge/config
 *
 * 真实读写后端 GET/PUT /api/v1/kb/retrieval-config（租户级全局检索配置）。
 * 选项与后端 mate-app-kb RetrievalConfig 对齐：mode / rerank_strategy /
 * chunk_strategy 等均为后端真实支持的枚举值。
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, Switch, InputNumber, Select, Slider, Toast, Spin, Button } from '@douyinfe/semi-ui';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { useApiErrorBoundary } from '@mate/shared';
import {
  getRetrievalConfig,
  putRetrievalConfig,
  type RetrievalConfig,
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getRetrievalConfig()
      .then((cfg: RetrievalConfig) => {
        if (!alive) return;
        const next = toUpdate(cfg);
        setConfig(next);
        setOriginalConfig(next);
      })
      .catch((e: Error) => {
        report(e);
        if (!alive) return;
        setConfig(DEFAULT_CONFIG);
        setOriginalConfig(DEFAULT_CONFIG);
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
      await putRetrievalConfig(config);
      setOriginalConfig(config); // 保存成功 → 基线前移，「待保存」消失
      Toast.success('检索配置已保存');
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

function toUpdate(cfg: RetrievalConfig): RetrievalConfigUpdate {
  const { tenantId: _t, updatedAt: _u, ...rest } = cfg;
  return rest;
}

/** key 排序后的稳定 JSON 序列化（本页配置为一层扁平结构，无需递归） */
function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(obj).sort().map((k) => [k, obj[k]] as const),
  );
}
