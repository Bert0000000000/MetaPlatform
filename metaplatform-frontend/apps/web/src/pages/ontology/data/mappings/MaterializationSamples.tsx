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
  const columns = [
    ...new Set([
      ...Object.keys(result?.schema || {}),
      ...(result?.rows.flatMap((row) => Object.keys(row)) || []),
    ]),
  ];
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
                    {columns.map((name) => (
                      <th key={name}>
                        <code>{name}</code>
                        {result.schema[name] && (
                          <small>{cell(result.schema[name])}</small>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      {columns.map((name) => (
                        <td key={name}>{cell(row[name])}</td>
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
