import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, RefreshCw, GitBranch, Plus, Activity, PlugZap, Layers,
  ShieldCheck, Database, Globe, Radio, HardDrive, Settings2, MoreHorizontal,
  Pause,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

const ONTOLOGY_TABS = [
  { label: '本体论管理', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

// MOCK: 数据源连接列表
const DATA_SOURCES = [
  { id: 'ds-1', name: 'PostgreSQL-主库', host: 'metaplatform-db.cluster.local:5432', type: 'PostgreSQL', icon: Database, status: 'online', statusText: '已连接', lastSync: '2026-07-22 10:30', size: '3.2 GB', actions: ['settings', 'refresh', 'more'] },
  { id: 'ds-2', name: 'MySQL-业务库', host: 'mysql-biz.cluster.local:3306', type: 'MySQL', icon: Database, status: 'online', statusText: '已连接', lastSync: '2026-07-22 10:28', size: '2.1 GB', actions: ['settings', 'refresh', 'more'] },
  { id: 'ds-3', name: 'REST API-外部', host: 'api.external-partner.com/v2', type: 'API', icon: Globe, status: 'online', statusText: '已连接', lastSync: '2026-07-22 10:25', size: '1.4 GB', actions: ['settings', 'refresh', 'more'] },
  { id: 'ds-4', name: 'Kafka-消息流', host: 'kafka.metaplatform.local:9092', type: 'Kafka', icon: Radio, status: 'syncing', statusText: '同步中', lastSync: '2026-07-22 10:32', size: '2.8 GB', actions: ['settings', 'pause', 'more'] },
  { id: 'ds-5', name: 'MinIO-对象存储', host: 'minio.metaplatform.local:9000', type: 'MinIO', icon: HardDrive, status: 'online', statusText: '已连接', lastSync: '2026-07-22 09:15', size: '1.9 GB', actions: ['settings', 'refresh', 'more'] },
  { id: 'ds-6', name: 'GraphQL-旧系统', host: 'legacy-internal.corp.local/graphql', type: 'API', icon: Globe, status: 'offline', statusText: '连接失败', lastSync: '2026-07-21 18:45', size: '1.2 GB', actions: ['settings', 'refresh', 'more'] },
];

// MOCK: 数据湖详情
const LAKE_TABLES = [
  { name: 'mate_ontology.entities', format: 'Hudi / COW', meta: '12.4 GB · 2.1M rows', badge: 'CDC 活跃', badgeType: 'success' },
  { name: 'mate_ontology.relations', format: 'Hudi / COW', meta: '8.7 GB · 5.8M rows', badge: 'CDC 活跃', badgeType: 'success' },
  { name: 'mate_audit.event_log', format: 'Hudi / MOR', meta: '9.2 GB · 18.3M rows', badge: 'CDC 活跃', badgeType: 'success' },
  { name: 'mate_warehouse.dim_*', format: 'Hudi / COW', meta: '5.6 GB · 0.9M rows', badge: '批量', badgeType: 'neutral' },
  { name: 'mate_warehouse.dwd_*', format: 'Hudi / MOR', meta: '3.2 GB · 4.2M rows', badge: '批量', badgeType: 'neutral' },
  { name: 'ext_partner.raw_data', format: 'Iceberg', meta: '5.1 GB · 3.4M rows', badge: '追加', badgeType: 'neutral' },
  { name: 'ext_archive.legacy_dump', format: 'Iceberg', meta: '3.1 GB · 1.6M rows', badge: '追加', badgeType: 'neutral' },
];

// MOCK: 数据质量指标
const QUALITY_METRICS = [
  { label: '完整率', value: '99.1%', level: 'good', width: '99.1%' },
  { label: '准确率', value: '98.7%', level: 'good', width: '98.7%' },
  { label: '一致性', value: '97.8%', level: 'fair', width: '97.8%' },
  { label: '及时率', value: '99.5%', level: 'good', width: '99.5%' },
  { label: '唯一性', value: '99.9%', level: 'good', width: '99.9%' },
  { label: '有效性', value: '98.2%', level: 'good', width: '98.2%' },
];

// MOCK: 质量检查记录
const QC_RECORDS = [
  { time: '2026-07-22 10:00', rule: 'null_field_check', source: 'PostgreSQL-主库', dim: '完整率', score: '99.1%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 18 },
  { time: '2026-07-22 10:00', rule: 'fk_referential_check', source: 'PostgreSQL-主库', dim: '一致性', score: '97.8%', scoreColor: 'warning', status: '告警', statusType: 'warning', anomalies: 142 },
  { time: '2026-07-22 09:30', rule: 'duplicate_key_check', source: 'MySQL-业务库', dim: '唯一性', score: '99.9%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 2 },
  { time: '2026-07-22 09:30', rule: 'format_pattern_check', source: 'REST API-外部', dim: '有效性', score: '98.2%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 67 },
  { time: '2026-07-22 09:00', rule: 'sla_timeliness_check', source: 'Kafka-消息流', dim: '及时率', score: '99.5%', scoreColor: 'success', status: '通过', statusType: 'success', anomalies: 8 },
];

const badgeColor = (type: string) =>
  type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : type === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)';

export default function OntologyDatacenterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>数据中心</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>数据源管理、数据湖监控与数据质量治理</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(98,209,120,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>AI</div>
            <span style={{ fontSize: 13 }}>AI 助手</span>
            <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          </button>
          <button className="v-btn"><RefreshCw style={{ width: 16, height: 16 }} />全量同步</button>
          <button className="v-btn"><GitBranch style={{ width: 16, height: 16 }} />血缘分析</button>
          <button className="v-btn-primary"><Plus style={{ width: 16, height: 16 }} />接入数据源</button>
        </div>
      </div>

      {/* Section 1: 数据源概览 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />数据源概览
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div className="v-card">
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>数据源总数</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>8</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>较上周 <span style={{ color: 'var(--success)' }}>+2</span></div>
          </div>
          <div className="v-card">
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>实时同步</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>3</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>Kafka / CDC / API</div>
          </div>
          <div className="v-card">
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>数据量</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>12.6<span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 2 }}>GB</span></div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>较昨日 <span style={{ color: 'var(--success)' }}>+0.8GB</span></div>
          </div>
          <div className="v-card">
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>同步成功率</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--success)' }}>99.2<span style={{ fontSize: 16, fontWeight: 400 }}>%</span></div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>最近 24h，32 次同步任务</div>
          </div>
        </div>
      </div>

      {/* Section 2: 数据源连接 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlugZap style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />数据源连接
        </div>
        <table className="v-table">
          <thead>
            <tr>
              <th>名称</th><th>类型</th><th>状态</th><th>最后同步</th><th>数据量</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((ds) => (
              <tr key={ds.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ds.icon style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{ds.name}</div>
                      <div className="v-meta">{ds.host}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 8px', borderRadius: 'var(--radius)' }}>
                    <ds.icon style={{ width: 12, height: 12 }} /> {ds.type}
                  </span>
                </td>
                <td>
                  <span className={`v-badge v-badge-${ds.status === 'online' ? 'success' : ds.status === 'syncing' ? 'warning' : 'error'}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', marginRight: 6, background: ds.status === 'online' ? 'var(--success)' : ds.status === 'syncing' ? 'var(--warning)' : 'var(--destructive)' }} />
                    {ds.statusText}
                  </span>
                </td>
                <td><span className="v-meta">{ds.lastSync}</span></td>
                <td><span style={{ fontSize: 13, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>{ds.size}</span></td>
                <td>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><Settings2 style={{ width: 16, height: 16 }} /></button>
                  {ds.actions[1] === 'pause' ? (
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><Pause style={{ width: 16, height: 16 }} /></button>
                  ) : (
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><RefreshCw style={{ width: 16, height: 16 }} /></button>
                  )}
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><MoreHorizontal style={{ width: 16, height: 16 }} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section 3: 数据湖概览 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />数据湖概览
        </div>
        <div className="v-card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hudi 表</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>5</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>主格式 / CDC upsert</div>
            </div>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Iceberg 表</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>2</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>备格式 / 追加写入</div>
            </div>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>总存储</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>47.3<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 2 }}>GB</span></div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Hudi 39.1GB / Iceberg 8.2GB</div>
            </div>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CDC 任务</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--warning)' }}>3<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 4 }}>运行中</span></div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Flink + Debezium</div>
            </div>
          </div>
          <div>
            {LAKE_TABLES.map((t, i) => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 0', borderBottom: i === LAKE_TABLES.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)', minWidth: 140 }}>{t.name}</div>
                <div style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>{t.format}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.meta}
                  <span className={`v-badge v-badge-${t.badgeType}`} style={{ fontSize: 11 }}>{t.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 4: 数据质量面板 */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />数据质量面板
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
          {QUALITY_METRICS.map((q) => (
            <div key={q.label} className="v-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{q.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: q.level === 'good' ? 'var(--success)' : 'var(--warning)' }}>{q.value}</div>
              <div style={{ height: 4, background: 'var(--muted)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: q.width, background: q.level === 'good' ? 'var(--success)' : 'var(--warning)' }} />
              </div>
            </div>
          ))}
        </div>
        {/* Quality Check Records */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--muted-foreground)' }}>最近质量检查记录</div>
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
