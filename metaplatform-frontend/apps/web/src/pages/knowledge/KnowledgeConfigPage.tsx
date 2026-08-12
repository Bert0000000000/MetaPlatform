/**
 * KnowledgeConfigPage
 * --------------------------------------------------
 * 知识库模块 → 检索配置 tab
 * 路由：/knowledge/config
 */
import { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { Settings, Save, RefreshCw } from 'lucide-react';


// MOCK: 检索配置分组
type ConfigItem =
  | { key: string; label: string; type: 'toggle'; value: boolean }
  | { key: string; label: string; type: 'slider'; value: number; min: number; max: number; step: number; unit?: string }
  | { key: string; label: string; type: 'number'; value: number; min: number; max: number; unit?: string }
  | { key: string; label: string; type: 'select'; value: string; options: string[] };

const CONFIG_GROUPS: Array<{ title: string; desc: string; items: ConfigItem[] }> = [
  {
    title: '检索策略',
    desc: '向量召回与关键词召回的混合策略',
    items: [
      { key: 'hybrid_search', label: '混合检索（向量 + 关键词）', type: 'toggle', value: true },
      { key: 'vector_weight', label: '向量召回权重', type: 'slider', value: 0.7, min: 0, max: 1, step: 0.1 },
      { key: 'keyword_weight', label: '关键词召回权重', type: 'slider', value: 0.3, min: 0, max: 1, step: 0.1 },
    ],
  },
  {
    title: 'Top-K 与阈值',
    desc: '控制返回片段数量与相似度下限',
    items: [
      { key: 'top_k', label: 'Top-K', type: 'number', value: 10, min: 1, max: 50 },
      { key: 'similarity_threshold', label: '相似度阈值', type: 'slider', value: 0.75, min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: 'Reranker',
    desc: '对 Top-K 结果二次精排',
    items: [
      { key: 'reranker_enabled', label: '启用 Reranker', type: 'toggle', value: true },
      { key: 'reranker_model', label: 'Reranker 模型', type: 'select', value: 'bge-reranker-large', options: ['bge-reranker-large', 'bge-reranker-base', 'cohere-rerank-v3'] },
      { key: 'reranker_top_k', label: 'Reranker 输入 Top-K', type: 'number', value: 20, min: 5, max: 100 },
    ],
  },
  {
    title: '引用与可解释',
    desc: '返回结果是否附带来源引用',
    items: [
      { key: 'show_citations', label: '显示引用来源', type: 'toggle', value: true },
      { key: 'citation_count', label: '每个回答引用数', type: 'number', value: 3, min: 1, max: 10 },
    ],
  },
  {
    title: '分块策略',
    desc: '文档切片大小与重叠',
    items: [
      { key: 'chunk_size', label: '分块最大长度', type: 'number', value: 512, min: 64, max: 2048, unit: ' tokens' },
      { key: 'chunk_overlap', label: '分块重叠', type: 'number', value: 50, min: 0, max: 512, unit: ' tokens' },
    ],
  },
];

export default function KnowledgeConfigPage() {
  const [configs, setConfigs] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    CONFIG_GROUPS.forEach((g) => g.items.forEach((it) => { map[it.key] = it.value; }));
    return map;
  });

  const update = (key: string, value: unknown) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>检索配置</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>全局检索策略、Top-K、Reranker、分块策略的统一管理</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button theme="light" type="secondary" ><RefreshCw style={{ width: 16, height: 16 }} />恢复默认</Button>
          <Button theme="solid" type="primary" ><Save style={{ width: 16, height: 16 }} />保存配置</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CONFIG_GROUPS.map((group) => (
          <div key={group.title} className="v-card" style={{ padding: 18 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{group.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{group.desc}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {group.items.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr',
                    gap: 16,
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.label}</div>
                  <div>
                    {item.type === 'toggle' && (
                      <div
                        onClick={() => update(item.key, !configs[item.key])}
                        style={{
                          width: 36, height: 20, borderRadius: 10,
                          background: configs[item.key] ? 'var(--success)' : 'var(--muted-foreground)',
                          position: 'relative', cursor: 'pointer',
                          opacity: 0.4 + (configs[item.key] ? 0.6 : 0),
                          transition: 'opacity .15s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', width: 14, height: 14,
                          borderRadius: '50%', background: '#fff',
                          top: 3, left: configs[item.key] ? 19 : 3,
                          transition: 'left .15s',
                        }} />
                      </div>
                    )}
                    {item.type === 'slider' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="range"
                          min={item.min}
                          max={item.max}
                          step={item.step}
                          value={Number(configs[item.key])}
                          onChange={(e) => update(item.key, Number(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--primary)' }}
                        />
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 13,
                          minWidth: 40, textAlign: 'right', color: 'var(--foreground)',
                        }}>
                          {String(configs[item.key])}{item.unit ?? ''}
                        </span>
                      </div>
                    )}
                    {item.type === 'number' && (
                      <input
                        type="number"
                        value={Number(configs[item.key])}
                        min={item.min}
                        max={item.max}
                        onChange={(e) => update(item.key, Number(e.target.value))}
                        style={{
                          width: 120, padding: '6px 10px',
                          background: 'var(--muted)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', color: 'var(--foreground)',
                          fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                      />
                    )}
                    {item.type === 'select' && (
                      <select
                        value={String(configs[item.key])}
                        onChange={(e) => update(item.key, e.target.value)}
                        style={{
                          padding: '6px 28px 6px 10px', background: 'var(--muted)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          color: 'var(--foreground)', fontSize: 13, outline: 'none',
                          cursor: 'pointer', appearance: 'none',
                        }}
                      >
                        {item.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}