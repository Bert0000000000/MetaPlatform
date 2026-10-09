import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@mate/shared';
import {
  applySchemaWip,
  assessMigration,
  discardSchemaWip,
  extractDestructiveConfirm,
  getObjectType,
  listObjectTypes,
  listSchemaWip,
  validateObjectTypeModel,
  type DestructiveConfirmDetail,
  type KernelObjectType,
  type MigrationAssessment,
  type ModelPreflight,
  type SchemaWipEntry,
} from '@/api/ont/kernel';
import { resourceError } from '../hooks/resourceErrors';
import { resourceUrl, safeReturnTo } from '../hooks/resourceContext';
import VersionHistory from './VersionHistory';
import { useMutationLock, type MutationLock } from '../hooks/mutationLock';
import { objectTypeFamily } from '../hooks/objectTypeFamily';
import { editorIdentity } from '../hooks/editorSession';

/** One tenant-scoped WIP list; stored base_checksum is never overridden. */
export default function SchemaWipCard({
  typeRef,
  onPublished,
  mutationLock,
}: {
  typeRef?: string;
  onPublished?: (type: KernelObjectType) => void;
  mutationLock?: MutationLock;
} = {}) {
  const standaloneLock = useMutationLock();
  const mutation = mutationLock ?? standaloneLock;
  const command = useRef<symbol | null>(null);
  const { user } = useAuth();
  const identity = editorIdentity(user);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [params, setParams] = useSearchParams();
  const requested =
    typeRef ?? (params.get('typeRef') || params.get('class') || '');
  const [wips, setWips] = useState<SchemaWipEntry[]>([]),
    [selected, setSelected] = useState(requested);
  const [loading, setLoading] = useState(true),
    [listError, setListError] = useState('');
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [preflight, setPreflight] = useState<ModelPreflight | null>(null);
  const [impact, setImpact] = useState<MigrationAssessment | null>(null);
  const [newType, setNewType] = useState(false),
    [checkedRevision, setCheckedRevision] = useState('');
  const [confirm, setConfirm] = useState<DestructiveConfirmDetail | null>(null),
    [confirmInput, setConfirmInput] = useState('');
  const [published, setPublished] = useState<{
    rid: string;
    checksum?: string;
  } | null>(null);
  const request = useRef(0),
    listRequest = useRef(0);
  const draft = wips.find((w) => w.rid === selected);
  const revision = draft ? JSON.stringify(draft) : '';
  const current = useRef(revision);
  current.current = revision;
  const scope = JSON.stringify([identity, requested, selected]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const reset = useCallback(() => {
    request.current++;
    if (!command.current) setBusy('');
    setPreflight(null);
    setImpact(null);
    setNewType(false);
    setCheckedRevision('');
    setConfirm(null);
    setConfirmInput('');
    setError('');
    setMessage('');
    setPublished(null);
  }, []);
  const reload = useCallback(async (internalRead = false) => {
    if (mutation.locked() && !internalRead) return;
    const n = ++listRequest.current;
    const identityAtRead = currentIdentity.current;
    const fresh = () => n === listRequest.current && identityAtRead === currentIdentity.current;
    reset();
    setLoading(true);
    setListError('');
    try {
      const rows = await listSchemaWip();
      if (!fresh()) return;
      setWips(rows);
      setSelected((cur) => cur || requested || rows[0]?.rid || '');
    } catch (e) {
      if (fresh()) setListError(resourceError(e));
    } finally {
      if (fresh()) setLoading(false);
    }
  }, [reset, mutation.locked]);
  useEffect(() => {
    setWips([]);
    reset();
    // Identity changes may read fresh WIP, but cannot release an outstanding write.
    void reload(true);
    return () => {
      listRequest.current++;
      request.current++;
    };
  }, [reload, identity, reset]);
  useEffect(() => {
    if (requested) {
      reset();
      setSelected(requested);
    }
  }, [requested, reset]);
  const pick = (rid: string) => {
    if (mutation.locked()) return;
    reset();
    setSelected(rid);
    const next = new URLSearchParams(params);
    next.set('typeRef', rid);
    setParams(next);
  };
  const valid =
    !!draft &&
    checkedRevision === revision &&
    !!preflight?.valid &&
    (!!impact || newType);
  const precheck = async () => {
    if (!draft || mutation.locked()) return;
    reset();
    const n = ++request.current,
      rev = revision;
    const fresh = () =>
      n === request.current && rev === current.current && scope === currentScope.current;
    setBusy('validate');
    try {
      const checked = await validateObjectTypeModel(draft.payload);
      if (!fresh()) return;
      setPreflight(checked);
      if (!checked.valid) return;
      // A complete active read must succeed before absence can mean a new family.
      const active = await listObjectTypes();
      if (!fresh()) return;
      let existing = active.some(
        (t) => objectTypeFamily(t.rid) === objectTypeFamily(draft.rid),
      );
      if (!existing) {
        // Archived types are omitted from the active list. A successful exact read is
        // still an instance target; only an explicit 404 proves this RID is absent.
        try {
          await getObjectType(draft.rid);
          existing = true;
        } catch (e) {
          if (
            (e as { response?: { status?: number } })?.response?.status !== 404
          )
            throw e;
        }
        if (!fresh()) return;
      }
      if (existing) {
        const result = await assessMigration(draft.rid, {
          targetPayload: draft.payload,
        });
        if (!fresh()) return;
        setImpact(result);
      } else setNewType(true);
      setCheckedRevision(rev);
    } catch (e) {
      if (fresh()) setError(`校验或影响读取失败 · ${resourceError(e)}`);
    } finally {
      if (fresh()) setBusy('');
    }
  };
  const apply = async (name = '') => {
    if (!draft || !valid || busy || loading) return;
    const release = mutation.acquire();
    if (!release) return;
    const token = Symbol();
    command.current = token;
    const n = ++request.current,
      rev = revision;
    const fresh = () =>
      n === request.current && rev === current.current && scope === currentScope.current;
    setBusy('apply');
    setError('');
    setMessage('');
    try {
      // A second editor can replace the tenant WIP while this review is open.
      // Re-read the actual saved revision before applying; never rewrite its baseline.
      const reviewN = ++listRequest.current;
      const stored = await listSchemaWip();
      if (!fresh() || reviewN !== listRequest.current) return;
      if (JSON.stringify(stored.find((w) => w.rid === draft.rid)) !== rev) {
        reset();
        setWips(stored);
        setError('草稿已变化，请重新校验后发布');
        return;
      }
      // Never pass live checksum or assessment.to_checksum: backend checks the stored baseline.
      const out = await applySchemaWip(draft.rid, name);
      if (!fresh()) return;
      setCheckedRevision('');
      setConfirm(null);
      setConfirmInput('');
      setMessage(`发布成功：${out.display_name} · ${out.rid}`);
      setPublished(out);
      onPublished?.(out);
      const listN = ++listRequest.current;
      try {
        const rows = await listSchemaWip();
        if (fresh() && listN === listRequest.current) setWips(rows);
      } catch (e) {
        if (fresh()) setListError(`stale · ${resourceError(e)}`);
      }
    } catch (e) {
      if (!fresh()) return;
      const dc = extractDestructiveConfirm(e);
      if (dc) {
        setConfirm(dc);
        setConfirmInput('');
      } else setError(resourceError(e));
    } finally {
      if (command.current === token) {
        command.current = null;
        setBusy('');
      }
      release();
    }
  };
  const discard = async () => {
    if (
      mutation.locked() || busy || loading || !draft ||
      !window.confirm(`丢弃草稿 ${draft.rid}？该操作不可恢复。`)
    )
      return;
    const release = mutation.acquire();
    if (!release) return;
    const token = Symbol();
    command.current = token;
    reset();
    const n = ++request.current,
      rev = revision;
    const fresh = () =>
      n === request.current && rev === current.current && scope === currentScope.current;
    setBusy('discard');
    try {
      await discardSchemaWip(draft.rid);
      if (fresh()) await reload(true);
    } catch (e) {
      if (fresh()) setError(resourceError(e));
    } finally {
      if (command.current === token) {
        command.current = null;
        setBusy('');
      }
      release();
    }
  };
  const returnTo = safeReturnTo(params.get('returnTo'));
  return (
    <section className="mp-gov-card mp-publication">
      <div className="mp-publication-toolbar">
        <h3>草稿发布</h3>
        <label>
          目标草稿{' '}
          <select
            aria-label="目标草稿"
            value={selected}
            disabled={mutation.pending}
            onChange={(e) => pick(e.target.value)}
          >
            <option value="">选择草稿</option>
            {selected && !draft && (
              <option value={selected}>{selected}（无当前草稿）</option>
            )}
            {wips.map((w) => (
              <option key={w.rid} value={w.rid}>
                {String(w.payload.display_name || w.rid)}
              </option>
            ))}
          </select>
        </label>
        <button className="mp-onto-btn" disabled={mutation.pending} onClick={() => void reload()}>
          刷新草稿
        </button>
        {returnTo && <Link to={returnTo}>返回模型</Link>}
      </div>
      <ol className="mp-publication-steps" aria-label="发布步骤">
        {['变更清单', '定义校验', '影响预览', '确认发布', '结果'].map(
          (s, i) => (
            <li
              key={s}
              aria-current={
                (published ? 4 : valid ? 3 : preflight ? 2 : 0) === i
                  ? 'step'
                  : undefined
              }
            >
              <span>{i + 1}</span>
              {s}
            </li>
          ),
        )}
      </ol>
      {listError && (
        <div role="alert">
          {listError}{' '}
          <button onClick={() => void reload()}>重试草稿读取</button>
        </div>
      )}
      {loading && <p>加载草稿…</p>}
      {error && (
        <div role="alert" className="mp-text-danger">
          {error}
        </div>
      )}
      {message && <div role="status">{message}</div>}
      {!loading && !listError && !draft && !published && (
        <p>
          {selected
            ? '请求的类型没有当前草稿，未自动选择其他类型。'
            : '当前没有待发布的 Schema WIP'}
        </p>
      )}
      {draft && (
        <>
          <h4>{String(draft.payload.display_name || draft.rid)}</h4>
          <p>
            作者 {draft.author || '—'} · 暂存时间 {draft.created_at || '—'} ·
            模型发布不会执行实例迁移
          </p>
          <div className="mp-publication-review">
            <h4>目标定义</h4>
            <p>{String(draft.payload.description || '未填写描述')}</p>
            <p>
              主键：
              {Array.isArray(draft.payload.primary_key)
                ? draft.payload.primary_key.map(String).join('、') || '未指定'
                : '未指定'}
            </p>
            <table>
              <thead>
                <tr>
                  <th>属性</th>
                  <th>格式</th>
                  <th>必填</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(draft.payload.properties)
                  ? draft.payload.properties
                  : []
                ).map((p: Record<string, unknown>) => (
                  <tr key={String(p.rid)}>
                    <td>{String(p.title || p.rid)}</td>
                    <td>{String(p.format || p.type_id || '—')}</td>
                    <td>{p.nullable ? '否' : '是'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>高级标识与草稿定义</summary>
            <p>
              {draft.rid} · 基线 {draft.base_checksum || '无'}
            </p>
            <pre>{JSON.stringify(draft.payload, null, 2)}</pre>
          </details>
          <Link
            to={resourceUrl(
              `/ontology/model/object-types/${encodeURIComponent(draft.rid)}`,
              draft.rid,
              returnTo,
              params.get('changeRef') || undefined,
            )}
          >
            编辑当前模型
          </Link>
          <div className="mp-publication-actions">
            <button
              className="mp-onto-btn"
              disabled={mutation.pending || !!busy || loading}
              onClick={() => void precheck()}
            >
              校验草稿
            </button>
            <button
              className="mp-onto-btn mp-onto-btn--primary"
              disabled={mutation.pending || !valid || !!busy || loading || !!confirm}
              onClick={() => void apply()}
            >
              确认发布
            </button>
            <button
              className="mp-onto-btn"
              disabled={mutation.pending || !!busy || loading}
              onClick={() => void discard()}
            >
              丢弃
            </button>
          </div>
          {preflight && (
            <div>
              <h4>定义校验：{preflight.valid ? '通过' : '未通过'}</h4>
              {preflight.errors.map((s, i) => (
                <p key={i} className="mp-text-danger">
                  模型错误：{s}
                </p>
              ))}
              {preflight.warnings.map((s, i) => (
                <p key={i}>警告：{s}</p>
              ))}
              {preflight.destructive.map((s, i) => (
                <p key={i} className="mp-text-warning">
                  破坏性：{s}（发布仍需服务端二段确认）
                </p>
              ))}
              {preflight.references.unresolved.map((s, i) => (
                <p key={i}>引用未解析（不阻断）：{s}</p>
              ))}
            </div>
          )}
          {impact && (
            <div>
              <h4>影响预览</h4>
              <p>
                受影响实例 {impact.counts.instances_affected ?? 0} · 待重挂{' '}
                {impact.counts.reattach_pending ?? 0} · PK 冲突{' '}
                {impact.counts.pk_conflicts ?? 0} · PK 缺失{' '}
                {impact.counts.pk_missing ?? 0}
              </p>
              {impact.changes.map((s) => (
                <p key={s}>{s}</p>
              ))}
              {impact.warnings.map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
          )}
          {newType && <p>新类型：已完成现有类型读取，无存量实例迁移目标。</p>}
          {confirm && (
            <div role="alert">
              <h4>破坏性变更：需输入当前生效名称确认</h4>
              {confirm.changes.map((s) => (
                <p key={s}>{s}</p>
              ))}
              <input
                value={confirmInput}
                placeholder={`输入 ${confirm.confirm_with} 以确认`}
                onChange={(e) => setConfirmInput(e.target.value)}
                disabled={mutation.pending || !!busy}
              />
              <button
                disabled={
                  mutation.pending || !valid ||
                  !!busy ||
                  confirmInput.trim() !== confirm.confirm_with
                }
                onClick={() => void apply(confirmInput.trim())}
              >
                重发（确认）
              </button>
              <button
                disabled={mutation.pending || !!busy}
                onClick={() => {
                  if (mutation.locked()) return;
                  setConfirm(null);
                  setConfirmInput('');
                }}
              >
                取消
              </button>
            </div>
          )}
        </>
      )}
      {published && (
        <>
          <Link
            to={resourceUrl(
              '/ontology/governance/releases',
              published.rid,
              returnTo,
              params.get('changeRef') || undefined,
            )}
          >
            查看发布历史与存量适配
          </Link>
          {!onPublished && (
            <VersionHistory
              rid={published.rid}
              currentChecksum={published.checksum}
            />
          )}
        </>
      )}
    </section>
  );
}
