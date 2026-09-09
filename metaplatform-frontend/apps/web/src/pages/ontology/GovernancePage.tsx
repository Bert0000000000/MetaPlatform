// GovernancePage - 治理面（ONT-UI-04，Palantir Ontology Manager Usage/History/Cleanup 对位）。
//
// 三个区块：
//   1. 类型使用量（GET /usage/types）—— Reads/Writes/ActiveDays + 生命周期操作
//      （deprecate/delete，带使用量删除保护的 409 提示）
//   2. 反模式 lint（GET /lint/anti-patterns）—— god_object / kitchen_sink /
//      misnomer / action_sprawl
//   3. 执行历史（GET /action-audit）—— actor/时间/结果/审计链倒序

import { useCallback, useEffect, useState } from 'react';
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { AlertTriangle, BarChart3, History, Loader2, ShieldAlert } from 'lucide-react';
import {
  applyLifecycle, getUsageSummary, lintAntiPatterns, listActionAudit,
  type ActionAuditRow, type LintFinding, type UsageRow,
} from '@/api/ont/kernel';

const PATTERN_LABEL: Record<string, string> = {
  god_object: '上帝对象',
  kitchen_sink: '大杂烩',
  misnomer: '误名',
  action_sprawl: 'Action 蔓延',
};

const PATTERN_COLOR: Record<string, 'red' | 'orange' | 'yellow'> = {
  god_object: 'red',
  kitchen_sink: 'orange',
  misnomer: 'yellow',
  action_sprawl: 'orange',
};

export default function GovernancePage() {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [lint, setLint] = useState<LintFinding[]>([]);
  const [audit, setAudit] = useState<ActionAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, l, a] = await Promise.all([
        getUsageSummary(30).catch(() => [] as UsageRow[]),
        lintAntiPatterns().catch(() => [] as LintFinding[]),
        listActionAudit(50).catch(() => [] as ActionAuditRow[]),
      ]);
      setUsage(u);
      setLint(l);
      setAudit(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const doLifecycle = async (rid: string, action: 'deprecate' | 'delete') => {
    if (action === 'delete' && !window.confirm(
      `删除类型 ${rid}？（有近 30 天读量的类型会被拒绝）`)) return;
    setMsg('');
    try {
      await applyLifecycle(rid, action);
      setMsg(`${action} 成功：${rid}`);
      void refresh();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setMsg(detail ?? e instanceof Error ? String(e) : `${action} 失败`);
    }
  };

  const usageCols: ColumnProps<UsageRow>[] = [
    { title: '类型', dataIndex: 'class_rid', render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>) },
    { title: '读（30d）', dataIndex: 'reads', width: 100 },
    { title: '写（30d）', dataIndex: 'writes', width: 100 },
    { title: '活跃天数', dataIndex: 'active_days', width: 90 },
    { title: '', dataIndex: '__ops', width: 170, render: (_: unknown, row: UsageRow) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => void doLifecycle(row.class_rid, 'deprecate')} style={{
          padding: '2px 10px', fontSize: 12, borderRadius: 4,
          border: '1px solid var(--border)', background: 'var(--card)',
          color: 'var(--foreground)', cursor: 'pointer',
        }}>废弃</button>
        <button type="button" onClick={() => void doLifecycle(row.class_rid, 'delete')} style={{
          padding: '2px 10px', fontSize: 12, borderRadius: 4,
          border: '1px solid var(--destructive)', background: 'transparent',
          color: 'var(--destructive)', cursor: 'pointer',
        }}>删除</button>
      </div>
    ) },
  ];

  const auditCols: ColumnProps<ActionAuditRow>[] = [
    { title: '时间', dataIndex: 'created_at', width: 170, render: (v: string) => (
      <span style={{ fontSize: 12 }}>{new Date(v).toLocaleString()}</span>) },
    { title: '动作', dataIndex: 'action_rid', render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span>) },
    { title: '执行者', dataIndex: 'actor_id', width: 110 },
    { title: '编辑数', dataIndex: 'result', width: 80, render: (v: Record<string, unknown>) => (
      <span>{String(v?.applied_count ?? '—')}</span>) },
    { title: '提案', dataIndex: 'proposal_id', render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span>) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && (
        <div style={{
          padding: '8px 14px', fontSize: 12, borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--card)',
          color: 'var(--foreground)',
        }}>{msg}</div>
      )}
      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 40, justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
          <Loader2 style={{ width: 14, height: 14, animation: 'osp-spin 1s linear infinite' }} /> 加载治理数据…
        </div>
      ) : (
        <>
          {/* 使用量 */}
          <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <BarChart3 style={{ width: 15, height: 15 }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>类型使用量（近 30 天）</h4>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>变更影响评估 · 退役决策</span>
            </div>
            <Table<UsageRow> columns={usageCols} dataSource={usage} rowKey="class_rid"
              pagination={{ pageSize: 10 }} size="small" empty="暂无使用量数据" />
          </Card>

          {/* 反模式 lint */}
          <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <ShieldAlert style={{ width: 15, height: 15, color: '#fbbf24' }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>反模式检查</h4>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {lint.length} 项发现（god_object / kitchen_sink / misnomer / action_sprawl）
              </span>
            </div>
            {lint.length === 0 ? (
              <div style={{ padding: 24, fontSize: 12, color: 'var(--muted-foreground)' }}>✓ 未发现反模式</div>
            ) : (
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lint.slice(0, 30).map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
                  }}>
                    <Tag size="small" color={PATTERN_COLOR[f.pattern] ?? 'grey'}>
                      {PATTERN_LABEL[f.pattern] ?? f.pattern}
                    </Tag>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{f.subject}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{f.detail}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>💡 {f.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 执行历史 */}
          <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <History style={{ width: 15, height: 15 }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Action 执行历史</h4>
            </div>
            <Table<ActionAuditRow> columns={auditCols} dataSource={audit} rowKey="audit_id"
              pagination={{ pageSize: 10 }} size="small" empty="暂无执行记录" />
          </Card>

          {!loading && usage.length === 0 && (
            <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--muted-foreground)', alignItems: 'center' }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              使用量在读写时自动打点（GET /individuals 按类读、apply-edit-set 写）
            </div>
          )}
        </>
      )}
    </div>
  );
}
