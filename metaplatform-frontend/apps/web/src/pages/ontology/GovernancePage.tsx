// GovernancePage - 治理面（ONT-UI-04，Palantir Ontology Manager Usage/History/Cleanup 对位）。
//
// 四个区块：
//   1. 版本与导入导出（G41）—— 类型版本操作（branch / diff / rollback）+
//      Export/Import（JSON 下载 / 文件导入回灌）
//   2. 类型使用量（GET /usage/types）—— Reads/Writes/ActiveDays + 生命周期操作
//      （deprecate/delete，带使用量删除保护的 409 提示）
//   3. 反模式 lint（GET /lint/anti-patterns）—— god_object / kitchen_sink /
//      misnomer / action_sprawl
//   4. 执行历史（GET /action-audit）—— actor/时间/结果/审计链倒序

import { useCallback, useEffect, useState, type CSSProperties, type ChangeEvent } from 'react';
import { Card, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { AlertTriangle, BarChart3, Download, GitBranch, GitCompare, History, Loader2, ShieldAlert, Undo2, Upload } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  applyLifecycle, branchObjectType, diffObjectTypes, exportObjectType,
  getUsageSummary, importObjectTypes, lintAntiPatterns, listActionAudit,
  listObjectTypes, rollbackObjectType, slugAndVersionOfObjectType,
  type ActionAuditRow, type KernelObjectType, type LintFinding, type UsageRow,
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
