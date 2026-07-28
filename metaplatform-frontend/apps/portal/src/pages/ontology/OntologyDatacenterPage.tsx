import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  RefreshCw, GitBranch, Plus, Activity, PlugZap, Layers,
  Network, Share2,
  AlertCircle,
  ShieldCheck, Database, Globe, Radio, HardDrive, Settings2, MoreHorizontal,
  Pause, Server, Calendar, BarChart3, Maximize2,
} from 'lucide-react';
import LineageFullView from './components/LineageFullView';
import { AIAssistantTrigger, AIAssistantWorkspace, ErrorBoundary, SubTabs, usePageAssistant } from '@mate/shared';
import BigDataSourceView from './components/BigDataSourceView';
import CDCView from './components/CDCView';
import ETLView from './components/ETLView';
import SchedulerView from './components/SchedulerView';
import MetricView from './components/MetricView';
import DataGraphView from './components/DataGraphView';

const ONTOLOGY_TABS = [
  { label: '本体建模', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

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

const MAPPINGS = [
  { name: 'PostgreSQL.users -> ClickHouse.user_profile', source: 'PostgreSQL-主库', target: 'ClickHouse-分析集群', mode: 'UPSERT', lastSync: '2026-07-27 10:30', status: 'success' },
  { name: 'MySQL.orders -> Doris.daily_orders', source: 'MySQL-业务库', target: 'Doris-实时报表', mode: 'OVERWRITE', lastSync: '2026-07-27 10:28', status: 'success' },
  { name: 'Kafka.events -> Hudi.event_log', source: 'Kafka-消息流', target: 'Hudi-订单数据', mode: 'APPEND', lastSync: '2026-07-27 10:32', status: 'success' },
  { name: 'Hive.ods -> Iceberg.lake.ods', source: 'Hive-数据仓库', target: 'Iceberg-数据湖', mode: 'APPEND', lastSync: '2026-07-27 09:15', status: 'warning' },
];

const QUALITY_METRICS = [
  { label: '完整率', value: '99.1%', level: 'good', width: '99.1%' },
  { label: '准确率', value: '98.7%', level: 'good', width: '98.7%' },
  { label: '一致性', value: '97.8%', level: 'fair', width: '97.8%' },
  { label: '及时性', value: '99.5%', level: 'good', width: '99.5%' },
  { label: '唯一性', value: '99.9%', level: 'good', width: '99.9%' },
  { label: '有效性', value: '98.2%', level: 'good', width: '98.2%' },
];

const QC_RECORDS = [
  { time: '2026-07-22 10:00', rule: 'null_field_check', source: 'PostgreSQL-主库', dim: '完整率', score: '99.1%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 18 },
  { time: '2026-07-22 10:00', rule: 'fk_referential_check', source: 'PostgreSQL-主库', dim: '一致性', score: '97.8%', scoreColor: 'warning', status: '警告', statusType: 'warning', anomalies: 142 },
  { time: '2026-07-22 09:30', rule: 'duplicate_key_check', source: 'MySQL-业务库', dim: '唯一性', score: '99.9%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 2 },
  { time: '2026-07-22 09:30', rule: 'format_pattern_check', source: 'REST API-外部', dim: '有效性', score: '98.2%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 67 },
  { time: '2026-07-22 09:00', rule: 'sla_timeliness_check', source: 'Kafka-消息流', dim: '及时性', score: '99.5%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 8 },
];

const LAKE_TABLES = [
  { name: 'mate_ontology.entities', format: 'Hudi / COW', meta: '12.4 GB . 2.1M rows', badge: 'CDC 增量', badgeType: 'success' },
  { name: 'mate_ontology.relations', format: 'Hudi / COW', meta: '8.7 GB . 5.8M rows', badge: 'CDC 增量', badgeType: 'success' },
  { name: 'mate_audit.event_log', format: 'Hudi / MOR', meta: '9.2 GB . 18.3M rows', badge: 'CDC 增量', badgeType: 'success' },
  { name: 'mate_warehouse.dim_*', format: 'Hudi / COW', meta: '5.6 GB . 0.9M rows', badge: '批量', badgeType: 'neutral' },
  { name: 'mate_warehouse.dwd_*', format: 'Hudi / MOR', meta: '3.2 GB . 4.2M rows', badge: '批量', badgeType: 'neutral' },
  { name: 'ext_partner.raw_data', format: 'Iceberg', meta: '5.1 GB . 3.4M rows', badge: '追加', badgeType: 'neutral' },
  { name: 'ext_archive.legacy_dump', format: 'Iceberg', meta: '3.1 GB . 1.6M rows', badge: '追加', badgeType: 'neutral' },
];

const LINEAGE_NODES = [
  { id: 'src-1', label: 'MySQL.orders', type: 'source' },
  { id: 'src-2', label: 'PostgreSQL.users', type: 'source' },
  { id: 'src-3', label: 'Kafka.events', type: 'source' },
  { id: 'cdo-1', label: 'Hudi.orders_cdc', type: 'table' },
  { id: 'cdo-2', label: 'Hudi.user_profile', type: 'table' },
  { id: 'cdo-3', label: 'Hudi.event_log', type: 'table' },
  { id: 'dws-1', label: 'Iceberg.dws.orders', type: 'table' },
  { id: 'dws-2', label: 'Iceberg.dws.users', type: 'table' },
  { id: 'ads-1', label: 'ClickHouse.ads.daily_orders', type: 'table' },
  { id: 'ads-2', label: 'Doris.ads.user_metrics', type: 'table' },
];

const LINEAGE_EDGES = [
  { from: 'src-1', to: 'cdo-1' },
  { from: 'src-2', to: 'cdo-2' },
  { from: 'src-3', to: 'cdo-3' },
  { from: 'cdo-1', to: 'dws-1' },
  { from: 'cdo-2', to: 'dws-2' },
  { from: 'cdo-3', to: 'dws-1' },
  { from: 'dws-1', to: 'ads-1' },
  { from: 'dws-2', to: 'ads-2' },
];

const badgeColor = (type) =>
  type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : type === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)';

export default function OntologyDatacenterPage() {
  const location = useLocation();
  const [activeSubTab, setActiveSubTab] = useState('bigdata');
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
    const sub = (node) => (
      <ErrorBoundary fallback={<SubErrorFallback name="${activeSubTab}" />}>
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
        <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>数据中心</h1>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>数据源管理、数据加工、数据质量与血缘</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.location.reload()} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <RefreshCw style={{ width: 12, height: 12 }} />刷新
              </button>
              <AIAssistantTrigger assistant={assistant} label="AI 助手" />
            </div>
          </div>

          {/* SubTab 导航 */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20, overflowX: 'auto' }}>
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>外部数据源到 Ontology 实体的字段映射</div>
        <button style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建映射
        </button>
      </div>
      <div className="v-card">
        <table className="v-table">
          <thead>
            <tr><th>映射名</th><th>源</th><th>目标</th><th>模式</th><th>最后同步</th><th>状态</th></tr>
          </thead>
          <tbody>
            {MAPPINGS.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{m.name}</td>
                <td style={{ fontSize: 12 }}>{m.source}</td>
                <td style={{ fontSize: 12 }}>{m.target}</td>
                <td><span className="v-badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 10 }}>{m.mode}</span></td>
                <td style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.lastSync}</td>
                <td><span className={`v-badge v-badge-${m.status}`}>{m.status === 'success' ? '成功' : '警告'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QualityView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {QUALITY_METRICS.map((q) => (
          <div key={q.label} className="v-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{q.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: q.level === 'good' ? 'var(--success)' : 'var(--warning)' }}>{q.value}</div>
            <div style={{ height: 4, background: 'var(--muted)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: q.width, background: q.level === 'good' ? 'var(--success)' : 'var(--warning)' }} />
            </div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--muted-foreground)' }}>最近质量检查记录</div>
        <div className="v-card">
          <table className="v-table">
            <thead>
              <tr><th>时间</th><th>检查规则</th><th>数据源</th><th>维度</th><th>得分</th><th>状态</th><th>异常数</th></tr>
            </thead>
            <tbody>
              {QC_RECORDS.map((r, i) => (
                <tr key={i}>
                  <td><span className="v-meta">{r.time}</span></td>
                  <td><span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{r.rule}</span></td>
                  <td>{r.source}</td>
                  <td>{r.dim}</td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: badgeColor(r.scoreColor) }}>{r.score}</span></td>
                  <td><span className={`v-badge v-badge-${r.statusType}`}>{r.status}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.anomalies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LakeView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="v-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>数据湖表（Hudi / Iceberg）</div>
        <table className="v-table">
          <thead>
            <tr><th>表名</th><th>格式</th><th>容量</th><th>同步方式</th><th>操作</th></tr>
          </thead>
          <tbody>
            {LAKE_TABLES.map((t, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.name}</td>
                <td style={{ fontSize: 12 }}>{t.format}</td>
                <td style={{ fontSize: 12 }}>{t.meta}</td>
                <td><span className={`v-badge v-badge-${t.badgeType}`}>{t.badge}</span></td>
                <td>
                  <button style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} title="查看详情">
                    <Settings2 style={{ width: 14, height: 14 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function SubErrorFallback({ name }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--destructive)' }}>
      <AlertCircle style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>该模块加载失败: {name}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>请刷新页面或联系管理员</div>
    </div>
  );
}


