import { useLocation } from 'react-router-dom';
import { Button, Card, Tabs, Tag, Table } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { useEffect, useState } from 'react';
import {
  RefreshCw, GitBranch, Plus, Activity, PlugZap, Layers,
  Network, Share2,
  AlertCircle,
  ShieldCheck, Database, Globe, Radio, HardDrive, Settings2, MoreHorizontal,
  Pause, Server, Calendar, BarChart3, Maximize2,
} from 'lucide-react';
import LineageFullView from './components/LineageFullView';
import { ErrorBoundary } from '@mate/shared';
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

// 状态类型 → Semi Tag 颜色预设（表格内 v-badge 迁移）
const STATUS_TYPE_COLOR: Record<string, TagColor> = {
  success: 'green',
  warning: 'amber',
  error: 'red',
};

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

export default function OntologyDatacenterPage({ initialSubTab }: { initialSubTab?: string } = {}) {
    const [activeSubTab, setActiveSubTab] = useState(initialSubTab && DATACENTER_SUBTABS.some((t) => t.id === initialSubTab) ? initialSubTab : 'bigdata');
  const [reloadKey, setReloadKey] = useState(0);
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

          {/* Toolbar（Semi Button，替换原生 button） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button theme="light" type="secondary" size="small" icon={<RefreshCw style={{ width: 12, height: 12 }} />} onClick={() => setReloadKey((k) => k + 1)}>
              刷新
            </Button>
          </div>

          {/* SubTab 导航（Semi Tabs：可横向滚动、激活下划线由组件管理，不再手写换行边框） */}
          <Tabs
            type="line"
            size="small"
            activeKey={activeSubTab}
            onChange={(k) => setActiveSubTab(k)}
            tabList={DATACENTER_SUBTABS.map((tab) => {
              const Icon = tab.icon;
              return {
                itemKey: tab.id,
                tab: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon style={{ width: 14, height: 14 }} />
                    {tab.label}
                  </span>
                ),
              };
            })}
            style={{ marginBottom: 16 }}
          />

          {/* SubTab 内容 */}
          {renderSubTabContent()}
        </div>
    </div>
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

  interface MappingRow {
    name: string;
    source: string;
    target: string;
    mode: string;
    lastSync: string;
    status: string;
    statusType: string;
    statusLabel: string;
  }

  // 真实映射流：CDC（源 → ODS）+ 数据产品（Paimon → Iceberg ADS）
  const rows: MappingRow[] = [
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
      <Card bodyStyle={{padding: 12, display: 'flex', alignItems: 'center', gap: 12}}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>
          外部数据源到 Ontology 实体的字段映射（真实：CDC 任务 + 数据产品）
        </div>
        <button style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建映射
        </button>
      </Card>
      <Card>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无映射（尚无 CDC 任务或数据产品）</div>
        ) : (
        <Table
          rowKey="key"
          dataSource={rows.map((r, i) => ({ ...r, key: i }))}
          pagination={false}
          columns={[
            { title: '映射名', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
            { title: '源', dataIndex: 'source', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
            { title: '目标', dataIndex: 'target', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
            { title: '模式', dataIndex: 'mode', render: (v: string) => <Tag style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 10 }}>{v}</Tag> },
            { title: '最后同步', dataIndex: 'lastSync', render: (v: string) => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{v}</span> },
            { title: '状态', dataIndex: 'status', render: (_v: string, r: MappingRow) => <Tag color={(STATUS_TYPE_COLOR[r.statusType] ?? 'grey') as TagColor}>{r.statusLabel}</Tag> },
          ]}
        />
        )}
      </Card>
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
  interface QualityRecord {
    time?: string;
    rule: string;
    source: string;
    dim: string;
    score: string;
    scoreColor: string;
    anomalies: number;
  }
  const records: QualityRecord[] = [
    ...sources.map((s) => ({ time: s.updatedAt, rule: 'data_source', source: s.name, dim: '数据源', score: SOURCE_STATUS[s.status]?.label ?? s.status, scoreColor: SOURCE_STATUS[s.status]?.type ?? 'warning', anomalies: 0 })),
    ...tasks.map((t) => ({ time: t.lastSyncAt ?? '', rule: 'cdc_sync', source: t.name, dim: 'CDC 同步', score: CDC_STATUS[t.status]?.label ?? t.status, scoreColor: CDC_STATUS[t.status]?.type ?? 'warning', anomalies: 0 })),
    ...products.map((p) => ({ time: p.updatedAt, rule: 'data_product', source: p.name, dim: '数据产品', score: PRODUCT_STATUS[p.status]?.label ?? p.status, scoreColor: PRODUCT_STATUS[p.status]?.type ?? 'warning', anomalies: 0 })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {metrics.map((q) => (
          <Card key={q.label}  bodyStyle={{padding: '14px 16px'}}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{q.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: q.level === 'good' ? 'var(--success)' : q.level === 'fair' ? 'var(--warning)' : 'var(--destructive)' }}>{q.value}</div>
            <div style={{ height: 4, background: 'var(--muted)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: q.width, background: q.level === 'good' ? 'var(--success)' : q.level === 'fair' ? 'var(--warning)' : 'var(--destructive)' }} />
            </div>
          </Card>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--muted-foreground)' }}>
          资源状态（来自真实数据平台控制面：数据源 / CDC 同步 / 数据产品）
        </div>
        <Card>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
          ) : records.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无资源数据</div>
          ) : (
          <Table
            rowKey="key"
            dataSource={records.map((r, i) => ({ ...r, key: i }))}
            pagination={false}
            columns={[
              { title: '更新时间', dataIndex: 'time', render: (v?: string) => <span className="v-meta">{v ? new Date(v).toLocaleString('zh-CN') : '-'}</span> },
              { title: '资源类型', dataIndex: 'rule', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{v}</span> },
              { title: '资源名', dataIndex: 'source' },
              { title: '维度', dataIndex: 'dim' },
              { title: '状态', dataIndex: 'score', render: (_v: string, r: QualityRecord) => <Tag color={(STATUS_TYPE_COLOR[r.scoreColor] ?? 'grey') as TagColor}>{r.score}</Tag> },
              { title: '异常数', dataIndex: 'anomalies', render: (v: number) => <span style={{ fontFamily: 'var(--font-mono)' }}>{v}</span> },
            ]}
          />
          )}
        </Card>
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
      <Card bodyStyle={{padding: 16}}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>数据湖表（Iceberg ADS 数据产品）</div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
        ) : products.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无数据产品</div>
        ) : (
        <Table
          rowKey="id"
          dataSource={products}
          pagination={false}
          columns={[
            { title: '表名', dataIndex: 'targetIcebergTable', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
            { title: '格式', dataIndex: 'modality', render: (v: string) => <span style={{ fontSize: 12 }}>Iceberg / {v}</span> },
            { title: '来源表', dataIndex: 'sourcePaimonTable', render: (_v: string, r: DataProduct) => <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{r.sourcePaimonTable} · v{r.version}</span> },
            {
              title: '同步方式', dataIndex: 'status',
              render: (v: string) => {
                const st = PRODUCT_STATUS[v] ?? { label: v, type: 'warning' };
                return <Tag color={(STATUS_TYPE_COLOR[st.type] ?? 'grey') as TagColor}>{st.label}</Tag>;
              },
            },
            {
              title: '操作', dataIndex: 'id',
              render: () => (
                <button style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} title="查看详情">
                  <Settings2 style={{ width: 14, height: 14 }} />
                </button>
              ),
            },
          ]}
        />
        )}
      </Card>
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


