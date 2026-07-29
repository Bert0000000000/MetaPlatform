import React, { useState, useEffect } from 'react';
import {
  Radio, Plus, Search, RefreshCw, Play, Pause, CheckCircle2, XCircle,
  Loader2, AlertCircle, Activity, Database, ArrowRight, Clock,
} from 'lucide-react';
import {
  listCDCTasks, createCDCTask, pauseCDCTask, resumeCDCTask, getCDCTaskStatus,
  CDCTask, SourceType, BigDataSource,
} from '../../../api/ontology-bigdata';
import { listBigDataSources } from '../../../api/ontology-bigdata';

const STATUS_META = {
  RUNNING:      { label: '运行中',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  SNAPSHOTTING: { label: '快照中',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: Activity },
  PAUSED:       { label: '已暂停',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Pause },
  FAILED:       { label: '失败',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: AlertCircle },
  PENDING:      { label: '待启动',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Clock },
  STOPPED:      { label: '已停止',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: XCircle },
};

const SYNC_MODE_META = {
  FULL_INCREMENTAL: '全量+增量',
  INCREMENTAL_ONLY: '仅增量',
  SNAPSHOT_ONLY: '仅快照',
};

export default function CDCView() {
  const [tasks, setTasks] = useState<CDCTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [taskData, sourceData] = await Promise.all([
        listCDCTasks(),
        listBigDataSources(),
      ]);
      setTasks(Array.isArray(taskData) ? taskData : (taskData?.items || []));
      setSources(Array.isArray(sourceData) ? sourceData : (sourceData?.items || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePause = async (id) => {
    setActionLoading(id);
    try { await pauseCDCTask(id); await load(); } finally { setActionLoading(null); }
  };

  const handleResume = async (id) => {
    setActionLoading(id);
    try { await resumeCDCTask(id); await load(); } finally { setActionLoading(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>
          监控源数据库到目标存储的实时变更同步
        </div>
        <button onClick={() => load()} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw style={{ width: 14, height: 14 }} />刷新
        </button>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建 CDC 任务
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总任务数', value: tasks.length, color: 'var(--foreground)', icon: Radio },
          { label: '运行中', value: tasks.filter(t => t.status === 'RUNNING').length, color: '#10b981', icon: Activity },
          { label: '已暂停', value: tasks.filter(t => t.status === 'PAUSED').length, color: '#94a3b8', icon: Pause },
          { label: '失败', value: tasks.filter(t => t.status === 'FAILED').length, color: '#ef4444', icon: AlertCircle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: s.color + '20', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Cards */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <Loader2 className="v-spin" style={{ width: 20, height: 20, display: 'inline-block', marginRight: 8 }} />
          加载中...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
          {tasks.map((t) => {
            const sm = STATUS_META[t.status] || STATUS_META.PENDING;
            const SmIcon = sm.icon;
            const sourceName = sources.find(s => s.sourceId === t.sourceId)?.name || t.sourceId;
            return (
              <div key={t.taskId} className="v-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Radio style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                    </div>
                    <span className="v-badge" style={{ background: sm.bg, color: sm.color, fontSize: 11 }}>
                      <SmIcon style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
                      {sm.label}
                    </span>
                    <span className="v-badge" style={{ marginLeft: 6, background: 'var(--accent)', color: 'var(--accent-foreground)', fontSize: 11 }}>
                      {SYNC_MODE_META[t.syncMode] || t.syncMode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.status === 'RUNNING' && (
                      <button onClick={() => handlePause(t.taskId)} disabled={actionLoading === t.taskId} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} title="暂停">
                        {actionLoading === t.taskId ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Pause style={{ width: 14, height: 14, color: 'var(--warning)' }} />}
                      </button>
                    )}
                    {t.status === 'PAUSED' && (
                      <button onClick={() => handleResume(t.taskId)} disabled={actionLoading === t.taskId} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} title="恢复">
                        {actionLoading === t.taskId ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14, color: 'var(--success)' }} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Data flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, background: 'var(--muted)', borderRadius: 6, marginBottom: 12, fontSize: 11 }}>
                  <Database style={{ width: 12, height: 12 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourceName}</span>
                  <ArrowRight style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.targetType} / {t.targetName}</span>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
                  <div>
                    <div style={{ color: 'var(--muted-foreground)' }}>总记录数</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{t.totalRecords.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted-foreground)' }}>延迟 (ms)</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: t.lagMs < 1000 ? 'var(--success)' : t.lagMs < 5000 ? 'var(--warning)' : 'var(--destructive)' }}>{t.lagMs}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted-foreground)' }}>并发度</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{t.concurrency}</div>
                  </div>
                </div>

                {t.errorMessage && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.08)', borderRadius: 4, fontSize: 11, color: 'var(--destructive)' }}>
                    <AlertCircle style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                    {t.errorMessage}
                  </div>
                )}

                {/* Tables */}
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  同步表: {t.tables.map(tb => tb.tableName).join(', ')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateCDCDialog sources={sources} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateCDCDialog({ sources, onClose, onSuccess }) {
  const [form, setForm] = useState({
    syncMode: 'FULL_INCREMENTAL',
    startPosition: 'LATEST',
    targetType: 'KAFKA',
    schemaEvolution: 'ADD_NEW_COLUMNS',
    concurrency: 1,
    batchSize: 1000,
    retryCount: 3,
    retryInterval: 60,
    tables: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.sourceId || !form.targetName) {
      alert('请填写名称、源数据源、目标');
      return;
    }
    setSubmitting(true);
    try { await createCDCTask(form); onSuccess(); } finally { setSubmitting(false); }
  };

  // 过滤只显示关系型数据源
  const relationSources = sources.filter(s => ['HIVE', 'CLICKHOUSE', 'DORIS', 'STARROCKS'].includes(s.sourceType) && s.status === 'ACTIVE');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="v-card" style={{ width: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>新建 CDC 任务</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="任务名 *" required>
            <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle2} />
          </FormField>
          <FormField label="源数据源 *" required>
            <select value={form.sourceId || ''} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} style={inputStyle2}>
              <option value="">请选择</option>
              {relationSources.map(s => <option key={s.sourceId} value={s.sourceId}>{s.name} ({s.sourceType})</option>)}
            </select>
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>仅显示关系型数据源</div>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="同步模式 *" required>
              <select value={form.syncMode} onChange={(e) => setForm({ ...form, syncMode: e.target.value })} style={inputStyle2}>
                <option value="FULL_INCREMENTAL">全量+增量</option>
                <option value="INCREMENTAL_ONLY">仅增量</option>
                <option value="SNAPSHOT_ONLY">仅快照</option>
              </select>
            </FormField>
            <FormField label="起始位点">
              <select value={form.startPosition} onChange={(e) => setForm({ ...form, startPosition: e.target.value })} style={inputStyle2}>
                <option value="LATEST">最新位置</option>
                <option value="CURRENT_TIMESTAMP">当前时间</option>
                <option value="CUSTOM">自定义</option>
              </select>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <FormField label="目标类型 *" required>
              <select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })} style={inputStyle2}>
                <option value="KAFKA">Kafka</option>
                <option value="CLICKHOUSE">ClickHouse</option>
                <option value="HUDI">Hudi</option>
                <option value="ICEBERG">Iceberg</option>
              </select>
            </FormField>
            <FormField label="目标名称 *" required>
              <input value={form.targetName || ''} onChange={(e) => setForm({ ...form, targetName: e.target.value })} style={inputStyle2} placeholder="topic_or_table_name" />
            </FormField>
          </div>
          <FormField label="同步表（逗号分隔）">
            <input
              value={(form.tables || []).map(t => t.tableName).join(',')}
              onChange={(e) => setForm({ ...form, tables: e.target.value.split(',').filter(Boolean).map(t => ({ tableName: t.trim() })) })}
              style={inputStyle2}
              placeholder="users, orders, products"
            />
          </FormField>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: 'pointer' }}>取消</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle2 = {
  width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--background)', color: 'var(--foreground)', fontSize: 13,
};

function FormField({ label, children, required }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
