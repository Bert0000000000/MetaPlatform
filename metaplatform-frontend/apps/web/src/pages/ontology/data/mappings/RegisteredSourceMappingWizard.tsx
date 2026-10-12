import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listBackingDatasources, syncBackingDatasources, upsertBackingDatasource, type KernelBackingDatasource, type KernelObjectType, type BackingSyncResult } from '@/api/ont/kernel';
import { listBigDataSources, discoverBigDataSchema, testBigDataSourceConnection, type BigDataSource, type SourceSchema } from '@/api/ontology-bigdata';
import { discardEditorInput, readEditorInput, retainEditorInput } from '../../hooks/editorSession';
import './backing-datasource.css';
type RegisteredInput = { sourceId: string; table: string; pkColumn: string; tsColumn: string; mapping: Record<string, string> };

function errorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return detail ? typeof detail === 'string' ? detail : JSON.stringify(detail) : error instanceof Error ? error.message : String(error);
}

export default function RegisteredSourceMappingWizard({ type, identity, externalBusy = false, onState, onSaved }: {
  type: KernelObjectType; identity: string; externalBusy?: boolean;
  onState: (dirty: boolean, busy: boolean) => void;
  onSaved: (name: string) => Promise<void>;
}) {
  const [params] = useSearchParams();
  const key = JSON.stringify([identity, 'registered-source-mapping', type.rid]);
  const initialInput = useRef(readEditorInput<RegisteredInput>(identity, key));
  const [dirty, setDirty] = useState(!!initialInput.current);
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++generation.current; }; }, []);
  const classRid = type.rid;
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [sourceId, setSourceId] = useState(initialInput.current?.sourceId || params.get('source') || '');
  const [schema, setSchema] = useState<SourceSchema | null>(null);
  const [table, setTable] = useState(initialInput.current?.table || '');
  const [pkColumn, setPkColumn] = useState(initialInput.current?.pkColumn || '');
  const [tsColumn, setTsColumn] = useState(initialInput.current?.tsColumn || '');
  const [mapping, setMapping] = useState<Record<string, string>>(initialInput.current?.mapping || {});
  const [confirmed, setConfirmed] = useState(false);
  const [rows, setRows] = useState<KernelBackingDatasource[]>([]);
  const [busy, setBusy] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [run, setRun] = useState<BackingSyncResult | null>(null);
  const source = sources.find(s => s.sourceId === sourceId);
  const objectType = type;
  const selected = schema?.tables.find(t => (t.schema ? `${t.schema}.${t.name}` : t.name) === table);
  const csv = source?.sourceType === 'CSV';
  useEffect(() => { let active = true; void listBigDataSources().then(s => {
    if (!active) return; setSources(s); setSourceId(current => current || s[0]?.sourceId || '');
  }).catch(e => active && setError(errorMessage(e))).finally(() => { if (active) setCatalogLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (dirty) retainEditorInput<RegisteredInput>(identity, key, { sourceId, table, pkColumn, tsColumn, mapping });
    else discardEditorInput(key);
  }, [identity, key, dirty, sourceId, table, pkColumn, tsColumn, mapping]);
  useEffect(() => { onState(dirty, busy); return () => onState(false, false); }, [dirty, busy, onState]);
  useEffect(() => { let active = true; setRows([]); setRun(null); if (classRid) void listBackingDatasources(classRid).then(r => { if (active) setRows(r); }).catch(e => active && setError(errorMessage(e))); return () => { active = false; }; }, [classRid]);
  async function action(work: (current: () => boolean) => Promise<void>) {
    if (busy || externalBusy || !identity) return;
    const request = ++generation.current;
    const current = () => alive.current && generation.current === request;
    setBusy(true); setError(''); setNotice('');
    try { await work(current); } catch (e) { if (current()) setError(errorMessage(e)); } finally { if (current()) setBusy(false); }
  }
  function selectTable(value: string) {
    setTable(value); setConfirmed(false);
    const found = schema?.tables.find(t => (t.schema ? `${t.schema}.${t.name}` : t.name) === value);
    setPkColumn(found?.columns.find(c => c.primary_key)?.name ?? ''); setTsColumn('');
    const suggestion: Record<string, string> = {};
    for (const p of objectType?.properties ?? []) {
      const col = found?.columns.find(c => c.name === p.rid.split('.').at(-1) || c.name === p.title);
      if (col) suggestion[p.rid] = col.name;
    }
    setMapping(suggestion);
  }
  const conflicts = (objectType?.properties ?? []).flatMap(p => {
    const name = mapping[p.rid]; const column = selected?.columns.find(c => c.name === name);
    if (!p.nullable && !name) return [`必填属性未映射：${p.title || p.rid}`];
    if (name && !column) return [`源列不存在：${name}`];
    if (!csv && column?.nullable && !p.nullable) return [`非空冲突：${p.title || p.rid}`];
    if (!csv && column && ['integer', 'int', 'number', 'float', 'decimal'].includes(p.type_id) && !/int|numeric|decimal|real|double/.test(column.type)) return [`类型冲突：${p.title || p.rid}`];
    return [];
  });
  async function save(current: () => boolean) {
    if (!confirmed || !schema || !selected || !pkColumn || conflicts.length) throw new Error('请确认真实字段映射并解决主键、非空和类型冲突');
    const field_mapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
    await upsertBackingDatasource(classRid, { class_rid: classRid, name: `${sourceId}:${table}`, source_id: sourceId, kind: csv ? 'csv' : 'pg_table', table, pk_column: pkColumn, ts_column: csv ? undefined : tsColumn || undefined, field_mapping, priority: 100 });
    if (!current()) return;
    const declarations = await listBackingDatasources(classRid);
    if (!current()) return;
    setRows(declarations);
    await onSaved(sourceId + ':' + table);
    if (!current()) return;
    setDirty(false); discardEditorInput(key); setNotice('服务器预检通过，映射已保存');
  }
  async function sync(incremental: boolean, current: () => boolean) {
    const result = await syncBackingDatasources(classRid, incremental);
    if (!current()) return;
    setRun(result);
    const declarations = await listBackingDatasources(classRid);
    if (!current()) return;
    setRows(declarations);
    if (!result.ok) throw new Error(result.error?.message ?? '同步有失败行，可查看运行记录后重试');
  }
  const history = [...new Map(rows.flatMap(r => r.run_history ?? []).map(r => [r.run_id, r])).values()];
  return <fieldset className="mp-mapping-card mp-mapping-fields" disabled={busy || externalBusy || !identity} onChangeCapture={() => setDirty(true)}>
    <legend>注册数据源接入</legend>
    {dirty && <p role="status">未保存的注册来源映射保留在当前会话；重新打开后请重新验证实际字段。</p>}
    <p>1 连接 → 2 发现字段 → 3 主键与时间列 → 4 确认映射 → 5 服务器预检 → 6 同步</p>
    <Link to="/gov/data/sources">管理全局数据源</Link>
    {catalogLoading && <p role="status">加载目录…</p>}
    {error && <div role="alert">{error}</div>}{notice && <p role="status">{notice}</p>}
    <label>注册数据源 <select className="mp-onto-input" aria-label="注册数据源" value={sourceId} disabled={busy} onChange={e => { setSourceId(e.target.value); setSchema(null); setTable(''); setConfirmed(false); }}><option value="">请选择</option>{sources.filter(s => ['POSTGRES', 'CSV'].includes(s.sourceType)).map(s => <option key={s.sourceId} value={s.sourceId}>{s.name}</option>)}</select></label>
    <button className="mp-onto-btn" disabled={busy || !sourceId} onClick={() => void action(async current => { setSchema(null); setConfirmed(false); const probe = await testBigDataSourceConnection(sourceId); if (!probe.success) throw new Error(`${probe.error_code}: ${probe.message} · trace ${probe.trace_id}`); const discovered = await discoverBigDataSchema(sourceId); if (current()) setSchema(discovered); })}>验证连接并发现字段</button>
    {schema && <>
      <p>字段发现时间 {schema.discovered_at} · trace {schema.trace_id}</p>
      <label>源表 <select className="mp-onto-input" aria-label="源表" value={table} onChange={e => selectTable(e.target.value)}><option value="">请选择</option>{schema.tables.map(t => { const value = t.schema ? `${t.schema}.${t.name}` : t.name; return <option key={value} value={value}>{value}</option>; })}</select></label>
      {selected && <>
        <label>主键列 <select className="mp-onto-input" aria-label="主键列" value={pkColumn} onChange={e => { setPkColumn(e.target.value); setConfirmed(false); }}><option value="">请选择稳定唯一主键</option>{selected.columns.map(c => <option key={c.name} value={c.name}>{c.name}{c.primary_key ? '（主键）' : ''} · {c.type}</option>)}</select></label>
        {!csv && <label>时间列 <select className="mp-onto-input" aria-label="时间列" value={tsColumn} onChange={e => { setTsColumn(e.target.value); setConfirmed(false); }}><option value="">仅全量；增量需非空时间列</option>{selected.columns.filter(c => c.type.startsWith('timestamp') && c.nullable === false).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>}
        <table><thead><tr><th>目标属性</th><th>真实源列</th></tr></thead><tbody>{objectType?.properties.map(p => <tr key={p.rid}><td>{p.title || p.rid} · {p.type_id} · {p.nullable ? '可空' : '非空'}</td><td><select className="mp-onto-input" aria-label={`映射 ${p.title || p.rid}`} value={mapping[p.rid] ?? ''} onChange={e => { setMapping({ ...mapping, [p.rid]: e.target.value }); setConfirmed(false); }}><option value="">不映射</option>{selected.columns.map(c => <option key={c.name} value={c.name}>{c.name} · {c.type} · {c.nullable ? '可空' : '非空'}</option>)}</select></td></tr>)}</tbody></table>
        {conflicts.length > 0 && <div role="alert">{conflicts.join('；')}</div>}
        <label><input type="checkbox" aria-label="确认字段映射" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />确认字段映射（匹配建议需人工确认）</label>
        <button className="mp-onto-btn" disabled={busy || !confirmed || !pkColumn || conflicts.length > 0} onClick={() => void action(save)}>预检并保存映射</button>
        <button className="mp-onto-btn" disabled={busy} onClick={() => { setConfirmed(false); setSchema(null); setTable(''); setPkColumn(''); setTsColumn(''); setMapping({}); setDirty(false); discardEditorInput(key); }}>取消配置</button>
      </>}
    </>}
    <p>全量重跑按稳定主键更新，不重复新增，也不删除源中已移除的对象。CSV 为批量导入；删除连接配置会保留对象，后续同步明确失败。删除业务对象使用对象管理操作。</p>
    <div><button className="mp-onto-btn" disabled={busy || dirty || !rows.length} onClick={() => void action(current => sync(false, current))}>全量同步 / CSV批量导入</button> <button className="mp-onto-btn" disabled={busy || dirty || !rows.length || !rows.some(r => r.kind !== 'csv' && r.ts_column)} onClick={() => void action(current => sync(true, current))}>增量同步 / 重试</button> <button className="mp-onto-btn" disabled={busy || !classRid} onClick={() => void action(async current => { const declarations = await listBackingDatasources(classRid); if (current()) setRows(declarations); })}>刷新运行记录</button></div>
    <table><thead><tr><th>绑定</th><th>主键 / 时间</th><th>已处理游标</th></tr></thead><tbody>{rows.map(r => <tr key={r.rid}><td>{r.table_name} · {r.kind}</td><td>{r.pk_column} / {r.ts_column || '—'}</td><td>{r.last_synced_at || '—'} / {r.last_synced_pk || '—'}</td></tr>)}</tbody></table>
    {run && <p role="status">运行 {run.run_id} · {run.status} · 写入 {run.total_synced} · 失败 {run.total_failed} · 删除 {run.total_deleted} · trace {run.trace_id}</p>}
    <details open><summary>最近运行（最多20次）</summary>{history.map(r => <div key={r.run_id}><strong>{r.run_id} · {r.status}</strong><p>{r.started_at} → {r.ended_at ?? '执行中'} · 写入 {r.total_synced ?? '—'} · 失败 {r.total_failed ?? '—'} · trace {r.trace_id}</p>{r.error && <p role="alert">{r.error.message}</p>}<pre>{JSON.stringify(r.sources, null, 2)}</pre></div>)}</details>
  </fieldset>;
}
