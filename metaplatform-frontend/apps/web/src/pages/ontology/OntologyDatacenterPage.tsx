import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  RefreshCw, GitBranch, Plus, Activity, PlugZap, Layers,
  Network, Share2,
  AlertCircle,
  ShieldCheck, Database, Globe, Radio, HardDrive, Settings2, MoreHorizontal,
  Pause, Server, Calendar, BarChart3, Maximize2,
} from 'lucide-react';
import LineageFullView from './components/LineageFullView';
import { AIAssistantTrigger, AIAssistantWorkspace, ErrorBoundary, usePageAssistant } from '@mate/shared';
import BigDataSourceView from './components/BigDataSourceView';
import CDCView from './components/CDCView';
import ETLView from './components/ETLView';
import SchedulerView from './components/SchedulerView';
import MetricView from './components/MetricView';
import DataGraphView from './components/DataGraphView';
import { listBigDataSources, listCDCTasks, listDataProducts, type BigDataSource, type CDCTask, type DataProduct } from '@/api/ontology-bigdata';


const DATACENTER_SUBTABS = [
  { id: 'bigdata', label: '大数据源', icon: Server, count: 0 },
  { id: 'cdc', label: 'CDC 同步', icon: Radio, count: 0 },
  { id: 'etl', label: 'ETL 任务', icon: Calendar, count: 0 },
  { id: 'scheduler', label: '调度中心', icon: Calendar, count: 0 },
  { id: 'metric', label: '数据指标', icon: BarChart3, count: 0 },
  { id: 'mapping', label: '数据映射', icon: Layers, count: 0 },
  { id: 'quality', label: '数据质量', icon: ShieldCheck, count: 0 },
  { id: 'lineage', label: '数据血缘', icon: GitBranch, count: 0 },
  { id: 'datagraph', label: '数据图谱', icon: Network, count: 0 },
  { id: 'lake', label: '数据湖', icon: Database, count: 0 },
];

const badgeColor = (type: string) =>
  type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : type === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)';

// 真实数据的状态 → 中文标签/颜色（key 为前端适配后的大写枚举）
const SOURCE_STATUS: Record<string, { label: string; type: string }> = {
  ACTIVE: { label: '已连接', type: 'success' },
  INACTIVE: { label: '已断开', type: 'warning' },
  ERROR: { label: '异常', type: 'error' },
};
const CDC_STATUS: Record<string, { label: string; type: string }> = {
  RUNNING: { label: '运行中', type: 'success' },
  PAUSED: { label: '已暂停', type: 'warning' },
  FAILED: { label: '失败', type: 'error' },
  STOPPED: { label: '已停止', type: 'warning' },
  PENDING: { label: '待启动', type: 'warning' },
  SNAPSHOTTING: { label: '快照中', type: 'warning' },
};
const PRODUCT_STATUS: Record<string, { label: string; type: string }> = {
  published: { label: '已发布', type: 'success' },
  certified: { label: '已认证', type: 'success' },
  draft: { label: '草稿', type: 'warning' },
  suspended: { label: '已停用', type: 'error' },
};

export default function OntologyDatacenterPage() {
    const [activeSubTab, setActiveSubTab] = useState('bigdata');
  const [reloadKey, setReloadKey] = useState(0);
  const assistant = usePageAssistant({
    employeeId: 'ontology-data-steward',
    employeeName: '本体数据管家',
    employeeDescription: '帮助你把控本体数据质量、数据一致性和数据源同步状态',
    moduleLabel: 'Ontology 数据中心',
    welcomeMessage: '你好，我是本体数据管家。可协助你分析数据源、同步状态和数据质量指标。',
    suggestions: ['分析本体数据质量', '检查数据一致性', '调查数据同步异常'],
    createReply: (content) => `我会结合数据源连接、同步状态和质量指标来分析「${content}」。当前为数据中心模块的大屏模式。`,
  });

  const renderSubTabContent = () => {
    const sub = (node: React.ReactNode) => (
      <ErrorBoundary key={`${activeSubTab}-${reloadKey}`} fallback={<SubErrorFallback name={activeSubTab} />}>
        {node}
      </ErrorBoundary>
    );
    switch (activeSubTab) {
      case 'bigdata': return sub(<BigDataSourceView />);
      case 'cdc': return sub(<CDCView />);
      case 'etl': return sub(<ETLView />);
      case 'scheduler': return sub(<SchedulerView />);
      case 'metric': return sub(<MetricView />);
      case 'mapping': return sub(<MappingView />);
      case 'quality': return sub(<QualityView />);
      case 'lineage': return sub(<LineageFullView />);
      case 'datagraph': return sub(<DataGraphView />);
      case 'lake': return sub(<LakeView />);
      default: return sub(<BigDataSourceView />);
    }
  };

  return (
    <AIAssistantWorkspace assistant={assistant}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>数据中心</h1>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>数据源管理、数据加工、数据质量与血缘</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setReloadKey((k) => k + 1)} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <RefreshCw style={{ width: 12, height: 12 }} />刷新
              </button>
              <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
            </div>
          </div>

          {/* SubTab 导航 */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 20, rowGap: 4 }}>
            {DATACENTER_SUBTABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    background: 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: -1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SubTab 内容 */}
          {renderSubTabContent()}
        </div>
      </div>
    </AIAssistantWorkspace>
  );
}

function MappingView() {
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [tasks, setTasks] = useState<CDCTask[]>([]);
  const [products, setProducts] = useState<DataProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [src, cdc, prd] = await Promise.all([listBigDataSources(), listCDCTasks(), listDataProducts()]);
        if (!active) return;
        setSources(src); setTasks(cdc); setProducts(prd);
      } catch (e) {
        console.warn('数据映射加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const sourceName = (id: string) => sources.find((s) => s.sourceId === id)?.name || id;

  // 真实映射流：CDC（源 → ODS）+ 数据产品（Paimon → Iceberg ADS）
  const rows = [
    ...tasks.map((t) => ({
      name: `${sourceName(t.sourceId)} → ${t.targetName}`,
      source: sourceName(t.sourceId),
      target: t.targetName,
      mode: t.syncMode === 'INCREMENTAL_ONLY' ? '增量' : t.syncMode === 'SNAPSHOT_ONLY' ? '快照' : '全量+增量',
      lastSync: t.lastSyncAt ? new Date(t.lastSyncAt).toLocaleString('zh-CN') : '-',
      status: t.status,
      statusType: (CDC_STATUS[t.status] ?? { type: 'warning' }).type,
      statusLabel: (CDC_STATUS[t.status] ?? { label: t.status }).label,
    })),
    ...products.map((p) => ({
      name: `${p.sourcePaimonTable} → ${p.targetIcebergTable}`,
      source: p.sourcePaimonTable,
      target: p.targetIcebergTable,
      mode: p.modality === 'embedding' ? '向量' : p.modality === 'chunk' ? '切片' : '结构化',
      lastSync: p.updatedAt ? new Date(p.updatedAt).toLocaleString('zh-CN') : '-',
      status: p.status,
      statusType: (PRODUCT_STATUS[p.status] ?? { type: 'warning' }).type,
      statusLabel: (PRODUCT_STATUS[p.status] ?? { label: p.status }).label,
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>
          外部数据源到 Ontology 实体的字段映射（真实：CDC 任务 + 数据产品）
        </div>
        <button style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建映射
        </button>
      </div>
      <div className="v-card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无映射（尚无 CDC 任务或数据产品）</div>
        ) : (
        <table className="v-table">
          <thead>
            <tr><th>映射名</th><th>源</th><th>目标</th><th>模式</th><th>最后同步</th><th>状态</th></tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{m.name}</td>
                <td style={{ fontSize: 12 }}>{m.source}</td>
                <td style={{ fontSize: 12 }}>{m.target}</td>
                <td><span className="v-badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 10 }}>{m.mode}</span></td>
                <td style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.lastSync}</td>
                <td><span className={`v-badge v-badge-${m.statusType}`}>{m.statusLabel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function QualityView() {
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [tasks, setTasks] = useState<CDCTask[]>([]);
  const [products, setProducts] = useState<DataProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [src, cdc, prd] = await Promise.all([listBigDataSources(), listCDCTasks(), listDataProducts()]);
        if (!active) return;
        setSources(src); setTasks(cdc); setProducts(prd);
      } catch (e) {
        console.warn('数据质量加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const sourceOk = sources.filter((s) => s.status === 'ACTIVE').length;
  const sourceHealth = sources.length ? Math.round((sourceOk / sources.length) * 1000) / 10 : 0;
  const cdcOk = tasks.filter((t) => t.status === 'RUNNING').length;
  const cdcHealth = tasks.length ? Math.round((cdcOk / tasks.length) * 1000) / 10 : 0;
  const published = products.filter((p) => p.status === 'published' || p.status === 'certified').length;
  const productHealth = products.length ? Math.round((published / products.length) * 1000) / 10 : 0;

  const metrics = [
    { label: '数据源健康率', value: sources.length ? `${sourceHealth}%` : '—', level: sourceHealth >= 80 ? 'good' : sourceHealth > 0 ? 'fair' : 'bad', width: `${sourceHealth || 0}%` },
    { label: 'CDC 同步健康率', value: tasks.length ? `${cdcHealth}%` : '—', level: cdcHealth >= 80 ? 'good' : cdcHealth > 0 ? 'fair' : 'bad', width: `${cdcHealth || 0}%` },
    { label: '产品发布率', value: products.length ? `${productHealth}%` : '—', level: productHealth >= 80 ? 'good' : productHealth > 0 ? 'fair' : 'bad', width: `${productHealth || 0}%` },
    { label: '数据源总数', value: sources.length, level: 'good', width: '100%' },
    { label: '同步任务总数', value: tasks.length, level: 'good', width: '100%' },
    { label: '数据产品总数', value: products.length, level: 'good', width: '100%' },
  ];

  // 真实资源状态记录（源 / CDC / 产品）
  const records = [
    ...sources.map((s) => ({ time: s.updatedAt, rule: 'data_source', source: s.name, dim: '数据源', score: SOURCE_STATUS[s.status]?.label ?? s.status, scoreColor: SOURCE_STATUS[s.status]?.type ?? 'warning', anomalies: 0 })),
    ...tasks.map((t) => ({ time: t.lastSyncAt ?? '', rule: 'cdc_sync', source: t.name, dim: 'CDC 同步', score: CDC_STATUS[t.status]?.label ?? t.status, scoreColor: CDC_STATUS[t.status]?.type ?? 'warning', anomalies: 0 })),
    ...products.map((p) => ({ time: p.updatedAt, rule: 'data_product', source: p.name, dim: '数据产品', score: PRODUCT_STATUS[p.status]?.label ?? p.status, scoreColor: PRODUCT_STATUS[p.status]?.type ?? 'warning', anomalies: 0 })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {metrics.map((q) => (
          <div key={q.label} className="v-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{q.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: q.level === 'good' ? 'var(--success)' : q.level === 'fair' ? 'var(--warning)' : 'var(--destructive)' }}>{q.value}</div>
            <div style={{ height: 4, background: 'var(--muted)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: q.width, background: q.level === 'good' ? 'var(--success)' : q.level === 'fair' ? 'var(--warning)' : 'var(--destructive)' }} />
            </div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--muted-foreground)' }}>
          资源状态（来自真实数据平台控制面：数据源 / CDC 同步 / 数据产品）
        </div>
        <div className="v-card">
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
          ) : records.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无资源数据</div>
          ) : (
          <table className="v-table">
            <thead>
              <tr><th>更新时间</th><th>资源类型</th><th>资源名</th><th>维度</th><th>状态</th><th>异常数</th></tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td><span className="v-meta">{r.time ? new Date(r.time).toLocaleString('zh-CN') : '-'}</span></td>
                  <td><span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{r.rule}</span></td>
                  <td>{r.source}</td>
                  <td>{r.dim}</td>
                  <td><span className={`v-badge v-badge-${r.scoreColor}`}>{r.score}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.anomalies}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}

function LakeView() {
  const [products, setProducts] = useState<DataProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const prd = await listDataProducts();
        if (!active) return;
        setProducts(prd);
      } catch (e) {
        console.warn('数据湖加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="v-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>数据湖表（Iceberg ADS 数据产品）</div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
        ) : products.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无数据产品</div>
        ) : (
        <table className="v-table">
          <thead>
            <tr><th>表名</th><th>格式</th><th>来源表</th><th>同步方式</th><th>操作</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.targetIcebergTable}</td>
                <td style={{ fontSize: 12 }}>Iceberg / {p.modality}</td>
                <td style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{p.sourcePaimonTable} · v{p.version}</td>
                <td><span className={`v-badge v-badge-${(PRODUCT_STATUS[p.status] ?? { type: 'warning' }).type}`}>{(PRODUCT_STATUS[p.status] ?? { label: p.status }).label}</span></td>
                <td>
                  <button style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} title="查看详情">
                    <Settings2 style={{ width: 14, height: 14 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}


function SubErrorFallback({ name }: { name: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--destructive)' }}>
      <AlertCircle style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>该模块加载失败: {name}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>请刷新页面或联系管理员</div>
    </div>
  );
}


