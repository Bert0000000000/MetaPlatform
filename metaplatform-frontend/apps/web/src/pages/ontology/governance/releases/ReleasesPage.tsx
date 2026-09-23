import { useCallback, useEffect, useState } from 'react';
import { GitBranch, GitCompare, Undo2 } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  branchObjectType,
  diffObjectTypes,
  listObjectTypes,
  rollbackObjectType,
  slugAndVersionOfObjectType,
  type KernelObjectType,
} from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
import '../governance.css';

/** G41：diff 结果 key 中文化（原样兜底）。 */
const DIFF_LABEL: Record<string, string> = {
  old_rid: '基准版本',
  new_rid: '对比版本',
  added: '新增属性',
  removed: '移除属性',
  changed: '变更属性',
  has_changes: '存在差异',
};

const DIFF_VALUE_CLASS: Record<string, string> = {
  added: 'mp-text-success',
  removed: 'mp-text-danger',
  changed: 'mp-text-warning',
};

/** 从 axios 错误中取 FastAPI detail。 */
function verErrText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? (e instanceof Error ? e.message : fallback);
}

/**
 * 版本与发布（IA2-6 自 GovernancePage 的版本操作区块拆出）：
 * 正式路由 /ontology/governance/releases。类型版本分支 / 差异 / 回滚（G41）。
 * 只移动不复制——列与操作逻辑与原区块一致。
 */
export default function ReleasesPage() {
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [verRid, setVerRid] = useState('');
  const [branchRid, setBranchRid] = useState('');
  const [diffBase, setDiffBase] = useState('');
  const [diffAgainst, setDiffAgainst] = useState('');
  const [diffResult, setDiffResult] = useState<Record<string, unknown> | null>(null);
  const [rollbackFrom, setRollbackFrom] = useState('');
  const [verBusy, setVerBusy] = useState('');
  const [verMsg, setVerMsg] = useState('');
  const [verErr, setVerErr] = useState('');

  const reloadTypes = useCallback(() => {
    listObjectTypes().then((ts) => {
      setTypes(ts);
      setVerRid((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : (ts[0]?.rid ?? '')));
      setDiffBase((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : (ts[0]?.rid ?? '')));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    reloadTypes();
  }, [reloadTypes]);

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

  return (
    <>
      <PageHeader
        title="版本与发布"
        desc="类型版本分支 / 差异 / 回滚（G41）· 不可变版本发布"
      />
      <div className="mp-gov-card">
        <div className="mp-flex-center mp-gap-2">
          <span className="mp-text-sm mp-text-2 mp-shrink-0">目标类型</span>
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

        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
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
              <span className="mp-inline-flex mp-items-center mp-gap-1">
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
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <GitCompare className="mp-icon-12" />
                {verBusy === 'diff' ? '对比中…' : '对比差异'}
              </span>
            </button>
          </div>
          {diffResult && (
            <div className="mp-border mp-py-2 mp-px-3 mp-bg-1 mp-rounded">
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
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <Undo2 className="mp-icon-12" />
                {verBusy === 'rollback' ? '回滚中…' : '回滚'}
              </span>
            </button>
          </div>
        </div>

        {verMsg && (
          <div className="mp-text-sm mp-text-success mp-py-2 mp-px-3 mp-rounded mp-onto-note-success">{verMsg}</div>
        )}
        {verErr && (
          <div className="mp-break-all mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-rounded mp-onto-note-danger">{verErr}</div>
        )}

        {types.length === 0 && (
          <EmptyState illustration="no-content" title="还没有对象类型" desc="先在语义模型里创建类型。" />
        )}
      </div>
    </>
  );
}
