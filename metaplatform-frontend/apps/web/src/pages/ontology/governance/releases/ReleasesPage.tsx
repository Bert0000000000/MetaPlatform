import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tag } from '@douyinfe/semi-ui';
import {
  ArrowRightLeft,
  DatabaseZap,
  GitBranch,
  GitCompare,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import { toast, useAuth } from '@mate/shared';
import {
  assessMigration,
  branchObjectType,
  diffObjectTypes,
  getObjectType,
  listMigrationRuns,
  listObjectTypes,
  rollbackObjectType,
  runMigration,
  type KernelObjectType,
  type KernelVersion,
  type MigrationAssessment,
  type MigrationPlan,
  type MigrationRun,
} from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
import VersionHistory from '../../components/VersionHistory';
import SchemaWipCard from '../../components/SchemaWipCard';
import { useMutationLock } from '../../hooks/mutationLock';
import { objectTypeFamily } from '../../hooks/objectTypeFamily';
import { editorIdentity } from '../../hooks/editorSession';
import { resourceError } from '../../hooks/resourceErrors';
import { resourceUrl, safeReturnTo } from '../../hooks/resourceContext';
import '../governance.css';
import '../../ontology.css';

/** diff 结果 key 中文化（原样兜底）。 */
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

const shortRid = (rid: string, n = 14): string =>
  rid.length > n ? `${rid.slice(0, n)}…` : rid;

/**
 * 版本与发布（正式路由 /ontology/governance/releases）。
 *
 * <p>四层版本概念（一个家族 = tenant + slug）：
 * <ul>
 *   <li><b>草稿</b> — `ont_schema_wip`，不占版本号，见「草稿」页；</li>
 *   <li><b>已发布版本</b> — `ont_type_version` 的**不可变定义快照**（唯一权威版本来源）；</li>
 *   <li><b>当前生效版本</b> — 家族中 checksum 与当前类型一致的那一条快照。</li>
 * </ul>
 *
 * <p>回滚只回滚**模型定义**：不动实例数据，也不补偿已发生的副作用。
 */
export default function ReleasesPage() {
  const { user } = useAuth();
  const identity = editorIdentity(user);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [params, setParams] = useSearchParams();
  const requested = params.get('typeRef') || params.get('class') || '';
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [verRid, setVerRid] = useState(requested);
  const [live, setLive] = useState<KernelObjectType | null>(null);
  const [versions, setVersions] = useState<KernelVersion[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [branchRid, setBranchRid] = useState('');
  const [diffBase, setDiffBase] = useState('');
  const [diffAgainst, setDiffAgainst] = useState('');
  const [diffResult, setDiffResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [rollbackFrom, setRollbackFrom] = useState('');
  const [busy, setBusy] = useState('');
  // A write remains in flight until its promise settles, independently of read/display resets.
  const mutation = useMutationLock();
  const mutationPending = mutation.pending;
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  // 存量适配（ADR-0082）：评估结果 + 可编辑计划副本 + 运行历史
  const [assessment, setAssessment] = useState<MigrationAssessment | null>(
    null,
  );
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [typesError, setTypesError] = useState(''),
    [runsError, setRunsError] = useState('');
  const [typesLoading, setTypesLoading] = useState(true),
    [historyReady, setHistoryReady] = useState(false);
  const [branchEdited, setBranchEdited] = useState(false);
  const branchEditedRef = useRef(branchEdited);
  branchEditedRef.current = branchEdited;
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const reads = useRef(0),
    operations = useRef(0),
    typeReads = useRef(0);
  const currentRid = useRef(verRid);
  currentRid.current = verRid;
  const [branchMode, setBranchMode] = useState('version');
  const [copySlug, setCopySlug] = useState('');
  const invalidate = () => {
    if (mutation.locked()) return;
    operations.current++;
    setBusy('');
    setErr('');
    setMsg('');
    setDiffResult(null);
  };
  const editBranch = (value: string) => {
    if (mutation.locked()) return;
    invalidate();
    setBranchEdited(true);
    setBranchRid(value);
  };
  const editDiff = (field: 'base' | 'against', value: string) => {
    if (mutation.locked()) return;
    invalidate();
    field === 'base' ? setDiffBase(value) : setDiffAgainst(value);
  };
  const editRollback = (value: string) => {
    if (mutation.locked()) return;
    invalidate();
    setRollbackFrom(value);
  };

  const reloadTypes = useCallback(async () => {
    const n = ++typeReads.current;
    const scope = currentIdentity.current;
    const fresh = () => n === typeReads.current && scope === currentIdentity.current;
    setTypesError('');
    setTypesLoading(true);
    try {
      const ts = await listObjectTypes();
      if (!fresh()) return;
      setTypes(ts);
      setVerRid((cur) => cur || requested || ts[0]?.rid || '');
    } catch (e) {
      if (fresh()) setTypesError(`stale · ${resourceError(e)}`);
    } finally {
      if (fresh()) setTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    setTypes([]);
    setMsg('');
    setErr('');
    void reloadTypes();
    return () => {
      typeReads.current++;
      reads.current++;
      operations.current++;
    };
  }, [reloadTypes, identity]);

  const loadDetail = useCallback(async (rid: string) => {
    const n = ++reads.current;
    const scope = currentIdentity.current;
    const fresh = () => n === reads.current && rid === currentRid.current && scope === currentIdentity.current;
    if (!rid) {
      setLive(null);
      setRuns([]);
      return;
    }
    setDetailBusy(true);
    try {
      const [ot, migRuns] = await Promise.allSettled([
        getObjectType(rid),
        listMigrationRuns(rid),
      ]);
      if (!fresh()) return;
      if (ot.status === 'fulfilled') setLive(ot.value);
      else setErr(`当前定义 · ${resourceError(ot.reason)}`);
      if (migRuns.status === 'fulfilled') {
        setRuns(migRuns.value);
        setRunsError('');
      } else setRunsError(`迁移记录 · ${resourceError(migRuns.reason)}`);
    } finally {
      if (fresh()) setDetailBusy(false);
    }
  }, []);

  useEffect(() => {
    reads.current++;
    operations.current++;
    setLive(null);
    setVersions([]);
    setRuns([]);
    setRunsError('');
    setAssessment(null);
    setPlan(null);
    setBusy('');
    setDiffResult(null);
    setDiffBase('');
    setDiffAgainst('');
    setRollbackFrom('');
    setBranchRid('');
    setBranchEdited(false);
    setHistoryReady(false);
    void loadDetail(verRid);
    return () => {
      reads.current++;
      operations.current++;
    };
  }, [verRid, loadDetail, identity]);
  useEffect(() => {
    if (requested && requested !== currentRid.current) {
      operations.current++;
      reads.current++;
      setVerRid(requested);
    }
  }, [requested]);
  useEffect(() => {
    if (!live || !historyReady || branchEdited || branchMode !== 'version')
      return;
    const suffix = (rid: string) => Number(rid.match(/\.v(\d+)$/)?.[1] || 0);
    const max = Math.max(
      suffix(live.rid),
      ...versions.map((v) => suffix(String(v.definition.rid || v.class_ref))),
    );
    setBranchRid(live.rid.replace(/\.v\d+$/, `.v${max + 1}`));
  }, [live, versions, historyReady, branchEdited, branchMode]);
  const historyLoaded = useCallback((rows: KernelVersion[]) => {
    setVersions(rows);
    setHistoryReady(true);
  }, []);
  const historyReset = useCallback(() => {
    setVersions([]);
    setHistoryReady(false);
    if (!branchEditedRef.current) setBranchRid('');
  }, []);
  const draftPublished = useCallback(
    (type: KernelObjectType) => {
      if (type.rid !== currentRid.current) return;
      if (!mutation.locked()) {
        operations.current++;
        setBusy('');
      }
      setAssessment(null);
      setPlan(null);
      setHistoryRefresh((v) => v + 1);
      void reloadTypes();
      void loadDetail(type.rid);
    },
    [reloadTypes, loadDetail],
  );

  /** 用户主动切换类型才清提示；发布/回滚后的自动重载不清（否则成功消息被吞掉）。 */
  const pickType = (rid: string) => {
    if (mutation.locked()) return;
    reads.current++;
    invalidate();
    setVerRid(rid);
    const next = new URLSearchParams(params);
    next.set('typeRef', rid);
    setParams(next);
    setErr('');
    setMsg('');
    setDiffResult(null);
    setRollbackFrom('');
    setAssessment(null);
    setPlan(null);
  };

  /** 草稿 page 的 publish 是 POST /object-types/wip/{rid}/apply；此处是**已发布类型**的版本操作。 */
  const doBranch = async () => {
    if (mutation.locked()) return;
    if (!verRid) {
      setErr('请先选择类型');
      return;
    }
    if (!branchRid.trim()) {
      setErr(
        '请填写新版本 rid（ont.<租户>.obj.<域>.<slug>.vN），同族 = 发布新版本',
      );
      return;
    }
    const source = verRid,
      target = branchRid.trim(),
      n = ++operations.current;
    const fresh = () =>
      n === operations.current && source === currentRid.current && identity === currentIdentity.current;
    const release = mutation.acquire();
    if (!release) return;
    setBusy('branch');
    setErr('');
    setMsg('');
    setAssessment(null);
    setPlan(null);
    try {
      const ot = await branchObjectType(source, target);
      if (!fresh()) return;
      const same = objectTypeFamily(source) === objectTypeFamily(ot.rid);
      toast('发布成功', 'success');
      setBranchRid('');
      await reloadTypes();
      if (!fresh()) return;
      // 同族发布后旧 rid 已下线：选中态跟随新版本，否则选择器会回落到第一个类型
      setVerRid(ot.rid);
      const next = new URLSearchParams(params);
      next.set('typeRef', ot.rid);
      setParams(next);
      setMsg(
        `发布成功：${ot.rid}（${ot.display_name}）· ${same ? `原 ${source} 已下线，定义仍可从版本历史回读` : `独立副本已创建，源类型 ${source} 保留`}`,
      );
    } catch (e) {
      if (fresh()) setErr(resourceError(e));
    } finally {
      release();
      if (fresh()) setBusy('');
    }
  };

  const doDiff = async () => {
    if (mutation.locked()) return;
    const base = diffBase.trim() || verRid;
    const against = diffAgainst.trim();
    if (!base || !against) {
      setErr('对比差异需要基准 rid 与对比 rid');
      return;
    }
    if (base === against) {
      setErr('基准与对比 rid 不能相同');
      return;
    }
    const source = verRid,
      n = ++operations.current;
    const fresh = () =>
      n === operations.current && source === currentRid.current && identity === currentIdentity.current;
    setBusy('diff');
    setErr('');
    setMsg('');
    setDiffResult(null);
    try {
      const out = await diffObjectTypes(base, against);
      if (fresh()) setDiffResult(out);
    } catch (e) {
      if (fresh()) setErr(resourceError(e));
    } finally {
      if (fresh()) setBusy('');
    }
  };

  const doRollback = async () => {
    if (mutation.locked()) return;
    if (!verRid) {
      setErr('请先选择类型');
      return;
    }
    if (!rollbackFrom.trim()) {
      setErr('请选择回滚来源（版本历史的「回滚到此版」或手填 rid）');
      return;
    }
    if (
      !window.confirm(
        `把 ${verRid} 的模型定义回滚为 ${rollbackFrom.trim()}？\n\n` +
          '回滚范围：只回滚模型定义（schema）。\n' +
          '不回滚：实例数据、关系实例。\n' +
          '不补偿：已发生的 Action 副作用 / 外联写入。',
      )
    )
      return;
    const source = verRid,
      from = rollbackFrom.trim(),
      n = ++operations.current;
    const fresh = () =>
      n === operations.current && source === currentRid.current && identity === currentIdentity.current;
    const release = mutation.acquire();
    if (!release) return;
    setBusy('rollback');
    setErr('');
    setMsg('');
    setAssessment(null);
    setPlan(null);
    try {
      const ot = await rollbackObjectType(source, from);
      if (!fresh()) return;
      setMsg(
        `回滚成功：${ot.rid} 已恢复为 ${rollbackFrom.trim()} 的模型定义（数据未动）`,
      );
      toast('回滚成功', 'success');
      await loadDetail(verRid);
      if (fresh()) await reloadTypes();
      if (fresh()) setHistoryRefresh((v) => v + 1);
    } catch (e) {
      if (fresh()) setErr(resourceError(e));
    } finally {
      release();
      if (fresh()) setBusy('');
    }
  };

  /** 存量适配评估（只读）：上一条版本快照 → 当前生效 的真实影响计数 + 计划草案。 */
  const doAssess = async () => {
    if (mutation.locked()) return;
    if (!verRid) {
      setErr('请先选择类型');
      return;
    }
    const source = verRid,
      n = ++operations.current;
    const fresh = () =>
      n === operations.current && source === currentRid.current && identity === currentIdentity.current;
    setBusy('assess');
    setErr('');
    setMsg('');
    setAssessment(null);
    setPlan(null);
    try {
      const a = await assessMigration(verRid);
      if (!fresh()) return;
      setAssessment(a);
      setPlan({
        ...a.plan,
        drops: { ...a.plan.drops },
        pk_rederive: a.plan.pk_rederive ? { ...a.plan.pk_rederive } : null,
      });
      void loadDetail(verRid);
    } catch (e) {
      if (fresh()) setErr(resourceError(e));
    } finally {
      if (fresh()) setBusy('');
    }
  };

  /** 执行存量适配：确认框带摘要（含信息损失警告）；PK 冲突/缺失 fail-closed 由后端拦。 */
  const doRunMigration = async () => {
    if (mutation.locked()) return;
    if (!verRid || !assessment || !plan) return;
    const c = assessment.counts;
    const lossNote =
      plan.drops.policy === 'drop' && plan.drops.props.length > 0
        ? `\n⚠ 删除策略将物理移除 ${plan.drops.props.length} 个属性的存量键，不可恢复。`
        : '';
    if (
      !window.confirm(
        `对 ${verRid} 执行存量数据迁移？\n\n` +
          `重挂实例：${c.reattach_pending ?? 0} 条\n` +
          `受影响实例：${c.instances_affected ?? 0} 条\n` +
          `PK 冲突：${c.pk_conflicts ?? 0} · PK 缺失：${c.pk_missing ?? 0}（缺失策略：${plan.pk_rederive?.on_missing ?? '—'}）` +
          lossNote,
      )
    )
      return;
    const source = verRid,
      n = ++operations.current;
    const fresh = () =>
      n === operations.current && source === currentRid.current && identity === currentIdentity.current;
    const release = mutation.acquire();
    if (!release) return;
    setBusy('migrate');
    setErr('');
    setMsg('');
    try {
      const out = await runMigration(verRid, plan, assessment.to_checksum);
      if (!fresh()) return;
      const counts = (out.counts ?? {}) as Record<string, unknown>;
      setMsg(
        `迁移完成（run ${(out.run_id as string) ?? ''}）：重挂 ${String(counts.reattached ?? 0)} ·` +
          ` rename ${Object.keys((counts.renamed as Record<string, unknown>) ?? {}).length} 项 ·` +
          ` PK 重派生 ${String(counts.pk_rederived ?? 0)}` +
          (out.replayed ? '（幂等回放）' : ''),
      );
      toast('迁移完成', 'success');
      setAssessment(null);
      setPlan(null);
      await loadDetail(verRid);
    } catch (e) {
      if (fresh()) setErr(resourceError(e));
    } finally {
      release();
      if (fresh()) setBusy('');
    }
  };

  const activeChecksum =
    !typesError && !typesLoading
      ? types.find((t) => objectTypeFamily(t.rid) === objectTypeFamily(verRid))?.checksum
      : undefined;
  const currentVersion = versions.find(
    (v) => !!activeChecksum && v.checksum === activeChecksum,
  );

  return (
    <>
      <PageHeader
        title="版本与发布"
        desc="草稿 → 已发布版本 → 当前生效 · 版本 = 不可变定义快照（唯一权威来源）"
        actions={
          <button
            type="button"
            className="mp-onto-btn"
            disabled={detailBusy || mutationPending}
            onClick={() => {
              if (mutation.locked()) return;
              invalidate();
              setAssessment(null);
              setPlan(null);
              setHistoryRefresh((v) => v + 1);
              void reloadTypes();
              void loadDetail(verRid);
            }}
          >
            <span className="mp-inline-flex mp-items-center mp-gap-1">
              <RefreshCw className="mp-icon-12" />
              刷新
            </span>
          </button>
        }
      />

      <fieldset
        className="mp-gov-card"
        disabled={mutationPending}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        <div className="mp-flex-center mp-gap-2">
          <span className="mp-text-sm mp-text-2 mp-shrink-0">目标类型</span>
          <select
            aria-label="目标类型"
            value={verRid}
            onChange={(e) => pickType(e.target.value)}
            className="mp-clickable mp-onto-input mp-onto-input--lg mp-onto-ver-input"
          >
            {types.length === 0 && (
              <option value="">
                {typesError ? '类型读取失败' : '（暂无类型）'}
              </option>
            )}
            {verRid && !types.some((t) => t.rid === verRid) && (
              <option value={verRid}>{verRid}（请求的类型）</option>
            )}
            {types.map((ot) => (
              <option key={ot.rid} value={ot.rid}>
                {ot.display_name || ot.rid}
              </option>
            ))}
          </select>
        </div>
        {typesError && (
          <div role="alert">
            {typesError}
            <button onClick={() => void reloadTypes()}>重试类型读取</button>
          </div>
        )}
        {requested &&
          !typesError &&
          types.length > 0 &&
          !types.some((t) => t.rid === verRid) && (
            <p>
              请求的类型不在当前生效清单，保留指定标识读取历史，未自动选择其他类型。
            </p>
          )}
        {safeReturnTo(params.get('returnTo')) && (
          <Link to={safeReturnTo(params.get('returnTo'))!}>返回模型</Link>
        )}
        {verRid && (
          <Link
            to={resourceUrl(
              '/ontology/governance/drafts',
              verRid,
              safeReturnTo(params.get('returnTo')),
              params.get('changeRef') || undefined,
            )}
          >
            审阅此类型草稿
          </Link>
        )}
        {verRid && (
          <SchemaWipCard
            typeRef={verRid}
            onPublished={draftPublished}
            mutationLock={mutation}
          />
        )}

        {/* ① 当前生效 —— 家族中 checksum 与此一致的那条快照 */}
        {live && (
          <div className="mp-border mp-rounded mp-py-2 mp-px-3 mp-flex-col mp-gap-1">
            <div className="mp-fw-600 mp-text-sm">
              {activeChecksum && live.checksum === activeChecksum
                ? '当前生效'
                : '所选类型定义（非当前生效或待核对）'}
            </div>
            <div className="mp-text-sm mp-break-all">
              {live.display_name || '（无显示名）'} ·{' '}
              <span className="mp-mono">{live.rid}</span>
            </div>
            <div className="mp-text-xs mp-text-2">
              定义指纹 <span className="mp-mono">{live.checksum || '—'}</span> ·
              属性 {live.properties.length} 个 ·{' '}
              {!historyReady
                ? '版本历史尚未成功读取'
                : currentVersion
                  ? `对应已发布版本 v${currentVersion.version_no}`
                  : '尚无对应版本快照（该类型可能早于版本机制建立，下次发布会自动补上）'}
            </div>
          </div>
        )}

        {/* Shared immutable snapshots: the same reader as ObjectType detail. */}
        {verRid && (
          <section>
            <h3>统一版本历史</h3>
            <VersionHistory
              key={identity}
              rid={verRid}
              currentChecksum={activeChecksum}
              refreshKey={historyRefresh}
              onLoaded={historyLoaded}
              onReset={historyReset}
              renderActions={(v) => (
                <span className="mp-publication-actions">
                  <button
                    className="mp-onto-btn"
                    onClick={() => editDiff('against', v.rid)}
                  >
                    设为对比
                  </button>
                  <button
                    className="mp-onto-btn"
                    onClick={() => editDiff('base', v.rid)}
                  >
                    设为基准
                  </button>
                  <button
                    className="mp-onto-btn"
                    disabled={v.checksum === activeChecksum}
                    onClick={() => editRollback(v.rid)}
                  >
                    回滚到此版
                  </button>
                </span>
              )}
            />
          </section>
        )}
        {/* ③ 发布新版本（同族 = 旧版下线但留史） */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">发布新版本</div>
          <div className="mp-text-xs mp-text-2">
            同族（同 tenant + slug，如 ...deal.v1 → ...deal.v2）发布后，旧 rid
            下线， 其定义仍从版本历史完整回读；不同 slug
            则是独立副本，源类型不受影响。
          </div>
          <label>
            发布方式{' '}
            <select
              aria-label="发布方式"
              value={branchMode}
              onChange={(e) => {
                if (mutation.locked()) return;
                invalidate();
                setBranchMode(e.target.value);
                setBranchEdited(false);
                setBranchRid('');
                setCopySlug('');
              }}
            >
              <option value="version">同族新版本（旧 RID 下线）</option>
              <option value="copy">独立副本（保留源类型）</option>
            </select>
          </label>
          {branchMode === 'copy' && (
            <label>
              副本机器名{' '}
              <input
                aria-label="副本机器名"
                value={copySlug}
                onChange={(e) => {
                  if (mutation.locked()) return;
                  invalidate();
                  setCopySlug(e.target.value);
                  const p = verRid.split('.');
                  p[p.length - 2] = e.target.value;
                  p[p.length - 1] = 'v1';
                  setBranchRid(p.join('.'));
                }}
              />
            </label>
          )}
          <p className="mp-text-xs">
            将使用标识 {branchRid || '请指定'}；可在高级标识中调整真实 RID。
          </p>
          <div className="mp-gap-2 mp-flex-center">
            <input
              type="text"
              placeholder="新版本 rid：ont.<租户>.obj.<域>.<slug>.vN"
              value={branchRid}
              aria-label="高级新版本 RID"
              onChange={(e) => editBranch(e.target.value)}
              className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
            />
            <button
              type="button"
              onClick={() => void doBranch()}
              disabled={!!busy || !live || !!typesError || !branchRid.trim()}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <GitBranch className="mp-icon-12" />
                {busy === 'branch'
                  ? '发布中…'
                  : branchMode === 'copy'
                    ? '创建独立副本'
                    : '发布新版本'}
              </span>
            </button>
          </div>
        </div>

        {/* ④ 对比差异（两侧都可填版本快照 rid → 可重现） */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">对比差异</div>
          <div className="mp-text-xs mp-text-2">
            两侧都可以是版本快照 rid（ont.&lt;租户&gt;.ver.&lt;slug&gt;.vN）——
            快照不可变，同一对输入结果可重现。
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <label>
              基准快照{' '}
              <select
                aria-label="基准快照"
                value={diffBase}
                onChange={(e) => editDiff('base', e.target.value)}
              >
                <option value="">当前类型定义</option>
                {versions.map((v) => (
                  <option key={v.rid} value={v.rid}>
                    v{v.version_no} ·{' '}
                    {String(v.definition.display_name || v.rid)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              对比快照{' '}
              <select
                aria-label="对比快照"
                value={diffAgainst}
                onChange={(e) => editDiff('against', e.target.value)}
              >
                <option value="">选择版本快照</option>
                {versions.map((v) => (
                  <option key={v.rid} value={v.rid}>
                    v{v.version_no} ·{' '}
                    {String(v.definition.display_name || v.rid)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <input
              type="text"
              placeholder="基准 rid（默认当前类型）"
              value={diffBase}
              onChange={(e) => editDiff('base', e.target.value)}
              className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
            />
            <input
              type="text"
              placeholder="对比 rid（against）"
              value={diffAgainst}
              onChange={(e) => editDiff('against', e.target.value)}
              className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
            />
            <button
              type="button"
              onClick={() => void doDiff()}
              disabled={!!busy}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <GitCompare className="mp-icon-12" />
                {busy === 'diff' ? '对比中…' : '对比差异'}
              </span>
            </button>
          </div>
          {diffResult && (
            <div className="mp-border mp-py-2 mp-px-3 mp-bg-1 mp-rounded">
              <div className="mp-fw-600 mp-mb-2 mp-text-sm">Diff 结果</div>
              {Object.entries(diffResult).map(([k, val]) => (
                <div
                  key={k}
                  className="mp-flex mp-mb-1 mp-text-sm mp-gap-2 mp-onto-baseline"
                >
                  <span className="mp-text-2 mp-shrink-0 mp-onto-diff-key">
                    {DIFF_LABEL[k] ?? k}
                  </span>
                  <span
                    className={`mp-break-all ${DIFF_VALUE_CLASS[k] ?? 'mp-text-1'}${k.endsWith('_rid') ? ' mp-mono' : ''}`}
                  >
                    {Array.isArray(val)
                      ? val.length > 0
                        ? val.map(String).join('、')
                        : '（无）'
                      : typeof val === 'boolean'
                        ? val
                          ? '是'
                          : '否'
                        : String(val ?? '—')}
                  </span>
                </div>
              ))}
              {diffResult.has_changes === false && (
                <div className="mp-mt-1 mp-text-xs mp-text-2">
                  两版本属性定义一致
                </div>
              )}
            </div>
          )}
        </div>

        {/* ⑤ 回滚 —— 范围显式声明（模型 / 数据 / 补偿三层分家） */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">回滚模型定义</div>
          <div className="mp-text-xs mp-text-2">
            只回滚模型定义（schema）；不动实例数据，也不补偿已发生的副作用。回滚本身也是一次
            发布（会写新快照），因此可以再回滚回来。
          </div>
          <label>
            恢复模型快照{' '}
            <select
              aria-label="恢复模型快照"
              value={rollbackFrom}
              onChange={(e) => editRollback(e.target.value)}
            >
              <option value="">选择版本快照</option>
              {versions.map((v) => (
                <option key={v.rid} value={v.rid}>
                  v{v.version_no} · {String(v.definition.display_name || v.rid)}
                </option>
              ))}
            </select>
          </label>
          <div className="mp-gap-2 mp-flex-center">
            <input
              type="text"
              placeholder="回滚来源：版本快照 rid（或同族旧版本类型 rid）"
              value={rollbackFrom}
              onChange={(e) => editRollback(e.target.value)}
              className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
            />
            <button
              type="button"
              onClick={() => void doRollback()}
              disabled={!!busy || !live || !rollbackFrom}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <Undo2 className="mp-icon-12" />
                {busy === 'rollback' ? '回滚中…' : '回滚'}
              </span>
            </button>
          </div>
        </div>

        {/* ⑥ 存量适配（ADR-0082）—— 发布后对存量实例的声明式迁移：评估 → 执行 → 记录 */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">存量适配（数据迁移）</div>
          <div className="mp-text-xs mp-text-2">
            基线 =
            家族上一条版本快照；评估只读、给真实影响计数与计划草案。默认不丢数据：
            删除属性默认<b>保留键</b>（显式选删除才物理移除，不可恢复）；format
            仅无损转换； 主键变更冲突/缺失时整单拒执行。
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <button
              type="button"
              onClick={() => void doAssess()}
              disabled={!!busy || !verRid}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <DatabaseZap className="mp-icon-12" />
                {busy === 'assess' ? '评估中…' : '评估影响'}
              </span>
            </button>
            {assessment && plan && (
              <button
                type="button"
                onClick={() => void doRunMigration()}
                disabled={!!busy}
                className="mp-onto-btn mp-onto-btn--lg mp-onto-btn--primary"
              >
                <span className="mp-inline-flex mp-items-center mp-gap-1">
                  <ArrowRightLeft className="mp-icon-12" />
                  {busy === 'migrate' ? '迁移中…' : '执行迁移'}
                </span>
              </button>
            )}
          </div>

          {assessment && plan && (
            <div className="mp-border mp-py-2 mp-px-3 mp-bg-1 mp-rounded mp-flex-col mp-gap-2">
              <div className="mp-fw-600 mp-text-sm">
                评估结果
                <span className="mp-text-xs mp-text-2">
                  {' '}
                  （{shortRid(assessment.baseline_rid, 18)} → 当前生效）
                </span>
              </div>
              {assessment.changes.length === 0 && (
                <div className="mp-text-xs mp-text-2">
                  模型与上一版一致，无破坏性变更；仅当家族内有旧版本残留实例时才需重挂。
                </div>
              )}
              {assessment.changes.length > 0 && (
                <div className="mp-flex-col mp-gap-1">
                  {assessment.changes.map((ch) => (
                    <div
                      key={ch}
                      className="mp-text-xs mp-text-warning mp-break-all"
                    >
                      · {ch}
                    </div>
                  ))}
                </div>
              )}
              <div className="mp-flex mp-gap-3 mp-text-xs mp-flex-wrap">
                <span>
                  受影响实例 <b>{assessment.counts.instances_affected ?? 0}</b>
                </span>
                <span>
                  待重挂 <b>{assessment.counts.reattach_pending ?? 0}</b>
                </span>
                <span>
                  PK 冲突{' '}
                  <b className="mp-text-danger">
                    {assessment.counts.pk_conflicts ?? 0}
                  </b>
                  {' · '}缺失{' '}
                  <b className="mp-text-danger">
                    {assessment.counts.pk_missing ?? 0}
                  </b>
                </span>
              </div>

              {Object.keys(assessment.counts.dangling ?? {}).length > 0 && (
                <div className="mp-flex-col mp-gap-1">
                  <div className="mp-text-xs mp-fw-600">
                    悬空属性键（迁移前仍在实例数据里）
                  </div>
                  {Object.entries(assessment.counts.dangling ?? {}).map(
                    ([rid, n]) => (
                      <div
                        key={rid}
                        className="mp-flex mp-gap-2 mp-text-xs mp-onto-baseline"
                      >
                        <span className="mp-mono mp-text-2 mp-break-all">
                          {rid}
                        </span>
                        <span className="mp-text-2 mp-shrink-0">
                          {n} 条实例
                        </span>
                        {plan.renames[rid] && (
                          <span className="mp-text-success mp-shrink-0">
                            → 按同名 slug 重命名到{' '}
                            {shortRid(plan.renames[rid], 16)}
                          </span>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}

              {(plan.drops.props.length > 0 || plan.pk_rederive) && (
                <div className="mp-flex mp-gap-2 mp-flex-wrap mp-items-center mp-text-xs">
                  {plan.drops.props.length > 0 && (
                    <label className="mp-flex mp-items-center mp-gap-1">
                      无后继属性处置
                      <select
                        disabled={!!busy}
                        className="mp-onto-input"
                        value={plan.drops.policy}
                        onChange={(e) => {
                          if (mutation.locked()) return;
                          setPlan({
                            ...plan,
                            drops: {
                              ...plan.drops,
                              policy: e.target.value as 'preserve' | 'drop',
                            },
                          });
                        }}
                      >
                        <option value="preserve">
                          保留键（默认，不丢数据）
                        </option>
                        <option value="drop">删除键（不可恢复）</option>
                      </select>
                    </label>
                  )}
                  {plan.pk_rederive &&
                    (assessment.counts.pk_missing ?? 0) > 0 && (
                      <label className="mp-flex mp-items-center mp-gap-1">
                        PK 缺失实例
                        <select
                          disabled={!!busy}
                          className="mp-onto-input"
                          value={plan.pk_rederive.on_missing}
                          onChange={(e) => {
                            if (mutation.locked()) return;
                            setPlan({
                              ...plan,
                              pk_rederive: plan.pk_rederive
                                ? {
                                    ...plan.pk_rederive,
                                    on_missing: e.target.value as
                                      | 'abort'
                                      | 'skip',
                                  }
                                : null,
                            });
                          }}
                        >
                          <option value="abort">整单中止（默认）</option>
                          <option value="skip">跳过这些实例并报告</option>
                        </select>
                      </label>
                    )}
                </div>
              )}

              {plan.drops.policy === 'drop' && plan.drops.props.length > 0 && (
                <div className="mp-text-xs mp-text-danger">
                  ⚠ 删除策略将物理移除 {plan.drops.props.length} 个属性的存量键
                  —— 不可恢复。
                </div>
              )}
              {assessment.warnings.length > 0 && (
                <div className="mp-flex-col mp-gap-1">
                  {assessment.warnings.map((w) => (
                    <div
                      key={w}
                      className="mp-text-xs mp-text-warning mp-break-all"
                    >
                      · {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {runsError && (
            <div role="alert">
              {runsError}
              <button onClick={() => void loadDetail(verRid)}>
                重试迁移记录
              </button>
            </div>
          )}
          {runs.length > 0 && (
            <div className="mp-flex-col mp-gap-1">
              <div className="mp-text-xs mp-fw-600">迁移记录（跨回滚保留）</div>
              {runs.map((r) => (
                <div
                  key={r.run_id}
                  className="mp-flex mp-gap-2 mp-text-xs mp-onto-baseline"
                >
                  <Tag
                    size="small"
                    type={r.kind === 'reattach' ? 'light' : 'solid'}
                  >
                    {r.kind === 'reattach' ? '发布携带' : '计划执行'}
                  </Tag>
                  <span className="mp-text-2 mp-shrink-0">
                    {r.created_at?.slice(0, 19).replace('T', ' ') ?? '—'} ·{' '}
                    {r.author || '—'}
                  </span>
                  <span className="mp-mono mp-text-2 mp-break-all">
                    {shortRid(r.class_rid, 18)}
                  </span>
                  <span className="mp-text-2 mp-break-all">
                    {Object.entries(r.counts)
                      .map(([k, v]) => {
                        if (Array.isArray(v)) return `${k}×${v.length}`;
                        if (v !== null && typeof v === 'object')
                          return `${k}×${Object.keys(v).length}`;
                        return `${k}=${String(v)}`;
                      })
                      .join(' · ') || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {msg && (
          <div className="mp-text-sm mp-text-success mp-py-2 mp-px-3 mp-rounded mp-onto-note-success">
            {msg}
          </div>
        )}
        {err && (
          <div className="mp-break-all mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-rounded mp-onto-note-danger">
            {err}
          </div>
        )}

        {types.length === 0 && !typesError && (
          <EmptyState
            illustration="no-content"
            title="还没有对象类型"
            desc="先在语义模型里创建类型。"
          />
        )}
      </fieldset>
    </>
  );
}
