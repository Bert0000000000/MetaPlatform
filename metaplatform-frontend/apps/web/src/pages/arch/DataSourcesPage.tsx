import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createBigDataSource, updateBigDataSource, deleteBigDataSource, listBigDataSources, testBigDataSourceConnection, discoverBigDataSchema, type BigDataSource, type SourceSchema } from '@/api/ontology-bigdata';

const blank: Partial<BigDataSource> = { name: '', sourceType: 'POSTGRES', host: '', port: 5432, database: '', schema: 'public', username: '', password: '', table: '' };
function diagnostic(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: { message?: string; trace_id?: string } } } })?.response?.data?.detail;
  return detail ? `${detail.message ?? '请求失败'} · trace ${detail.trace_id ?? '—'}` : error instanceof Error ? error.message : String(error);
}

export default function DataSourcesPage() {
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [form, setForm] = useState<Partial<BigDataSource>>({ ...blank });
  const [editing, setEditing] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [schema, setSchema] = useState<SourceSchema | null>(null);
  const load = async () => setSources(await listBigDataSources());
  useEffect(() => { void load().catch(e => setError(diagnostic(e))); }, []);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(diagnostic(e)); } finally { setBusy(false); }
  }
  return <section style={{ padding: 24, display: 'grid', gap: 16 }}>
    <h1>数据源</h1>
    <p>连接 → 发现真实字段 → 在本体中确认主键、时间列与映射 → 预检 → 同步。CSV 文件用于批量导入。</p>
    {error && <div role="alert">{error}<button className="mp-onto-btn" disabled={busy} onClick={() => void run(load)}>重新加载</button></div>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={e => { e.preventDefault(); void run(async () => {
      if (!form.name?.trim()) throw new Error('请输入数据源名称');
      const saved = editing ? await updateBigDataSource(editing, form) : await createBigDataSource(form);
      setForm({ ...blank }); setEditing(''); setSchema(null); await load();
      setMessage(`已保存 ${saved?.name ?? ''}，请测试连接并发现字段`);
    }); }} style={{ display: 'grid', gap: 10, maxWidth: 620 }}>
      <h2>{editing ? '编辑数据源' : '新建数据源'}</h2>
      <label>名称 <input className="mp-onto-input" required aria-label="数据源名称" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>类型 <select className="mp-onto-input" aria-label="数据源类型" value={form.sourceType} onChange={e => setForm({ ...blank, name: form.name, sourceType: e.target.value as 'POSTGRES' | 'CSV' })}><option value="POSTGRES">PostgreSQL</option><option value="CSV">CSV 批量导入</option></select></label>
      {form.sourceType === 'CSV' ? <>
        <label>UTF-8 CSV 文件 <input className="mp-onto-input" aria-label="CSV文件" type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setError('CSV 最大 10 MB'); return; } void file.text().then(csvContent => setForm(f => ({ ...f, csvContent }))); }} /></label>
        <label>表名 <input className="mp-onto-input" aria-label="CSV表名" value={form.table ?? ''} onChange={e => setForm({ ...form, table: e.target.value })} /></label>
      </> : <>
        {(['host', 'port', 'database', 'schema', 'username'] as const).map(key => <label key={key}>{({ host: '主机', port: '端口', database: '数据库', schema: 'Schema', username: '用户名' })[key]} <input className="mp-onto-input" aria-label={key} type={key === 'port' ? 'number' : 'text'} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: key === 'port' ? Number(e.target.value) : e.target.value })} /></label>)}
        <label>密码（编辑时留空保留） <input className="mp-onto-input" aria-label="密码" type="password" autoComplete="new-password" value={form.password ?? ''} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      </>}
      <div><button className="mp-onto-btn" disabled={busy} type="submit">保存数据源</button> <button className="mp-onto-btn" type="button" onClick={() => { setEditing(''); setForm({ ...blank }); }}>取消编辑</button></div>
    </form>
    <table><thead><tr><th>名称</th><th>类型</th><th>连接配置</th><th>操作</th></tr></thead><tbody>{sources.map(source => <tr key={source.sourceId}>
      <td>{source.name}</td><td>{source.sourceType}</td><td>{source.sourceType === 'CSV' ? '已上传批量文件' : `${source.host}:${source.port}/${source.database ?? ''}`}</td>
      <td><button className="mp-onto-btn" disabled={busy} onClick={() => { setEditing(source.sourceId); setForm({ ...source, password: '' }); }}>编辑</button> <button className="mp-onto-btn" disabled={busy} onClick={() => void run(async () => { setSchema(null); const result = await testBigDataSourceConnection(source.sourceId); if (!result.success) throw new Error(`${result.error_code}: ${result.message} · trace ${result.trace_id}`); setMessage(`连接已验证 · ${result.latency} ms · trace ${result.trace_id}`); })}>测试连接</button> <button className="mp-onto-btn" disabled={busy} onClick={() => void run(async () => { setSchema(null); setSchema(await discoverBigDataSchema(source.sourceId)); })}>发现字段</button> <Link to={`/ontology/data/mappings?source=${encodeURIComponent(source.sourceId)}`}>配置本体映射</Link> <button className="mp-onto-btn" disabled={busy} onClick={() => void run(async () => { if (!window.confirm('删除连接配置？已同步对象保留，后续同步将失败。')) return; await deleteBigDataSource(source.sourceId); setSchema(null); await load(); })}>删除</button></td>
    </tr>)}</tbody></table>
    {schema && <div><h2>真实字段</h2><p>发现时间 {schema.discovered_at} · trace {schema.trace_id}</p>{schema.tables.map(t => <div key={`${t.schema}.${t.name}`}><h3>{t.schema ? `${t.schema}.` : ''}{t.name}</h3><ul>{t.columns.map(c => <li key={c.name}>{c.name} · {c.type} · {c.primary_key ? '主键' : ''} {c.nullable === false ? '非空' : '可空'}</li>)}</ul></div>)}</div>}
  </section>;
}
