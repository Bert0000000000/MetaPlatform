import { useCallback, useEffect, useState } from 'react';
import { Tag } from '@douyinfe/semi-ui';
import { GitBranch, GitCompare, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  branchObjectType,
  diffObjectTypes,
  errDetailText,
  getObjectType,
  listObjectTypes,
  listVersions,
  rollbackObjectType,
  type KernelObjectType,
  type KernelVersion,
} from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
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

const propCount = (v: KernelVersion): number => {
  const props = (v.definition ?? {}).properties;
  return Array.isArray(props) ? props.length : 0;
};

const shortRid = (rid: string, n = 14): string => (rid.length > n ? `${rid.slice(0, n)}…` : rid);

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
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [verRid, setVerRid] = useState('');
  const [live, setLive] = useState<KernelObjectType | null>(null);
  const [versions, setVersions] = useState<KernelVersion[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [branchRid, setBranchRid] = useState('');
  const [diffBase, setDiffBase] = useState('');
  const [diffAgainst, setDiffAgainst] = useState('');
  const [diffResult, setDiffResult] = useState<Record<string, unknown> | null>(null);
  const [rollbackFrom, setRollbackFrom] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const reloadTypes = useCallback(async () => {
    try {
      const ts = await listObjectTypes();
      setTypes(ts);
      setVerRid((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : (ts[0]?.rid ?? '')));
    } catch {
      setTypes([]);
    }
  }, []);

  useEffect(() => {
    void reloadTypes();
  }, [reloadTypes]);

  const loadDetail = useCallback(async (rid: string) => {
    if (!rid) {
      setLive(null);
      setVersions([]);
      return;
    }
    setDetailBusy(true);
    try {
      const [ot, vs] = await Promise.all([getObjectType(rid), listVersions(rid)]);
      setLive(ot);
      setVersions(vs);
    } catch (e) {
      setLive(null);
      setVersions([]);
      setErr(errDetailText(e, '加载版本历史失败'));
    } finally {
      setDetailBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDetail(verRid);
  }, [verRid, loadDetail]);

  /** 用户主动切换类型才清提示；发布/回滚后的自动重载不清（否则成功消息被吞掉）。 */
  const pickType = (rid: string) => {
    setVerRid(rid);
    setErr('');
    setMsg('');
    setDiffResult(null);
    setRollbackFrom('');
  };

  /** 草稿 page 的 publish 是 POST /object-types/wip/{rid}/apply；此处是**已发布类型**的版本操作。 */
  const doBranch = async () => {
    if (!verRid) { setErr('请先选择类型'); return; }
    if (!branchRid.trim()) {
      setErr('请填写新版本 rid（ont.<租户>.obj.<域>.<slug>.vN），同族 = 发布新版本');
      return;
    }
    setBusy('branch'); setErr(''); setMsg('');
    try {
      const ot = await branchObjectType(verRid, branchRid.trim());
      setMsg(`发布成功：${ot.rid}（${ot.display_name}）· 原 ${verRid} 已下线，定义仍可从版本历史回读`);
      toast('发布成功', 'success');
      setBranchRid('');
      await reloadTypes();
      // 同族发布后旧 rid 已下线：选中态跟随新版本，否则选择器会回落到第一个类型
      setVerRid(ot.rid);
    } catch (e) {
      setErr(errDetailText(e, '发布新版本失败'));
    } finally {
      setBusy('');
    }
  };

  const doDiff = async () => {
    const base = diffBase.trim() || verRid;
    const against = diffAgainst.trim();
    if (!base || !against) { setErr('对比差异需要基准 rid 与对比 rid'); return; }
    if (base === against) { setErr('基准与对比 rid 不能相同'); return; }
    setBusy('diff'); setErr(''); setMsg('');
    try {
      setDiffResult(await diffObjectTypes(base, against));
    } catch (e) {
      setErr(errDetailText(e, '对比差异失败'));
    } finally {
      setBusy('');
    }
  };

  const doRollback = async () => {
    if (!verRid) { setErr('请先选择类型'); return; }
    if (!rollbackFrom.trim()) { setErr('请选择回滚来源（版本历史的「回滚到此版」或手填 rid）'); return; }
    if (!window.confirm(
      `把 ${verRid} 的模型定义回滚为 ${rollbackFrom.trim()}？\n\n`
      + '回滚范围：只回滚模型定义（schema）。\n'
      + '不回滚：实例数据、关系实例。\n'
      + '不补偿：已发生的 Action 副作用 / 外联写入。',
    )) return;
    setBusy('rollback'); setErr(''); setMsg('');
    try {
      const ot = await rollbackObjectType(verRid, rollbackFrom.trim());
      setMsg(`回滚成功：${ot.rid} 已恢复为 ${rollbackFrom.trim()} 的模型定义（数据未动）`);
      toast('回滚成功', 'success');
      await loadDetail(verRid);
    } catch (e) {
      setErr(errDetailText(e, '回滚失败'));
    } finally {
      setBusy('');
    }
  };

  const currentVersion = versions.find((v) => !!live?.checksum && v.checksum === live.checksum);

  return (
    <>
      <PageHeader
        title="版本与发布"
        desc="草稿 → 已发布版本 → 当前生效 · 版本 = 不可变定义快照（唯一权威来源）"
        actions={
          <button
            type="button"
            className="mp-onto-btn"
            disabled={detailBusy}
            onClick={() => void loadDetail(verRid)}
          >
            <span className="mp-inline-flex mp-items-center mp-gap-1">
              <RefreshCw className="mp-icon-12" />
              刷新
            </span>
          </button>
        }
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
            {types.map((ot) => (
              <option key={ot.rid} value={ot.rid}>
                {ot.display_name || ot.rid}
              </option>
            ))}
          </select>
        </div>

        {/* ① 当前生效 —— 家族中 checksum 与此一致的那条快照 */}
        {live && (
          <div className="mp-border mp-rounded mp-py-2 mp-px-3 mp-flex-col mp-gap-1">
            <div className="mp-fw-600 mp-text-sm">当前生效</div>
            <div className="mp-text-sm mp-break-all">
              {live.display_name || '（无显示名）'} · <span className="mp-mono">{live.rid}</span>
            </div>
            <div className="mp-text-xs mp-text-2">
              定义指纹 <span className="mp-mono">{live.checksum || '—'}</span> · 属性{' '}
              {live.properties.length} 个 ·{' '}
              {currentVersion
                ? `对应已发布版本 v${currentVersion.version_no}`
                : '尚无对应版本快照（该类型可能早于版本机制建立，下次发布会自动补上）'}
            </div>
          </div>
        )}

        {/* ② 已发布版本 —— 不可变定义快照 */}
        <div className="mp-border mp-rounded mp-py-2 mp-px-3 mp-flex-col mp-gap-2">
          <div className="mp-fw-600 mp-text-sm">
            已发布版本
            <span className="mp-text-xs mp-text-2"> （{versions.length} 个 · 按版本号升序）</span>
          </div>
          {versions.length === 0 && (
            <div className="mp-text-xs mp-text-2">
              该家族还没有版本快照。发布新版本或应用草稿后会自动写入。
            </div>
          )}
          {versions.map((v) => (
            <div key={v.rid} className="mp-flex mp-gap-2 mp-text-sm mp-onto-baseline">
              <Tag size="small" type={v.checksum === live?.checksum ? 'solid' : 'light'}>
                v{v.version_no}
              </Tag>
              <span className="mp-mono mp-text-2 mp-shrink-0">{shortRid(v.rid, 20)}</span>
              <span className="mp-text-2">
                属性 {propCount(v)} · 依赖 {v.dependencies.length} · {v.author || '—'} ·{' '}
                {v.created_at?.slice(0, 19).replace('T', ' ') ?? '—'}
              </span>
              {v.checksum === live?.checksum && <Tag size="small" type="light">当前生效</Tag>}
              <span className="mp-flex mp-gap-1">
                <button
                  type="button"
                  className="mp-onto-btn mp-onto-btn--xs"
                  onClick={() => setDiffAgainst(v.rid)}
                >
                  设为对比
                </button>
                <button
                  type="button"
                  className="mp-onto-btn mp-onto-btn--xs"
                  onClick={() => setDiffBase(v.rid)}
                >
                  设为基准
                </button>
                <button
                  type="button"
                  className="mp-onto-btn mp-onto-btn--xs"
                  disabled={v.checksum === live?.checksum}
                  onClick={() => setRollbackFrom(v.rid)}
                >
                  回滚到此版
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* ③ 发布新版本（同族 = 旧版下线但留史） */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">发布新版本</div>
          <div className="mp-text-xs mp-text-2">
            同族（同 tenant + slug，如 ...deal.v1 → ...deal.v2）发布后，旧 rid 下线，
            其定义仍从版本历史完整回读；不同 slug 则是独立副本，源类型不受影响。
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <input
              type="text"
              placeholder="新版本 rid：ont.<租户>.obj.<域>.<slug>.vN"
              value={branchRid}
              onChange={(e) => setBranchRid(e.target.value)}
              className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
            />
            <button
              type="button"
              onClick={() => void doBranch()}
              disabled={busy === 'branch'}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <GitBranch className="mp-icon-12" />
                {busy === 'branch' ? '发布中…' : '发布新版本'}
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
            <input
              type="text"
              placeholder="基准 rid（默认当前类型）"
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
            <button
              type="button"
              onClick={() => void doDiff()}
              disabled={busy === 'diff'}
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
                <div key={k} className="mp-flex mp-mb-1 mp-text-sm mp-gap-2 mp-onto-baseline">
                  <span className="mp-text-2 mp-shrink-0 mp-onto-diff-key">
                    {DIFF_LABEL[k] ?? k}
                  </span>
                  <span
                    className={`mp-break-all ${DIFF_VALUE_CLASS[k] ?? 'mp-text-1'}${k.endsWith('_rid') ? ' mp-mono' : ''}`}
                  >
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
        </div>

        {/* ⑤ 回滚 —— 范围显式声明（模型 / 数据 / 补偿三层分家） */}
        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">回滚模型定义</div>
          <div className="mp-text-xs mp-text-2">
            只回滚模型定义（schema）；不动实例数据，也不补偿已发生的副作用。回滚本身也是一次
            发布（会写新快照），因此可以再回滚回来。
          </div>
          <div className="mp-gap-2 mp-flex-center">
            <input
              type="text"
              placeholder="回滚来源：版本快照 rid（或同族旧版本类型 rid）"
              value={rollbackFrom}
              onChange={(e) => setRollbackFrom(e.target.value)}
              className="mp-onto-input mp-onto-input--lg mp-onto-ver-input"
            />
            <button
              type="button"
              onClick={() => void doRollback()}
              disabled={busy === 'rollback'}
              className="mp-onto-btn mp-onto-btn--lg"
            >
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <Undo2 className="mp-icon-12" />
                {busy === 'rollback' ? '回滚中…' : '回滚'}
              </span>
            </button>
          </div>
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

        {types.length === 0 && (
          <EmptyState illustration="no-content" title="还没有对象类型" desc="先在语义模型里创建类型。" />
        )}
      </div>
    </>
  );
}
