import React, { useState, useEffect } from 'react';
import {
  Database, Plus, RefreshCw, Play, Square, CheckCircle2, AlertCircle,
  Loader2, Activity, Clock, Sparkles,
} from 'lucide-react';
import {
  listETLTasks, runETLTask, stopETLTask, createETLTask,
  ETLTask, ETLMode, ETLPriority, ETLStatus, ETLTriggerType, BigDataSource, ETL_MODE_META,
} from '../../../api/ontology-bigdata';
import { Toast, Card, Tag, Table } from '@douyinfe/semi-ui';
import { listBigDataSources } from '../../../api/ontology-bigdata';
import { formatDuration, formatNumber, formatTimestamp } from './common';
import { IconSetting } from '@douyinfe/semi-icons';

const STATUS_META = {
  SUCCESS:   { label: '成功',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  RUNNING:   { label: '运行中', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: Loader2 },
  FAILED:    { label: '失败',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: AlertCircle },
  READY:     { label: '就绪',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Activity },
  DRAFT:     { label: '草稿',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Clock },
  CANCELLED: { label: '已取消', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: Square },
  TIMEOUT:   { label: '超时',   color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   icon: Clock },
};

const PRIORITY_META = {
  LOW:    { label: '低',   color: '#94a3b8' },
  NORMAL: { label: '中',   color: '#3b82f6' },
  HIGH:   { label: '高',   color: '#f59e0b' },
  URGENT: { label: '紧急', color: '#ef4444' },
};

export default function ETLView() {
  const [tasks, setTasks] = useState<ETLTask[]>([]);
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [taskData, sourceData] = await Promise.all([listETLTasks(), listBigDataSources()]);
      setTasks(taskData);
      setSources(sourceData);
    } catch (e) {
      console.warn('ETL 任务加载失败', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRun = async (id: string) => {
    setActionLoading(id);
    try { await runETLTask(id); await load(); } finally { setActionLoading(null); }
  };

  const handleStop = async (id: string) => {
    if (!confirm('确认停止此 ETL 任务？')) return;
    setActionLoading(id);
    try { await stopETLTask(id); await load(); } finally { setActionLoading(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>
          大数据 ETL 任务，支持 Spark/Flink 批流处理
        </div>
        <button onClick={() => load()} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw style={{ width: 14, height: 14 }} />刷新
        </button>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建 ETL 任务
        </button>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总任务', value: tasks.length, color: 'var(--foreground)' },
          { label: '运行中', value: tasks.filter(t => t.status === 'RUNNING').length, color: '#3b82f6' },
          { label: '成功', value: tasks.filter(t => t.status === 'SUCCESS').length, color: '#10b981' },
          { label: '失败', value: tasks.filter(t => t.status === 'FAILED').length, color: '#ef4444' },
        ].map(s => (
          <Card key={s.label}  style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <Loader2 className="v-spin" style={{ width: 20, height: 20, display: 'inline-block', marginRight: 8 }} />
          加载中...
        </div>
      ) : (
        <Card>
          <Table
            rowKey="taskId"
            dataSource={tasks}
            pagination={false}
            columns={[
              {
                title: '任务名', dataIndex: 'name',
                render: (_v: string, r: ETLTask) => {
                  const mm = ETL_MODE_META[r.mode] || { label: r.mode, color: '#666', icon: <IconSetting size="small" /> };
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 32,
                        height: 22,
                        padding: '0 6px',
                        borderRadius: 4,
                        background: mm.color + '20',
                        color: mm.color,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}>{mm.icon}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{r.name}</div>
                        {r.description && <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.description}</div>}
                      </div>
                    </div>
                  );
                },
              },
              {
                title: '模式', dataIndex: 'mode',
                render: (v: ETLMode) => {
                  const mm = ETL_MODE_META[v] || { label: v, color: '#666', icon: <IconSetting size="small" /> };
                  return <Tag style={{ background: mm.color + '20', color: mm.color }}>{mm.label}</Tag>;
                },
              },
              {
                title: '优先级', dataIndex: 'priority',
                render: (v: ETLPriority) => {
                  const pm = PRIORITY_META[v] || PRIORITY_META.NORMAL;
                  return <span style={{ color: pm.color, fontSize: 12, fontWeight: 600 }}>{pm.label}</span>;
                },
              },
              { title: '源', dataIndex: 'sourceIds', render: (v: string[]) => <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{(v || []).length} 个</span> },
              { title: '目标', dataIndex: 'targetTable', render: (_v: string, r: ETLTask) => <span style={{ fontSize: 12 }}>{r.targetType}/{r.targetTable}</span> },
              {
                title: '状态', dataIndex: 'status',
                render: (v: ETLStatus) => {
                  const sm = STATUS_META[v] || STATUS_META.READY;
                  const SmIcon = sm.icon;
                  return (
                    <Tag style={{ background: sm.bg, color: sm.color, fontSize: 11 }}>
                      <SmIcon style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} className={v === 'RUNNING' ? 'v-spin' : ''} />
                      {sm.label}
                    </Tag>
                  );
                },
              },
              { title: '耗时', dataIndex: 'lastRunDuration', render: (v?: number) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v ? formatDuration(v) : '-'}</span> },
              { title: '总处理', dataIndex: 'totalProcessed', render: (v?: number) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatNumber(v || 0)}</span> },
              {
                title: '操作', dataIndex: 'taskId',
                render: (id: string, r: ETLTask) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {r.status === 'RUNNING' ? (
                      <button onClick={() => handleStop(id)} disabled={actionLoading === id} title="停止" style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--destructive)' }}>
                        {actionLoading === id ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Square style={{ width: 14, height: 14 }} />}
                      </button>
                    ) : (
                      <button onClick={() => handleRun(id)} disabled={actionLoading === id} title="运行" style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--success)' }}>
                        {actionLoading === id ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {showCreate && <CreateETLDialog sources={sources} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateETLDialog({ sources, onClose, onSuccess }: { sources: BigDataSource[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<Partial<ETLTask>>({
    mode: 'BATCH_SPARK', priority: 'NORMAL', triggerType: 'MANUAL', writeMode: 'APPEND',
    targetType: 'CLICKHOUSE', executorNum: 2, executorMemory: 4, driverMemory: 2, queue: 'default',
    retryCount: 3, timeout: 3600, alertOnFailure: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.targetSourceId || !form.targetTable) {
      Toast.warning('请填写任务名、目标源、目标表');
      return;
    }
    setSubmitting(true);
    try { await createETLTask(form); onSuccess(); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--semi-color-overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <Card style={{ width: 600, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>新建 ETL 任务</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FF label="任务名 *" required>
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={is3} />
            </FF>
            <FF label="执行模式 *" required>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as ETLMode })} style={is3}>
                {Object.entries(ETL_MODE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </FF>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FF label="优先级">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ETLPriority })} style={is3}>
                <option value="LOW">低</option><option value="NORMAL">中</option><option value="HIGH">高</option><option value="URGENT">紧急</option>
              </select>
            </FF>
            <FF label="触发方式">
              <select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value as ETLTriggerType })} style={is3}>
                <option value="MANUAL">手动</option><option value="SCHEDULED">定时</option><option value="EVENT">事件</option>
              </select>
            </FF>
          </div>
          <FF label="目标数据源 *" required>
            <select value={form.targetSourceId || ''} onChange={(e) => setForm({ ...form, targetSourceId: e.target.value })} style={is3}>
              <option value="">请选择</option>
              {sources.map(s => <option key={s.sourceId} value={s.sourceId}>{s.name} ({s.sourceType})</option>)}
            </select>
          </FF>
          <FF label="目标表 *" required>
            <input value={form.targetTable || ''} onChange={(e) => setForm({ ...form, targetTable: e.target.value })} style={is3} placeholder="schema.table_name" />
          </FF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FF label="Executor 数"><input type="number" value={form.executorNum || ''} onChange={(e) => setForm({ ...form, executorNum: parseInt(e.target.value) })} style={is3} /></FF>
            <FF label="Executor 内存(GB)"><input type="number" value={form.executorMemory || ''} onChange={(e) => setForm({ ...form, executorMemory: parseInt(e.target.value) })} style={is3} /></FF>
            <FF label="Driver 内存(GB)"><input type="number" value={form.driverMemory || ''} onChange={(e) => setForm({ ...form, driverMemory: parseInt(e.target.value) })} style={is3} /></FF>
          </div>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: 'pointer' }}>取消</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>{submitting ? '创建中...' : '创建'}</button>
        </div>
      </Card>
    </div>
  );
}

const is3 = { width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 };

function FF({ label, children, required = false }: { label: React.ReactNode; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
