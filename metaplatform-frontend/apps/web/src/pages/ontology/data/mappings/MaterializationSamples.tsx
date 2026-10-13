import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import {
  getMaterialization,
  type MaterializationResult,
} from '@/api/ont/kernel';
import { resourceError } from '../../hooks/resourceErrors';
function cell(value: unknown): string {
  return value == null
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
}
function descriptor(value: unknown): { label?: string; type?: string; rid?: string; slug?: string } {
  if (typeof value === 'string') return { type: value };
  if (!value || typeof value !== 'object') return {};
  const field = value as Record<string, unknown>;
  const actual = (key: string) => typeof field[key] === 'string' ? field[key] as string : undefined;
  return { label: actual('title') || actual('slug'), type: actual('type') || actual('format') || actual('type_id'), rid: actual('rid'), slug: actual('slug') };
}
function businessSlug(rid: string): string {
  return rid.replace(/\.v\d+$/, '').split('.').at(-1) || rid;
}
function sampleColumns(result: MaterializationResult | undefined, typeRid: string): Array<{ name: string; field: ReturnType<typeof descriptor>; keys: string[] }> {
  const typeSlug = businessSlug(typeRid);
  const model = Object.entries(result?.schema || {}).map(([name, metadata]) => {
    const field = descriptor(metadata);
    const slug = field.slug || businessSlug(field.rid || name);
    const legacy = slug.startsWith(`${typeSlug}-`) ? slug.slice(typeSlug.length + 1) : '';
    return { name, field, keys: [...new Set([name, field.rid, slug, legacy].filter((key): key is string => !!key))] };
  });
  const owners = new Map<string, number>();
  for (const column of model) for (const key of column.keys) owners.set(key, (owners.get(key) || 0) + 1);
  const columns = model.map(column => ({ ...column, keys: column.keys.filter(key => key === column.name || owners.get(key) === 1) }));
  const known = new Set(columns.flatMap(column => column.keys));
  const extras = [...new Set(result?.rows.flatMap(row => Object.keys(row)) || [])].filter(key => !known.has(key));
  return [...columns, ...extras.map(name => ({ name, field: {}, keys: [name] }))];
}
function sampleValue(row: Record<string, unknown>, keys: string[]): unknown {
  const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(row, candidate));
  return key === undefined ? undefined : row[key];
}
/** Type-scoped GET state survives source-editor composition and selection. */
export function useMaterializationSamples(typeRid: string) {
  const [result, setResult] = useState<MaterializationResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const read = useCallback(async () => {
    const generation = ++request.current;
    setLoading(true);
    setError('');
    try {
      const actual = await getMaterialization(typeRid);
      if (generation === request.current) setResult(actual);
    } catch (cause) {
      if (generation === request.current) setError(resourceError(cause));
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }, [typeRid]);
  useEffect(() => {
    void read();
    return () => {
      ++request.current;
    };
  }, [read]);
  return { result, loading, error, read };
}
/** A GET-only materialization view; no source-schema or source-preview data is invented. */
export default function MaterializationSamples({
  typeRid,
  state,
}: {
  typeRid: string;
  state: ReturnType<typeof useMaterializationSamples>;
}) {
  const { result, loading, error, read } = state;
  const columns = sampleColumns(result, typeRid);
  return (
    <section className="mp-mapping-card mp-mapping-samples">
      <div className="mp-mapping-toolbar">
        <h3>物化样本</h3>
        <Button loading={loading} onClick={() => void read()}>
          读取物化样本
        </Button>
      </div>
      <p className="mp-mapping-muted">
        来源：当前对象类型的物化结果（{typeRid}）；读取不启动来源同步。
      </p>
      {loading && <p role="status">正在读取物化样本…</p>}
      {error && (
        <p role="alert">
          {result ? 'stale · ' : ''}物化样本读取失败 · {error}
        </p>
      )}
      {result && (
        <>
          <p>
            服务端计数 {result.count} · 获取时间{' '}
            {result.generated_at || '未返回'}
          </p>
          {!result.rows.length ? (
            <p>物化结果为空</p>
          ) : (
            <div className="mp-mapping-table-scroll">
              <table className="mp-mapping-table">
                <thead>
                  <tr>
                    {columns.map(({ name, field }) => {
                      return <th key={name}>
                        {field.label && <span>{field.label}</span>}
                        <code>{name}</code>
                        {field.type && <small>{field.type}</small>}
                        {field.rid && <details><summary>属性标识</summary><code>{field.rid}</code></details>}
                      </th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      {columns.map(({ name, keys }) => (
                        <td key={name}>{cell(sampleValue(row, keys))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
