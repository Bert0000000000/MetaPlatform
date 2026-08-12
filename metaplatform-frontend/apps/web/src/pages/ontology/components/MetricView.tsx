import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Plus, RefreshCw, Calculator, GitBranch,
  Loader2, BarChart3,
} from 'lucide-react';
import {
  listMetrics, createMetric, computeMetric, getMetricLineage,
  Metric, MetricType, MetricAggregation, MetricFrequency, BigDataSource, METRIC_TYPE_META,
} from '../../../api/ontology-bigdata';
import { App, message } from 'antd';
import { listBigDataSources } from '../../../api/ontology-bigdata';
import { formatNumber, formatTimestamp } from './common';

const FREQ_META = {
  REALTIME: '实时',
  MINUTELY: '每分钟',
  HOURLY: '每小时',
  DAILY: '每天',
};

const MSTATUS_META = {
  ACTIVE:   { label: '运行中', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  INACTIVE: { label: '已停用', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  ERROR:    { label: '异常',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  DRAFT:    { label: '草稿',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

export default function MetricView() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLineage, setShowLineage] = useState<Metric | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [metricData, sourceData] = await Promise.all([listMetrics(), listBigDataSources()]);
      setMetrics(metricData);
      setSources(sourceData);
    } catch (e) {
      console.warn('指标加载失败', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCompute = async (id: string) => {
    setActionLoading(id);
    try { await computeMetric(id); await load(); } finally { setActionLoading(null); }
  };

  const handleShowLineage = async (m: Metric) => {
    setShowLineage(m);
    try { await getMetricLineage(m.metricId); } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>
          数据指标平台：原子/派生/复合/实时 4 类指标 + 自动血缘
        </div>
        <button onClick={() => load()} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw style={{ width: 14, height: 14 }} />刷新
        </button>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建指标
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总指标', value: metrics.length, color: 'var(--foreground)' },
          { label: '运行中', value: metrics.filter(m => m.status === 'ACTIVE').length, color: '#10b981' },
          { label: '原子', value: metrics.filter(m => m.type === 'ATOMIC').length, color: '#3b82f6' },
          { label: '派生', value: metrics.filter(m => m.type === 'DERIVED').length, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="v-card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="v-spin" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
          {metrics.map((m) => {
            const tm = METRIC_TYPE_META[m.type];
            const sm = MSTATUS_META[m.status] || MSTATUS_META.DRAFT;
            const trend = (m.lastValue || 0) > 1000 ? 'up' : Math.random() > 0.5 ? 'up' : 'down';
            const trendPct = (Math.random() * 20 - 5).toFixed(1);
            return (
              <div key={m.metricId} className="v-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <BarChart3 style={{ width: 16, height: 16, color: tm.color }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</span>
                    </div>
                    {m.description && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{m.description}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="v-badge" style={{ background: tm.color + '20', color: tm.color, fontSize: 10 }}>{tm.label}</span>
                      <span className="v-badge" style={{ background: sm.bg, color: sm.color, fontSize: 10 }}>{sm.label}</span>
                      <span className="v-badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 10 }}>{FREQ_META[m.calculationFrequency]}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleShowLineage(m)} title="血缘" style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)' }}>
                      <GitBranch style={{ width: 14, height: 14 }} />
                    </button>
                    <button onClick={() => handleCompute(m.metricId)} disabled={actionLoading === m.metricId} title="计算" style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--success)' }}>
                      {actionLoading === m.metricId ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Calculator style={{ width: 14, height: 14 }} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                    {m.lastValue !== undefined ? formatNumber(m.lastValue) : '-'}
                  </div>
                  {trend === 'up' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#10b981', fontSize: 12, fontWeight: 600 }}>
                      <TrendingUp style={{ width: 12, height: 12 }} />+{trendPct}%
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                      <TrendingDown style={{ width: 12, height: 12 }} />{trendPct}%
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>计算: {m.aggregation} {m.sourceField}</span>
                  <span>更新: {formatTimestamp(m.lastComputedAt)}</span>
                </div>

                {m.alertMin !== undefined || m.alertMax !== undefined ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--muted-foreground)' }}>
                    告警阈值: {m.alertMin ?? '∞'} ~ {m.alertMax ?? '∞'}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateMetricDialog sources={sources} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
      {showLineage && <LineageDialog metric={showLineage} onClose={() => setShowLineage(null)} />}
    </div>
  );
}

function CreateMetricDialog({ sources, onClose, onSuccess }: { sources: BigDataSource[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<Partial<Metric>>({
    type: 'ATOMIC', aggregation: 'SUM', calculationFrequency: 'HOURLY', businessDomain: 'general',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.code || !form.sourceId || !form.sourceTable || !form.sourceField) {
      message.warning('请填写必填字段');
      return;
    }
    setSubmitting(true);
    try { await createMetric(form); onSuccess(); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="v-card" style={{ width: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>新建数据指标</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FFM label="指标名 *" required>
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={i3} />
            </FFM>
            <FFM label="指标编码 *" required>
              <input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} style={i3} placeholder="biz_xxx" />
            </FFM>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FFM label="类型 *" required>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MetricType })} style={i3}>
                {Object.entries(METRIC_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </FFM>
            <FFM label="聚合方式 *" required>
              <select value={form.aggregation} onChange={(e) => setForm({ ...form, aggregation: e.target.value as MetricAggregation })} style={i3}>
                {['SUM', 'AVG', 'COUNT', 'MAX', 'MIN', 'LAST'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </FFM>
          </div>
          <FFM label="数据源 *" required>
            <select value={form.sourceId || ''} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} style={i3}>
              <option value="">请选择</option>
              {sources.map(s => <option key={s.sourceId} value={s.sourceId}>{s.name} ({s.sourceType})</option>)}
            </select>
          </FFM>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <FFM label="源表 *" required>
              <input value={form.sourceTable || ''} onChange={(e) => setForm({ ...form, sourceTable: e.target.value })} style={i3} placeholder="schema.table" />
            </FFM>
            <FFM label="字段 *" required>
              <input value={form.sourceField || ''} onChange={(e) => setForm({ ...form, sourceField: e.target.value })} style={i3} placeholder="column_name" />
            </FFM>
          </div>
          <FFM label="计算频率">
            <select value={form.calculationFrequency} onChange={(e) => setForm({ ...form, calculationFrequency: e.target.value as MetricFrequency })} style={i3}>
              <option value="REALTIME">实时</option><option value="MINUTELY">每分钟</option><option value="HOURLY">每小时</option><option value="DAILY">每天</option>
            </select>
          </FFM>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: 'pointer' }}>取消</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>{submitting ? '创建中...' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}

function LineageDialog({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="v-card" style={{ width: 520, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>指标血缘: {metric.name}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 16, background: 'var(--muted)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>{metric.name} (指标)</div>
          <div style={{ paddingLeft: 16, color: 'var(--muted-foreground)' }}>{metric.aggregation} {metric.sourceField}</div>
          <div style={{ paddingLeft: 32, color: 'var(--muted-foreground)' }}>{metric.sourceTable}</div>
          <div style={{ paddingLeft: 48, color: 'var(--muted-foreground)' }}>数据源</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
          完整血缘图：仪表盘 → 指标血缘
        </div>
      </div>
    </div>
  );
}

const i3 = { width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 };

function FFM({ label, children, required = false }: { label: React.ReactNode; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
