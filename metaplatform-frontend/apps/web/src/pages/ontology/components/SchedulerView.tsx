import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, RefreshCw, Play, Pause, CheckCircle2, XCircle,
  Loader2, Clock, ArrowRight, GitBranch, Bell,
} from 'lucide-react';
import {
  listSchedulerTasks, triggerScheduler, pauseScheduler, resumeScheduler,
  SchedulerTask,
} from '../../../api/ontology-bigdata';
import { formatTimestamp } from './common';

const TYPE_META = {
  ETL_TASK:       { label: 'ETL 任务',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: ArrowRight },
  CDC_TASK:       { label: 'CDC 任务',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  icon: ArrowRight },
  QUALITY_CHECK:  { label: '质量检查',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  CUSTOM_ACTION:  { label: '自定义',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Bell },
};

const TRIGGER_META = {
  CRON:       { label: '定时',  icon: Clock },
  EVENT:      { label: '事件',  icon: Bell },
  MANUAL:     { label: '手动',  icon: Play },
  DEPENDENCY: { label: '依赖',  icon: GitBranch },
};

const STATUS_META = {
  ACTIVE:   { label: '运行中', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  PAUSED:   { label: '已暂停', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Pause },
  EXPIRED:  { label: '已过期', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: Clock },
  DELETED:  { label: '已删除', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle },
};

export default function SchedulerView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listSchedulerTasks();
      setTasks(Array.isArray(data) ? data : (data?.items || []));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleTrigger = async (id) => {
    setActionLoading(id);
    try { await triggerScheduler(id); await load(); } finally { setActionLoading(null); }
  };

  const handlePause = async (id) => {
    setActionLoading(id);
    try { await pauseScheduler(id); await load(); } finally { setActionLoading(null); }
  };

  const handleResume = async (id) => {
    setActionLoading(id);
    try { await resumeScheduler(id); await load(); } finally { setActionLoading(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted-foreground)' }}>
          统一任务调度中心：CRON/事件/依赖 多种触发方式
        </div>
        <button onClick={() => load()} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw style={{ width: 14, height: 14 }} />刷新
        </button>
        <button onClick={() => alert('新建调度功能待 P3 补全')} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />新建调度
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总调度', value: tasks.length, color: 'var(--foreground)' },
          { label: '运行中', value: tasks.filter(t => t.status === 'ACTIVE').length, color: '#10b981' },
          { label: '已暂停', value: tasks.filter(t => t.status === 'PAUSED').length, color: '#94a3b8' },
          { label: '总触发', value: tasks.reduce((s, t) => s + (t.totalTriggers || 0), 0), color: '#3b82f6' },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
          {tasks.map((t) => {
            const sm = STATUS_META[t.status] || STATUS_META.ACTIVE;
            const SmIcon = sm.icon;
            const tm = TYPE_META[t.taskType] || TYPE_META.CUSTOM_ACTION;
            const TMIcon = tm.icon;
            const trm = TRIGGER_META[t.triggerType] || TRIGGER_META.MANUAL;
            const TrIcon = trm.icon;
            return (
              <div key={t.schedulerId} className="v-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Calendar style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className="v-badge" style={{ background: tm.bg, color: tm.color, fontSize: 10 }}>
                        <TMIcon style={{ width: 9, height: 9, display: 'inline', marginRight: 3 }} />{tm.label}
                      </span>
                      <span className="v-badge" style={{ background: sm.bg, color: sm.color, fontSize: 10 }}>
                        <SmIcon style={{ width: 9, height: 9, display: 'inline', marginRight: 3 }} />{sm.label}
                      </span>
                      <span className="v-badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 10 }}>
                        <TrIcon style={{ width: 9, height: 9, display: 'inline', marginRight: 3 }} />{trm.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.status === 'ACTIVE' ? (
                      <button onClick={() => handlePause(t.schedulerId)} disabled={actionLoading === t.schedulerId} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} title="暂停">
                        {actionLoading === t.schedulerId ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Pause style={{ width: 14, height: 14, color: 'var(--warning)' }} />}
                      </button>
                    ) : (
                      <button onClick={() => handleResume(t.schedulerId)} disabled={actionLoading === t.schedulerId} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} title="恢复">
                        {actionLoading === t.schedulerId ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14, color: 'var(--success)' }} />}
                      </button>
                    )}
                    <button onClick={() => handleTrigger(t.schedulerId)} disabled={actionLoading === t.schedulerId} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} title="立即触发">
                      {actionLoading === t.schedulerId ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14, color: 'var(--primary)' }} />}
                    </button>
                  </div>
                </div>

                {t.cron && (
                  <div style={{ padding: 8, background: 'var(--muted)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 8 }}>
                    {t.cron}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                  <div>
                    <div style={{ color: 'var(--muted-foreground)' }}>总触发</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{t.totalTriggers || 0}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted-foreground)' }}>成功</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#10b981' }}>{t.totalSuccess || 0}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted-foreground)' }}>失败</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#ef4444' }}>{t.totalFailure || 0}</div>
                  </div>
                </div>

                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>上次: {formatTimestamp(t.lastTriggerAt)}</span>
                  <span>下次: {formatTimestamp(t.nextTriggerAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
