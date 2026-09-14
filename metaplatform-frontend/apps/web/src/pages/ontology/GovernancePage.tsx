// GovernancePage - 治理面（ONT-UI-04，Palantir Ontology Manager Usage/History/Cleanup 对位）。
//
// 五个区块：
//   1. 版本与导入导出（G41）—— 类型版本操作（branch / diff / rollback）+
//      Export/Import（JSON 下载 / 文件导入回灌）
//   2. 类型使用量（GET /usage/types）—— Reads/Writes/ActiveDays + 生命周期操作
//      （deprecate/delete，带使用量删除保护的 409 提示）
//   3. 反模式 lint（GET /lint/anti-patterns）—— god_object / kitchen_sink /
//      misnomer / action_sprawl
//   4. 执行历史（GET /action-audit）—— actor/时间/结果/审计链倒序
//   5. Agent 回归指标（GET /agent-metrics/*，ONT-AGENT-METRICS-01）—— AI
//      proposal 接受率基线 / 按天趋势 SVG / 按提议方聚合；独立加载，
//      接口失败仅本区块降级为「指标不可用」，不拖垮整页

import { useCallback, useEffect, useState, type CSSProperties, type ChangeEvent, type ReactElement } from 'react';
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { AlertTriangle, BarChart3, Bot, Download, GitBranch, GitCompare, History, Loader2, ShieldAlert, Undo2, Upload } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  applyLifecycle, branchObjectType, diffObjectTypes, exportObjectType,
  getUsageSummary, importObjectTypes, lintAntiPatterns, listActionAudit,
  listObjectTypes, rollbackObjectType, slugAndVersionOfObjectType,
  type ActionAuditRow, type KernelObjectType, type LintFinding, type UsageRow,
} from '@/api/ont/kernel';
import {
  getAgentMetricsSummary, getAgentMetricsTrend,
  type AgentMetricsSummary, type AgentMetricsTrendPoint,
} from '@/api/ont/agentMetrics';
import SchemaWipCard from './components/SchemaWipCard';
import SecurityPolicyCard from './components/SecurityPolicyCard';

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

/** G41：diff 结果 key 中文化（原样兜底）。 */
const DIFF_LABEL: Record<string, string> = {
  old_rid: '基准版本',
  new_rid: '对比版本',
  added: '新增属性',
  removed: '移除属性',
  changed: '变更属性',
  has_changes: '存在差异',
};

/** diff 数组值按 key 着色（新增绿 / 移除红 / 变更黄）。 */
const DIFF_VALUE_COLOR: Record<string, string> = {
  added: '#4ade80',
  removed: '#f87171',
  changed: '#fbbf24',
};

const verInputStyle: CSSProperties = {
  height: 32, minWidth: 0, flex: 1, boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0 10px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none',
  fontFamily: 'monospace',
};

const verBtnStyle: CSSProperties = {
  height: 32, padding: '0 14px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--foreground)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
};

/** 从 axios 错误中取 FastAPI detail（与页面既有 errText 口径一致）。 */
function verErrText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? (e instanceof Error ? e.message : fallback);
}

// ── Agent 回归指标（ONT-AGENT-METRICS-01）─────────────────────────────

/** 接受率格式化：null（分母 0，无已决策 proposal）→ '—'；否则百分比（1 位小数）。 */
function fmtAgentRate(rate: number | null | undefined): string {
  return typeof rate === 'number' && Number.isFinite(rate)
    ? `${(rate * 100).toFixed(1)}%`
    : '—';
}

/**
 * Agent 提案趋势迷你柱状图（纯 SVG 零第三方库；做法对齐 components/ChartSvg.tsx：
 * viewBox + width:100% 自适应、CSS 变量配色、<title> hover 精确值、首/中/尾 X 轴标签）。
 * 每日一根 proposed 总量柱（var(--primary)）+ 底部 executed 已采纳堆叠段
 * （var(--success)）。executed 日桶按 confirmed_at 锚定，极端时序下可能超过
 * 当日 proposed，柱高按截断渲染（<title> 仍显示真实值）。
 */
function AgentTrendChart({ points }: { points: AgentMetricsTrendPoint[] }): ReactElement {
  const W = 720;
  const H = 190;
  const padL = 38;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const els: ReactElement[] = [];

  if (points.length === 0) {
    els.push(
      <text key="ph" x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fill="var(--muted-foreground)">暂无数据</text>,
    );
  } else {
    const max = Math.max(...points.map((p) => Math.max(p.proposed, p.executed)), 0);
    if (max <= 0) {
      els.push(
        <text key="ph" x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={12} fill="var(--muted-foreground)">窗口内暂无提案</text>,
      );
    } else {
      // 横向网格 + 纵轴刻度
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const v = (max / ticks) * i;
        const y = padT + ih - (ih * i) / ticks;
        els.push(
          <line key={`grid${i}`} x1={padL} y1={y} x2={W - padR} y2={y}
            stroke="var(--border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 3'} />,
        );
        els.push(
          <text key={`tick${i}`} x={padL - 6} y={y} textAnchor="end" dominantBaseline="middle"
            fontSize={9} fill="var(--muted-foreground)">{Math.round(v)}</text>,
        );
      }
      // 柱：外层 proposed 总量（primary），底部叠 executed 已采纳段（success）
      const slot = iw / points.length;
      const barW = Math.min(slot * 0.7, 14);
      points.forEach((p, i) => {
        if (p.proposed <= 0) return;
        const title = `${p.date}：proposed ${p.proposed} · executed ${p.executed} · rejected ${p.rejected}`;
        const x = padL + slot * i + (slot - barW) / 2;
        const hTotal = (p.proposed / max) * ih;
        els.push(
          <rect key={`bar${i}`} x={x} y={padT + ih - hTotal} width={barW}
            height={Math.max(hTotal, 1)} fill="var(--primary)" rx={2}>
            <title>{title}</title>
          </rect>,
        );
        const ex = Math.min(p.executed, p.proposed);
        if (ex > 0) {
          const hEx = (ex / max) * ih;
          els.push(
            <rect key={`ex${i}`} x={x} y={padT + ih - hEx} width={barW}
              height={Math.max(hEx, 1)} fill="var(--success)">
              <title>{title}</title>
            </rect>,
          );
        }
      });
      // X 轴标签：首 / 中 / 尾（时间序，MM-DD）
      const labelIdx = points.length <= 2
        ? points.map((_, i) => i)
        : [0, Math.floor((points.length - 1) / 2), points.length - 1];
      labelIdx.forEach((i) => {
        els.push(
          <text key={`lab${i}`} x={padL + slot * i + slot / 2} y={padT + ih + 12}
            fontSize={9} fill="var(--muted-foreground)"
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
            {points[i].date.slice(5)}
          </text>,
        );
      });
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
      style={{ display: 'block' }} role="img">
      {els}
    </svg>
  );
}

export default function GovernancePage() {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [lint, setLint] = useState<LintFinding[]>([]);
  const [audit, setAudit] = useState<ActionAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  // ── G41：版本操作 + Export/Import ──
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [verRid, setVerRid] = useState('');               // 当前选中类型 rid
  const [branchRid, setBranchRid] = useState('');         // 分支新 rid
  const [diffBase, setDiffBase] = useState('');           // diff 基准 rid（默认跟选中）
  const [diffAgainst, setDiffAgainst] = useState('');     // diff 对比 rid（against）
  const [diffResult, setDiffResult] = useState<Record<string, unknown> | null>(null);
  const [rollbackFrom, setRollbackFrom] = useState('');   // 回滚来源 rid
  const [verBusy, setVerBusy] = useState('');             // 'branch' | 'diff' | 'rollback' | 'export' | 'import'
  const [verMsg, setVerMsg] = useState('');
  const [verErr, setVerErr] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null);
  // ── Agent 回归指标（ONT-AGENT-METRICS-01）：独立加载，失败仅本区块降级 ──
  const [agentDays, setAgentDays] = useState(30);
  const [agentSummary, setAgentSummary] = useState<AgentMetricsSummary | null>(null);
  const [agentTrend, setAgentTrend] = useState<AgentMetricsTrendPoint[]>([]);
  const [agentLoading, setAgentLoading] = useState(true);
  /** summary + trend 全部失败 → 区块整体「指标不可用」。 */
  const [agentDown, setAgentDown] = useState(false);

  const reloadTypes = useCallback(() => {
    listObjectTypes().then((ts) => {
      setTypes(ts);
      setVerRid((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : (ts[0]?.rid ?? '')));
      setDiffBase((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : (ts[0]?.rid ?? '')));
    }).catch(() => undefined);
  }, []);

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
      reloadTypes();
    } finally {
      setLoading(false);
    }
  }, [reloadTypes]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Agent 指标独立拉取（不进 refresh：窗口切换即时刷新，失败不拖垮整页）。
  useEffect(() => {
    let alive = true;
    setAgentLoading(true);
    setAgentDown(false);
    Promise.all([
      getAgentMetricsSummary(agentDays)
        .then((s) => ({ ok: true as const, s }))
        .catch(() => ({ ok: false as const })),
      getAgentMetricsTrend(agentDays)
        .then((t) => ({ ok: true as const, t }))
        .catch(() => ({ ok: false as const })),
    ]).then(([a, b]) => {
      if (!alive) return;
      if (!a.ok && !b.ok) {
        setAgentDown(true);
        setAgentSummary(null);
        setAgentTrend([]);
      } else {
        setAgentSummary(a.ok ? a.s : null);
        setAgentTrend(b.ok ? b.t : []);
      }
      setAgentLoading(false);
    });
    return () => { alive = false; };
  }, [agentDays]);

  /** 选中类型变化：diff 基准跟随当前选中（任务口径 from 默认当前选中）。 */
  const pickType = (rid: string) => {
    setVerRid(rid);
    setDiffBase(rid);
  };

  const doBranch = async () => {
    if (!verRid) { setVerErr('请先选择类型'); return; }
    if (!branchRid.trim()) { setVerErr('请填写分支新 rid（ont.<租户>.obj.<域>.<slug>.vN）'); return; }
    setVerBusy('branch'); setVerErr(''); setVerMsg('');
    try {
      const ot = await branchObjectType(verRid, branchRid.trim());
      setVerMsg(`分支创建成功：${ot.rid}（${ot.display_name}）`);
      toast('分支创建成功', 'success');
      setBranchRid('');
      reloadTypes();
    } catch (e) {
      setVerErr(verErrText(e, '创建分支失败'));
    } finally {
      setVerBusy('');
    }
  };

  const doDiff = async () => {
    const base = diffBase.trim() || verRid;
    const against = diffAgainst.trim();
    if (!base || !against) { setVerErr('对比差异需要基准 rid 与对比 rid'); return; }
    if (base === against) { setVerErr('基准与对比 rid 不能相同'); return; }
    setVerBusy('diff'); setVerErr(''); setVerMsg('');
    try {
      const d = await diffObjectTypes(base, against);
      setDiffResult(d);
    } catch (e) {
      setVerErr(verErrText(e, '对比差异失败'));
    } finally {
      setVerBusy('');
    }
  };

  const doRollback = async () => {
    if (!verRid) { setVerErr('请先选择类型'); return; }
    if (!rollbackFrom.trim()) { setVerErr('请填写回滚来源 rid（同族旧版本）'); return; }
    if (!window.confirm(`把 ${verRid} 的定义回滚为 ${rollbackFrom} 的内容？`)) return;
    setVerBusy('rollback'); setVerErr(''); setVerMsg('');
    try {
      const ot = await rollbackObjectType(verRid, rollbackFrom.trim());
      setVerMsg(`回滚成功：${ot.rid} 已恢复为 ${rollbackFrom.trim()} 的定义`);
      toast('回滚成功', 'success');
    } catch (e) {
      setVerErr(verErrText(e, '回滚失败'));
    } finally {
      setVerBusy('');
    }
  };

  const doExport = async () => {
    if (!verRid) { setVerErr('请先选择类型'); return; }
    setVerBusy('export'); setVerErr(''); setVerMsg('');
    try {
      const data = await exportObjectType(verRid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${verRid}.export.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setVerMsg(`已导出 ${verRid}（JSON-LD）`);
    } catch (e) {
      setVerErr(verErrText(e, '导出失败'));
    } finally {
      setVerBusy('');
    }
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!f) return;
    setVerBusy('import'); setVerErr(''); setVerMsg(''); setImportResult(null);
    try {
      const text = await f.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch (se) {
        setImportResult({ ok: false, text: `文件不是合法 JSON：${se instanceof Error ? se.message : String(se)}` });
        return;
      }
      const ot = await importObjectTypes(payload);
      setImportResult({ ok: true, text: `导入成功：${ot.rid}（${ot.display_name} · ${ot.properties.length} 属性）` });
      toast('导入成功', 'success');
      reloadTypes();
    } catch (er) {
      setImportResult({ ok: false, text: verErrText(er, '导入失败') });
    } finally {
      setVerBusy('');
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 0, width: '100%' }}>
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
          {/* 版本与导入导出（G41） */}
          <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <GitBranch style={{ width: 15, height: 15 }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>版本与导入导出</h4>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>类型版本分支 / 差异 / 回滚 · JSON 导出与导入</span>
            </div>
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 类型选择 */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>目标类型</span>
                <select
                  value={verRid}
                  onChange={(e) => pickType(e.target.value)}
                  style={{
                    ...verInputStyle, flex: 1, fontFamily: 'monospace', cursor: 'pointer',
                  }}
                >
                  {types.length === 0 && <option value="">（暂无类型）</option>}
                  {types.map((ot) => {
                    const sv = slugAndVersionOfObjectType(ot.rid);
                    return (
                      <option key={ot.rid} value={ot.rid}>
                        {ot.display_name || ot.rid}{sv.version ? `（${sv.version}）` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 类型版本操作 */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>类型版本操作</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="分支新 rid：ont.<租户>.obj.<域>.<slug>.vN"
                    value={branchRid}
                    onChange={(e) => setBranchRid(e.target.value)}
                    style={verInputStyle}
                  />
                  <button type="button" onClick={() => void doBranch()} disabled={verBusy === 'branch'} style={{ ...verBtnStyle, cursor: verBusy === 'branch' ? 'wait' : 'pointer' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <GitBranch style={{ width: 12, height: 12 }} />
                      {verBusy === 'branch' ? '创建中…' : '创建分支'}
                    </span>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="基准 rid（默认当前选中）"
                    value={diffBase}
                    onChange={(e) => setDiffBase(e.target.value)}
                    style={verInputStyle}
                  />
                  <input
                    type="text"
                    placeholder="对比 rid（against）"
                    value={diffAgainst}
                    onChange={(e) => setDiffAgainst(e.target.value)}
                    style={verInputStyle}
                  />
                  <button type="button" onClick={() => void doDiff()} disabled={verBusy === 'diff'} style={{ ...verBtnStyle, cursor: verBusy === 'diff' ? 'wait' : 'pointer' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <GitCompare style={{ width: 12, height: 12 }} />
                      {verBusy === 'diff' ? '对比中…' : '对比差异'}
                    </span>
                  </button>
                </div>
                {diffResult && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--card)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Diff 结果</div>
                    {Object.entries(diffResult).map(([k, val]) => (
                      <div key={k} style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 4, alignItems: 'baseline' }}>
                        <span style={{ color: 'var(--muted-foreground)', width: 76, flexShrink: 0 }}>
                          {DIFF_LABEL[k] ?? k}
                        </span>
                        <span style={{
                          color: DIFF_VALUE_COLOR[k] ?? 'var(--foreground)',
                          wordBreak: 'break-all', fontFamily: k.endsWith('_rid') ? 'monospace' : undefined,
                        }}>
                          {Array.isArray(val)
                            ? (val.length > 0 ? val.map(String).join('、') : '（无）')
                            : typeof val === 'boolean' ? (val ? '是' : '否') : String(val ?? '—')}
                        </span>
                      </div>
                    ))}
                    {diffResult.has_changes === false && (
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>两版本属性定义一致</div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="回滚来源 rid（同族旧版本，恢复其定义）"
                    value={rollbackFrom}
                    onChange={(e) => setRollbackFrom(e.target.value)}
                    style={verInputStyle}
                  />
                  <button type="button" onClick={() => void doRollback()} disabled={verBusy === 'rollback'} style={{ ...verBtnStyle, cursor: verBusy === 'rollback' ? 'wait' : 'pointer' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Undo2 style={{ width: 12, height: 12 }} />
                      {verBusy === 'rollback' ? '回滚中…' : '回滚'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 导入导出 */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>导入 / 导出</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void doExport()} disabled={verBusy === 'export'} style={{ ...verBtnStyle, cursor: verBusy === 'export' ? 'wait' : 'pointer' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Download style={{ width: 12, height: 12 }} />
                      {verBusy === 'export' ? '导出中…' : `导出当前类型（${verRid ? verRid.split('.')[3] ?? verRid : '—'}）`}
                    </span>
                  </button>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <Upload style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => void onImportFile(e)}
                      disabled={verBusy === 'import'}
                      style={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                    />
                  </span>
                </div>
                {importResult && (
                  <div style={{
                    padding: '8px 12px', fontSize: 12, borderRadius: 6,
                    border: `1px solid ${importResult.ok ? 'var(--success)' : 'var(--destructive)'}`,
                    color: importResult.ok ? 'var(--success)' : 'var(--destructive)',
                    wordBreak: 'break-all',
                  }}>
                    {importResult.text}
                  </div>
                )}
              </div>

              {verMsg && (
                <div style={{
                  padding: '8px 14px', fontSize: 12, borderRadius: 6,
                  border: '1px solid var(--success)', color: 'var(--success)',
                }}>{verMsg}</div>
              )}
              {verErr && (
                <div style={{
                  padding: '8px 14px', fontSize: 12, borderRadius: 6,
                  border: '1px solid var(--destructive)', color: 'var(--destructive)',
                  wordBreak: 'break-all',
                }}>{verErr}</div>
              )}
            </div>
          </Card>

          {/* Schema 暂存（WIP，G33）—— 应用（破坏性 409 二段确认）/ 丢弃 */}
          <SchemaWipCard />

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

          {/* 安全策略（行/列，SEC-12）—— 策略清单 + 新建 + 删除 */}
          <SecurityPolicyCard />

          {/* 执行历史 */}
          <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <History style={{ width: 15, height: 15 }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Action 执行历史</h4>
            </div>
            <Table<ActionAuditRow> columns={auditCols} dataSource={audit} rowKey="audit_id"
              pagination={{ pageSize: 10 }} size="small" empty="暂无执行记录" />
          </Card>

          {/* Agent 回归指标（ONT-AGENT-METRICS-01）—— AI proposal 接受率基线，独立降级 */}
          <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Bot style={{ width: 15, height: 15 }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Agent 回归指标</h4>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                AI proposal 接受率基线 · accepted = executed + reverted
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
                {[7, 30, 90].map((d) => (
                  <button key={d} type="button" onClick={() => setAgentDays(d)} disabled={agentLoading} style={{
                    height: 24, padding: '0 10px', fontSize: 11, borderRadius: 'var(--radius)',
                    border: `1px solid ${agentDays === d ? 'var(--primary)' : 'var(--border)'}`,
                    background: agentDays === d ? 'var(--primary)' : 'var(--card)',
                    color: agentDays === d ? 'var(--primary-foreground)' : 'var(--foreground)',
                    cursor: agentLoading ? 'wait' : 'pointer',
                  }}>{d} 天</button>
                ))}
              </div>
            </div>
            {agentLoading ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 32, justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                <Loader2 style={{ width: 14, height: 14, animation: 'osp-spin 1s linear infinite' }} /> 加载 Agent 指标…
              </div>
            ) : agentDown ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 24, fontSize: 12, color: 'var(--muted-foreground)' }}>
                <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
                指标不可用（后端未就绪或网络异常；切换窗口天数可重试）
              </div>
            ) : (
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                {/* 汇总接口单独失败（趋势仍在）时的局部降级提示 */}
                {!agentSummary && (
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>汇总接口暂不可用，以下仅趋势数据</div>
                )}
                {/* 指标行：总提案数 / 接受率 / executed / rejected / pending */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
                  {[
                    { label: '总提案数', value: agentSummary ? String(agentSummary.total) : '—', color: 'var(--foreground)' },
                    { label: '接受率', value: fmtAgentRate(agentSummary?.acceptance_rate), color: 'var(--foreground)' },
                    { label: 'executed', value: agentSummary ? String(agentSummary.by_status.executed ?? 0) : '—', color: 'var(--success)' },
                    { label: 'rejected', value: agentSummary ? String(agentSummary.by_status.rejected ?? 0) : '—', color: 'var(--destructive)' },
                    { label: 'pending', value: agentSummary ? String(agentSummary.by_status.pending ?? 0) : '—', color: 'var(--warning)' },
                  ].map((t) => (
                    <div key={t.label} style={{
                      flex: '1 1 110px', minWidth: 96, padding: '10px 14px',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      background: 'var(--card)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: t.color }}>{t.value}</div>
                    </div>
                  ))}
                </div>

                {/* 趋势：纯 SVG 迷你柱状图（proposed 总量柱 + executed 底部堆叠段） */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
                      proposed 提案
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--success)', flexShrink: 0 }} />
                      executed 已采纳（含 reverted）
                    </span>
                  </div>
                  <AgentTrendChart points={agentTrend} />
                </div>

                {/* 按提议方聚合 + 驳回原因分布（窄屏折行） */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['提议方', '提案数', '已执行', '接受率'].map((h, i) => (
                            <th key={h} style={{
                              textAlign: i === 0 ? 'left' : 'right', padding: '7px 12px',
                              borderBottom: '1px solid var(--border)',
                              color: 'var(--muted-foreground)', fontWeight: 500, fontSize: 11,
                              whiteSpace: 'nowrap',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(agentSummary?.by_actor ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: '12px 12px', color: 'var(--muted-foreground)', fontSize: 12 }}>
                              {agentSummary ? '窗口内无提案' : '—'}
                            </td>
                          </tr>
                        ) : agentSummary?.by_actor.map((row) => (
                          <tr key={row.actor}>
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                              {row.actor}
                            </td>
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{row.proposed}</td>
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{row.executed}</td>
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600 }}>
                              {fmtAgentRate(row.acceptance_rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ flex: '1 1 240px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>驳回原因分布</div>
                    {!agentSummary ? (
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>—</div>
                    ) : agentSummary.rejection_reasons == null ? (
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>驳回原因尚未记录（后端字段待接入）</div>
                    ) : agentSummary.rejection_reasons.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>窗口内无驳回记录</div>
                    ) : agentSummary.rejection_reasons.map((r) => (
                      <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0' }}>
                        <span style={{ wordBreak: 'break-all' }}>{r.reason}</span>
                        <span style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  口径：接受率 = accepted / (accepted + rejected)，accepted = executed + reverted；
                  pending / confirmed（在途）与 withdrawn（自撤）不入分母；趋势按 UTC 日连续零填充。
                </div>
              </div>
            )}
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
