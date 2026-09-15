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

import { useCallback, useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
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
import './ontology.css';

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
const DIFF_VALUE_CLASS: Record<string, string> = {
  added: 'mp-text-success',
  removed: 'mp-text-danger',
  changed: 'mp-text-warning',
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
 * 每日一根 proposed 总量柱（var(--semi-color-primary)）+ 底部 executed 已采纳堆叠段
 * （var(--semi-color-success)）。executed 日桶按 confirmed_at 锚定，极端时序下可能超过
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
        fontSize={12} fill="var(--semi-color-text-2)">暂无数据</text>,
    );
  } else {
    const max = Math.max(...points.map((p) => Math.max(p.proposed, p.executed)), 0);
    if (max <= 0) {
      els.push(
        <text key="ph" x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={12} fill="var(--semi-color-text-2)">窗口内暂无提案</text>,
      );
    } else {
      // 横向网格 + 纵轴刻度
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const v = (max / ticks) * i;
        const y = padT + ih - (ih * i) / ticks;
        els.push(
          <line key={`grid${i}`} x1={padL} y1={y} x2={W - padR} y2={y}
            stroke="var(--semi-color-border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 3'} />,
        );
        els.push(
          <text key={`tick${i}`} x={padL - 6} y={y} textAnchor="end" dominantBaseline="middle"
            fontSize={9} fill="var(--semi-color-text-2)">{Math.round(v)}</text>,
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
            height={Math.max(hTotal, 1)} fill="var(--semi-color-primary)" rx={2}>
            <title>{title}</title>
          </rect>,
        );
        const ex = Math.min(p.executed, p.proposed);
        if (ex > 0) {
          const hEx = (ex / max) * ih;
          els.push(
            <rect key={`ex${i}`} x={x} y={padT + ih - hEx} width={barW}
              height={Math.max(hEx, 1)} fill="var(--semi-color-success)">
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
            fontSize={9} fill="var(--semi-color-text-2)"
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
            {points[i].date.slice(5)}
          </text>,
        );
      });
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
      className="mp-block" role="img">
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
      <span className="mp-text-sm mp-mono" >{v}</span>) },
    { title: '读（30d）', dataIndex: 'reads', width: 100 },
    { title: '写（30d）', dataIndex: 'writes', width: 100 },
    { title: '活跃天数', dataIndex: 'active_days', width: 90 },
    { title: '', dataIndex: '__ops', width: 170, render: (_: unknown, row: UsageRow) => (
      <div className="mp-flex mp-gap-1" >
        <button type="button" onClick={() => void doLifecycle(row.class_rid, 'deprecate')} className="mp-clickable mp-border mp-text-sm mp-text-1 mp-py-1 mp-px-2 mp-bg-1 mp-rounded-sm" >废弃</button>
        <button type="button" onClick={() => void doLifecycle(row.class_rid, 'delete')} className="mp-clickable mp-text-sm mp-text-danger mp-py-1 mp-px-2 mp-rounded-sm mp-onto-btn--danger">删除</button>
      </div>
    ) },
  ];

  const auditCols: ColumnProps<ActionAuditRow>[] = [
    { title: '时间', dataIndex: 'created_at', width: 170, render: (v: string) => (
      <span className="mp-text-sm">{new Date(v).toLocaleString()}</span>) },
    { title: '动作', dataIndex: 'action_rid', render: (v: string) => (
      <span className="mp-text-xs mp-mono" >{v}</span>) },
    { title: '执行者', dataIndex: 'actor_id', width: 110 },
    { title: '编辑数', dataIndex: 'result', width: 80, render: (v: Record<string, unknown>) => (
      <span>{String(v?.applied_count ?? '—')}</span>) },
    { title: '提案', dataIndex: 'proposal_id', render: (v: string) => (
      <span className="mp-text-xs mp-mono" >{v}</span>) },
  ];

  return (
    <div className="mp-w-full mp-flex mp-flex-1 mp-gap-4 mp-flex-col" >
      {msg && (
        <div className="mp-border mp-text-sm mp-text-1 mp-py-2 mp-px-3 mp-bg-1 mp-rounded" >{msg}</div>
      )}
      {loading ? (
        <div className="mp-gap-2 mp-p-8 mp-text-body mp-text-2 mp-flex-center mp-justify-center" >
          <Loader2 className="mp-icon-14 mp-spin"  /> 加载治理数据…
        </div>
      ) : (
        <>
          {/* 版本与导入导出（G41） */}
          <Card bodyStyle={{ padding: 0 }}>
            <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
              <GitBranch className="mp-icon-14" />
              <h4 className="mp-fw-600 mp-m-0 mp-text-md">版本与导入导出</h4>
              <span className="mp-text-xs mp-text-2">类型版本分支 / 差异 / 回滚 · JSON 导出与导入</span>
            </div>
            <div className="mp-flex mp-gap-3 mp-py-3 mp-px-5 mp-flex-col" >
              {/* 类型选择 */}
              <div className="mp-flex-center mp-gap-2" >
                <span className="mp-text-sm mp-text-2 mp-shrink-0" >目标类型</span>
                <select
                  value={verRid}
                  onChange={(e) => pickType(e.target.value)}
                  className="mp-clickable mp-onto-input mp-onto-input--lg mp-onto-ver-input"
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
              <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded" >
                <div className="mp-fw-600 mp-text-sm">类型版本操作</div>
                <div className="mp-gap-2 mp-flex-center">
                  <input
                    type="text"
                    placeholder="分支新 rid：ont.<租户>.obj.<域>.<slug>.vN"
                    value={branchRid}
                    onChange={(e) => setBranchRid(e.target.value)}
                    className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
                  />
                  <button type="button" onClick={() => void doBranch()} disabled={verBusy === 'branch'} className="mp-onto-btn mp-onto-btn--lg">
                    <span className="mp-inline-flex mp-items-center mp-gap-1" >
                      <GitBranch className="mp-icon-12" />
                      {verBusy === 'branch' ? '创建中…' : '创建分支'}
                    </span>
                  </button>
                </div>
                <div className="mp-gap-2 mp-flex-center">
                  <input
                    type="text"
                    placeholder="基准 rid（默认当前选中）"
                    value={diffBase}
                    onChange={(e) => setDiffBase(e.target.value)}
                    className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
                  />
                  <input
                    type="text"
                    placeholder="对比 rid（against）"
                    value={diffAgainst}
                    onChange={(e) => setDiffAgainst(e.target.value)}
                    className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
                  />
                  <button type="button" onClick={() => void doDiff()} disabled={verBusy === 'diff'} className="mp-onto-btn mp-onto-btn--lg">
                    <span className="mp-inline-flex mp-items-center mp-gap-1" >
                      <GitCompare className="mp-icon-12" />
                      {verBusy === 'diff' ? '对比中…' : '对比差异'}
                    </span>
                  </button>
                </div>
                {diffResult && (
                  <div className="mp-border mp-py-2 mp-px-3 mp-bg-1 mp-rounded" >
                    <div className="mp-fw-600 mp-mb-2 mp-text-sm">Diff 结果</div>
                    {Object.entries(diffResult).map(([k, val]) => (
                      <div key={k} className="mp-flex mp-mb-1 mp-text-sm mp-gap-2 mp-onto-baseline">
                        <span className="mp-text-2 mp-shrink-0 mp-onto-diff-key">
                          {DIFF_LABEL[k] ?? k}
                        </span>
                        <span className={`mp-break-all ${DIFF_VALUE_CLASS[k] ?? 'mp-text-1'}${k.endsWith('_rid') ? ' mp-mono' : ''}`}>
                          {Array.isArray(val)
                            ? (val.length > 0 ? val.map(String).join('、') : '（无）')
                            : typeof val === 'boolean' ? (val ? '是' : '否') : String(val ?? '—')}
                        </span>
                      </div>
                    ))}
                    {diffResult.has_changes === false && (
                      <div className="mp-mt-1 mp-text-xs mp-text-2">两版本属性定义一致</div>
                    )}
                  </div>
                )}
                <div className="mp-gap-2 mp-flex-center">
                  <input
                    type="text"
                    placeholder="回滚来源 rid（同族旧版本，恢复其定义）"
                    value={rollbackFrom}
                    onChange={(e) => setRollbackFrom(e.target.value)}
                    className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
                  />
                  <button type="button" onClick={() => void doRollback()} disabled={verBusy === 'rollback'} className="mp-onto-btn mp-onto-btn--lg">
                    <span className="mp-inline-flex mp-items-center mp-gap-1" >
                      <Undo2 className="mp-icon-12" />
                      {verBusy === 'rollback' ? '回滚中…' : '回滚'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 导入导出 */}
              <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded" >
                <div className="mp-fw-600 mp-text-sm">导入 / 导出</div>
                <div className="mp-gap-2 mp-flex-center mp-wrap" >
                  <button type="button" onClick={() => void doExport()} disabled={verBusy === 'export'} className="mp-onto-btn mp-onto-btn--lg">
                    <span className="mp-inline-flex mp-items-center mp-gap-1" >
                      <Download className="mp-icon-12" />
                      {verBusy === 'export' ? '导出中…' : `导出当前类型（${verRid ? verRid.split('.')[3] ?? verRid : '—'}）`}
                    </span>
                  </button>
                  <span className="mp-inline-flex mp-items-center mp-text-sm mp-gap-1" >
                    <Upload className="mp-icon-12 mp-text-2" />
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => void onImportFile(e)}
                      disabled={verBusy === 'import'}
                      className="mp-text-sm mp-text-2"
                    />
                  </span>
                </div>
                {importResult && (
                  <div className={`mp-break-all mp-text-sm mp-py-2 mp-px-3 mp-rounded ${importResult.ok ? 'mp-onto-note-success' : 'mp-onto-note-danger'}`}>
                    {importResult.text}
                  </div>
                )}
              </div>

              {verMsg && (
                <div className="mp-text-sm mp-text-success mp-py-2 mp-px-3 mp-rounded mp-onto-note-success">{verMsg}</div>
              )}
              {verErr && (
                <div className="mp-break-all mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-rounded mp-onto-note-danger">{verErr}</div>
              )}
            </div>
          </Card>

          {/* Schema 暂存（WIP，G33）—— 应用（破坏性 409 二段确认）/ 丢弃 */}
          <SchemaWipCard />

          {/* 使用量 */}
          <Card bodyStyle={{ padding: 0 }}>
            <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
              <BarChart3 className="mp-icon-14" />
              <h4 className="mp-fw-600 mp-m-0 mp-text-md">类型使用量（近 30 天）</h4>
              <span className="mp-text-xs mp-text-2">变更影响评估 · 退役决策</span>
            </div>
            <Table<UsageRow> columns={usageCols} dataSource={usage} rowKey="class_rid"
              pagination={{ pageSize: 10 }} size="small" empty="暂无使用量数据" />
          </Card>

          {/* 反模式 lint */}
          <Card bodyStyle={{ padding: 0 }}>
            <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
              <ShieldAlert className="mp-icon-14 mp-text-warning" />
              <h4 className="mp-fw-600 mp-m-0 mp-text-md">反模式检查</h4>
              <span className="mp-text-xs mp-text-2">
                {lint.length} 项发现（god_object / kitchen_sink / misnomer / action_sprawl）
              </span>
            </div>
            {lint.length === 0 ? (
              <div className="mp-p-6 mp-text-sm mp-text-2">✓ 未发现反模式</div>
            ) : (
              <div className="mp-flex mp-gap-2 mp-py-2 mp-px-4 mp-flex-col" >
                {lint.slice(0, 30).map((f, i) => (
                  <div key={i} className="mp-flex mp-border mp-gap-2 mp-py-2 mp-px-3 mp-items-start mp-rounded" >
                    <Tag size="small" color={PATTERN_COLOR[f.pattern] ?? 'grey'}>
                      {PATTERN_LABEL[f.pattern] ?? f.pattern}
                    </Tag>
                    <div className="mp-flex-1">
                      <div className="mp-text-sm mp-break-all mp-mono" >{f.subject}</div>
                      <div className="mp-text-sm mp-text-2">{f.detail}</div>
                      <div className="mp-text-xs mp-text-2 mp-mt-1" >💡 {f.hint}</div>
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
            <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
              <History className="mp-icon-14" />
              <h4 className="mp-fw-600 mp-m-0 mp-text-md">Action 执行历史</h4>
            </div>
            <Table<ActionAuditRow> columns={auditCols} dataSource={audit} rowKey="audit_id"
              pagination={{ pageSize: 10 }} size="small" empty="暂无执行记录" />
          </Card>

          {/* Agent 回归指标（ONT-AGENT-METRICS-01）—— AI proposal 接受率基线，独立降级 */}
          <Card bodyStyle={{ padding: 0 }}>
            <div className="mp-gap-2 mp-flex-center mp-border mp-py-3 mp-px-5" >
              <Bot className="mp-icon-14" />
              <h4 className="mp-fw-600 mp-m-0 mp-text-md">Agent 回归指标</h4>
              <span className="mp-text-xs mp-text-2">
                AI proposal 接受率基线 · accepted = executed + reverted
              </span>
              <div className="mp-flex mp-shrink-0 mp-ml-auto mp-gap-1" >
                {[7, 30, 90].map((d) => (
                  <button key={d} type="button" onClick={() => setAgentDays(d)} disabled={agentLoading} className={`mp-text-xs mp-onto-days-btn${agentDays === d ? ' mp-onto-days-btn--active' : ''}`}>{d} 天</button>
                ))}
              </div>
            </div>
            {agentLoading ? (
              <div className="mp-gap-2 mp-p-7 mp-text-body mp-text-2 mp-flex-center mp-justify-center" >
                <Loader2 className="mp-icon-14 mp-spin"  /> 加载 Agent 指标…
              </div>
            ) : agentDown ? (
              <div className="mp-p-6 mp-text-sm mp-text-2 mp-flex-center mp-gap-1" >
                <AlertTriangle className="mp-shrink-0 mp-icon-12"  />
                指标不可用（后端未就绪或网络异常；切换窗口天数可重试）
              </div>
            ) : (
              <div className="mp-w-full mp-flex mp-gap-3 mp-py-3 mp-px-5 mp-flex-col mp-min-w-0 mp-onto-border-box">
                {/* 汇总接口单独失败（趋势仍在）时的局部降级提示 */}
                {!agentSummary && (
                  <div className="mp-text-xs mp-text-2">汇总接口暂不可用，以下仅趋势数据</div>
                )}
                {/* 指标行：总提案数 / 接受率 / executed / rejected / pending */}
                <div className="mp-w-full mp-flex mp-wrap mp-gap-2" >
                  {[
                    { label: '总提案数', value: agentSummary ? String(agentSummary.total) : '—', cls: 'mp-text-1' },
                    { label: '接受率', value: fmtAgentRate(agentSummary?.acceptance_rate), cls: 'mp-text-1' },
                    { label: 'executed', value: agentSummary ? String(agentSummary.by_status.executed ?? 0) : '—', cls: 'mp-text-success' },
                    { label: 'rejected', value: agentSummary ? String(agentSummary.by_status.rejected ?? 0) : '—', cls: 'mp-text-danger' },
                    { label: 'pending', value: agentSummary ? String(agentSummary.by_status.pending ?? 0) : '—', cls: 'mp-text-warning' },
                  ].map((t) => (
                    <div key={t.label} className="mp-border mp-rounded mp-py-2 mp-px-3 mp-bg-1 mp-onto-metric-tile">
                      <div className="mp-text-xs mp-text-2">{t.label}</div>
                      <div className={`mp-text-xl mp-mt-1 mp-onto-metric-value ${t.cls}`}>{t.value}</div>
                    </div>
                  ))}
                </div>

                {/* 趋势：纯 SVG 迷你柱状图（proposed 总量柱 + executed 底部堆叠段） */}
                <div className="mp-border mp-rounded mp-py-2 mp-px-3" >
                  <div className="mp-text-xs mp-text-2 mp-flex-center mp-mb-1 mp-gap-3" >
                    <span className="mp-inline-flex mp-items-center mp-gap-1" >
                      <span className="mp-shrink-0 mp-icon-12 mp-rounded-sm mp-onto-swatch-primary" />
                      proposed 提案
                    </span>
                    <span className="mp-inline-flex mp-items-center mp-gap-1" >
                      <span className="mp-shrink-0 mp-icon-12 mp-rounded-sm mp-onto-swatch-success" />
                      executed 已采纳（含 reverted）
                    </span>
                  </div>
                  <AgentTrendChart points={agentTrend} />
                </div>

                {/* 按提议方聚合 + 驳回原因分布（窄屏折行） */}
                <div className="mp-flex mp-wrap mp-gap-3 mp-onto-stretch">
                  <div className="mp-hidden mp-border mp-rounded mp-min-w-0 mp-onto-actor-col">
                    <table className="mp-w-full mp-text-sm mp-onto-table">
                      <thead>
                        <tr>
                          {['提议方', '提案数', '已执行', '接受率'].map((h, i) => (
                            <th key={h} className={`mp-fw-500 mp-nowrap mp-border mp-text-xs mp-text-2 mp-py-2 mp-px-3 ${i === 0 ? 'mp-text-left' : 'mp-text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(agentSummary?.by_actor ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="mp-text-sm mp-text-2 mp-py-3 mp-px-3" >
                              {agentSummary ? '窗口内无提案' : '—'}
                            </td>
                          </tr>
                        ) : agentSummary?.by_actor.map((row) => (
                          <tr key={row.actor}>
                            <td className="mp-text-xs mp-break-all mp-border mp-py-1 mp-px-3 mp-mono" >
                              {row.actor}
                            </td>
                            <td className="mp-border mp-py-1 mp-px-3 mp-text-right" >{row.proposed}</td>
                            <td className="mp-border mp-py-1 mp-px-3 mp-text-right" >{row.executed}</td>
                            <td className="mp-fw-600 mp-border mp-py-1 mp-px-3 mp-text-right" >
                              {fmtAgentRate(row.acceptance_rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mp-border mp-rounded mp-py-2 mp-px-3 mp-min-w-0 mp-onto-reject-col">
                    <div className="mp-fw-600 mp-text-sm mp-mb-1" >驳回原因分布</div>
                    {!agentSummary ? (
                      <div className="mp-text-sm mp-text-2">—</div>
                    ) : agentSummary.rejection_reasons == null ? (
                      <div className="mp-text-sm mp-text-2">驳回原因尚未记录（后端字段待接入）</div>
                    ) : agentSummary.rejection_reasons.length === 0 ? (
                      <div className="mp-text-sm mp-text-2">窗口内无驳回记录</div>
                    ) : agentSummary.rejection_reasons.map((r) => (
                      <div key={r.reason} className="mp-flex mp-justify-between mp-text-sm mp-gap-2 mp-py-1">
                        <span className="mp-break-all">{r.reason}</span>
                        <span className="mp-text-2 mp-shrink-0" >{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mp-text-xs mp-text-2">
                  口径：接受率 = accepted / (accepted + rejected)，accepted = executed + reverted；
                  pending / confirmed（在途）与 withdrawn（自撤）不入分母；趋势按 UTC 日连续零填充。
                </div>
              </div>
            )}
          </Card>

          {!loading && usage.length === 0 && (
            <div className="mp-text-sm mp-text-2 mp-flex-center mp-gap-1" >
              <AlertTriangle className="mp-icon-12" />
              使用量在读写时自动打点（GET /individuals 按类读、apply-edit-set 写）
            </div>
          )}
        </>
      )}
    </div>
  );
}
