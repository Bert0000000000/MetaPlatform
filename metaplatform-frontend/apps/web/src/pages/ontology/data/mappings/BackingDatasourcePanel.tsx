import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { useAuth } from '@mate/shared';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  listBackingDatasources,
  listObjectTypes,
  syncBackingDatasources,
  type BackingDatasourceSyncResult,
  type KernelBackingDatasource,
  type KernelObjectType,
} from '@/api/ont/kernel';
import { editorIdentity } from '../../hooks/editorSession';
import { resourceUrl, safeReturnTo } from '../../hooks/resourceContext';
import { resourceError } from '../../hooks/resourceErrors';
import { ridTail } from '../../rid';
import SourceMappingEditor, { mappingIsDirty } from './SourceMappingEditor';
import MaterializationSamples from './MaterializationSamples';
import './backing-datasource.css';

/** Source declarations are edits; samples are independent reads; sync uses saved declarations. */
export default function BackingDatasourcePanel() {
  const { user } = useAuth();
  const identity = editorIdentity(user);
  return <MappingSelection key={identity} identity={identity} />;
}
function MappingSelection({ identity }: { identity: string }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requested = params.get('typeRef') || params.get('class') || '';
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const requestedRef = useRef(requested);
  requestedRef.current = requested;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  const selected =
    types.find((type) => type.rid === requested) ||
    (!requested ? types[0] : undefined);
  const load = useCallback(async () => {
    const generation = ++request.current;
    setLoading(true);
    setError('');
    try {
      const actual = await listObjectTypes();
      if (generation !== request.current) return;
      setTypes(actual);
      if (!requestedRef.current && actual.length) {
        const next = new URLSearchParams(paramsRef.current);
        next.set('typeRef', actual[0].rid);
        setParamsRef.current(next, { replace: true });
      }
    } catch (cause) {
      if (generation === request.current) setError(resourceError(cause));
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      ++request.current;
    };
  }, [load]);
  const state = useCallback((value: boolean, pending: boolean) => {
    setDirty(value);
    setBusy(pending);
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const changeType = (rid: string) => {
    if (
      busy ||
      (dirty &&
        !window.confirm(
          '未保存映射将保留在当前会话，尚未提交。是否切换对象类型？',
        ))
    )
      return;
    const next = new URLSearchParams(params);
    next.set('typeRef', rid);
    next.delete('class');
    next.delete('sourceRef');
    setParams(next);
  };
  const back = safeReturnTo(params.get('returnTo'));
  return (
    <div className="mp-mapping-workspace">
      <div className="mp-mapping-toolbar">
        <label className="mp-mapping-type-label">
          对象类型
          <select
            aria-label="对象类型"
            value={selected?.rid || requested}
            disabled={busy || loading}
            onChange={(event) => changeType(event.target.value)}
          >
            {requested && !types.some((type) => type.rid === requested) && (
              <option value={requested}>{requested}</option>
            )}
            {!requested && !types.length && (
              <option value="">选择对象类型</option>
            )}
            {types.map((type) => (
              <option value={type.rid} key={type.rid}>
                {type.display_name || ridTail(type.rid)} · {ridTail(type.rid)}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy} loading={loading} onClick={() => void load()}>
          重读对象类型
        </Button>
        {selected && (
          <Link
            to={resourceUrl(
              '/ontology/explore/objects',
              selected.rid,
              `${location.pathname}${location.search}`,
              params.get('changeRef') || undefined,
            )}
          >
            查看对象
          </Link>
        )}
        {back && <Link to={back}>返回原资源</Link>}
      </div>
      {loading && <p role="status">正在读取对象类型…</p>}
      {error && (
        <p role="alert">
          {types.length ? 'stale · ' : ''}对象类型读取失败 · {error}
        </p>
      )}
      {!loading && !error && !types.length && <p>本体里还没有对象类型</p>}
      {!loading && requested && !selected && (
        <p role="alert">请求的对象类型不可用：{requested}</p>
      )}
      {selected && !error && (
        <SourceWorkspace
          key={`${identity}:${selected.rid}`}
          identity={identity}
          type={selected}
          onState={state}
        />
      )}
    </div>
  );
}
function SourceWorkspace({
  identity,
  type,
  onState,
}: {
  identity: string;
  type: KernelObjectType;
  onState: (dirty: boolean, busy: boolean) => void;
}) {
  const [params, setParams] = useSearchParams();
  const sourceRef = params.get('sourceRef') || '';
  const currentParams = useRef(params);
  currentParams.current = params;
  const currentSetParams = useRef(setParams);
  currentSetParams.current = setParams;
  const [rows, setRows] = useState<KernelBackingDatasource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<BackingDatasourceSyncResult>();
  const [syncError, setSyncError] = useState('');
  const alive = useRef(true);
  const request = useRef(0);
  const command = useRef(0);
  const source =
    sourceRef === 'new'
      ? undefined
      : sourceRef
        ? rows.find((row) => row.rid === sourceRef)
        : rows[0];
  const sourceKey = source?.rid || 'new';
  const unknownSource = !!sourceRef && sourceRef !== 'new' && !source;
  const otherDirty =
    rows.some((row) => mappingIsDirty(identity, type.rid, row.rid)) ||
    mappingIsDirty(identity, type.rid, 'new');
  const dirty = editorDirty || otherDirty;
  const busy = editorBusy || syncing;
  const load = useCallback(async (): Promise<KernelBackingDatasource[]> => {
    const generation = ++request.current;
    setLoading(true);
    setError('');
    try {
      const actual = await listBackingDatasources(type.rid);
      if (!alive.current || generation !== request.current)
        throw new Error('来源读取已被新的请求替代');
      setRows(actual);
      setLoaded(true);
      return actual;
    } catch (cause) {
      if (alive.current && generation === request.current)
        setError(resourceError(cause));
      throw cause;
    } finally {
      if (alive.current && generation === request.current) setLoading(false);
    }
  }, [type.rid]);
  useEffect(() => {
    alive.current = true;
    void load().catch(() => {});
    return () => {
      alive.current = false;
      ++request.current;
      ++command.current;
    };
  }, [load]);
  useEffect(() => {
    if (!loaded || loading || error || sourceRef) return;
    const next = new URLSearchParams(params);
    next.set('sourceRef', sourceKey);
    setParams(next, { replace: true });
  }, [loaded, loading, error, sourceRef, sourceKey, params, setParams]);
  useEffect(() => {
    onState(dirty, busy);
    return () => onState(false, false);
  }, [dirty, busy, onState]);
  const editorState = useCallback((value: boolean, pending: boolean) => {
    setEditorDirty(value);
    setEditorBusy(pending);
  }, []);
  const chooseSource = (value: string) => {
    if (
      busy ||
      (editorDirty &&
        !window.confirm(
          '未保存来源映射将保留在当前会话，尚未提交。是否切换来源？',
        ))
    )
      return;
    const next = new URLSearchParams(params);
    next.set('sourceRef', value);
    setParams(next);
    setNotice('');
  };
  const saved = async (name: string) => {
    const actual = await load();
    const declaration = actual.find((row) => row.name === name);
    if (!declaration) throw new Error('保存后回读未找到来源声明');
    return declaration;
  };
  const complete = (declaration: KernelBackingDatasource) => {
    if (!alive.current) return;
    setNotice('映射已保存并回读');
    const next = new URLSearchParams(currentParams.current);
    next.set('sourceRef', declaration.rid);
    currentSetParams.current(next, { replace: true });
  };
  const sync = async (incremental: boolean) => {
    if (
      !identity ||
      busy ||
      dirty ||
      !loaded ||
      error ||
      !rows.length ||
      unknownSource
    )
      return;
    const generation = ++command.current;
    setSyncing(true);
    setSyncError('');
    setSyncResult(undefined);
    try {
      const result = await syncBackingDatasources(type.rid, incremental);
      if (!alive.current || generation !== command.current) return;
      setSyncResult(result);
      await load();
    } catch (cause) {
      if (alive.current && generation === command.current)
        setSyncError(resourceError(cause));
    } finally {
      if (alive.current && generation === command.current) setSyncing(false);
    }
  };
  return (
    <>
      <div className="mp-mapping-toolbar">
        <label>
          来源绑定
          <select
            aria-label="来源绑定"
            value={sourceRef || sourceKey}
            disabled={busy || loading}
            onChange={(event) => chooseSource(event.target.value)}
          >
            {unknownSource && <option value={sourceRef}>{sourceRef}</option>}
            {rows.map((row) => (
              <option key={row.rid} value={row.rid}>
                {row.name} · {row.table_name}
              </option>
            ))}
            <option value="new">新来源</option>
          </select>
        </label>
        <Button disabled={busy || loading} onClick={() => chooseSource('new')}>
          声明新来源
        </Button>
        <Button
          loading={loading}
          disabled={busy}
          onClick={() => void load().catch(() => {})}
        >
          重载来源绑定
        </Button>
        <Button
          disabled={
            !identity ||
            busy ||
            dirty ||
            loading ||
            !loaded ||
            !!error ||
            !rows.length ||
            unknownSource
          }
          loading={syncing}
          onClick={() => void sync(false)}
        >
          全量同步全部来源
        </Button>
        <Button
          disabled={
            !identity ||
            busy ||
            dirty ||
            loading ||
            !loaded ||
            !!error ||
            !rows.length ||
            unknownSource
          }
          onClick={() => void sync(true)}
        >
          增量同步全部来源
        </Button>
      </div>
      <p className="mp-mapping-muted">
        同步按已保存配置处理当前类型的全部声明来源；未保存映射禁止同步。
      </p>
      {dirty && !editorDirty && (
        <p role="alert">
          其他来源有未保存映射，请返回对应来源保存或丢弃后再同步。
        </p>
      )}
      {loading && <p role="status">正在读取来源绑定…</p>}
      {error && (
        <p role="alert">
          {loaded ? 'stale · ' : ''}来源绑定读取失败 · {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loaded && !rows.length && !loading && (
        <p>该类型尚未声明来源，请填写并保存映射。</p>
      )}
      {loaded && unknownSource && (
        <p role="alert">请求的来源绑定不可用：{sourceRef}</p>
      )}
      {loaded && !unknownSource && (
        <SourceMappingEditor
          key={sourceKey}
          type={type}
          identity={identity}
          source={source}
          sourceKey={sourceKey}
          sources={rows}
          canSave={!error && !loading}
          externalBusy={syncing}
          onState={editorState}
          onSaved={saved}
          onComplete={complete}
        />
      )}
      <section
        className="mp-mapping-card mp-mapping-sync"
        aria-label="同步结果"
      >
        <h3>真实同步结果</h3>
        {syncing && <p role="status">同步请求执行中…</p>}
        {syncError && <p role="alert">同步／结果回读失败 · {syncError}</p>}
        {!syncResult && !syncing && !syncError && <p>尚未同步</p>}
        {syncResult && (
          <>
            <p
              role={
                syncResult.ok && syncResult.total_failed === 0
                  ? 'status'
                  : 'alert'
              }
            >
              {syncResult.ok && syncResult.total_failed === 0
                ? '同步完成'
                : '部分失败'}{' '}
              · 同步 {syncResult.total_synced} · 失败 {syncResult.total_failed}{' '}
              · 删除 {syncResult.total_deleted}
            </p>
            {Object.entries(syncResult.sources).map(([name, result]) => (
              <div key={name}>
                <strong>{name}</strong>
                <p>
                  同步 {result.synced} · 失败 {result.failed} · 删除{' '}
                  {result.deleted}
                </p>
                <p>
                  已处理边界：{result.cursor.ts || '无时间水位'} ·{' '}
                  {result.cursor.pk || '无主键边界'}
                </p>
                {result.failures.map((failure, index) => (
                  <p role="alert" key={index}>
                    {String(failure.pk)} · {failure.error}
                  </p>
                ))}
              </div>
            ))}
          </>
        )}
      </section>
      <MaterializationSamples typeRid={type.rid} />
    </>
  );
}
