import { useCallback, useEffect, useRef, useState } from 'react';
import { listVersions, type KernelVersion } from '@/api/ont/kernel';
import { DataTablePro } from '@/components/skeleton';
import { resourceError } from '../hooks/resourceErrors';
/** Shared immutable KernelVersion history for type details and release workflows. */
export default function VersionHistory({
  rid,
  currentChecksum,
}: {
  rid: string;
  currentChecksum?: string;
}) {
  const [rows, setRows] = useState<KernelVersion[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    setLoading(true);
    setRows([]);
    setError('');
    try {
      const r = await listVersions(rid);
      if (n === generation.current) setRows(r);
    } catch (e) {
      if (n === generation.current) setError(resourceError(e));
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [rid]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  return error ? (
    <div role="alert" className="mw-error">
      版本历史 · {error}{' '}
      <button onClick={() => void load()}>重试版本历史</button>
    </div>
  ) : (
    <DataTablePro<KernelVersion>
      columns={[
        {
          title: '版本',
          dataIndex: 'version_no',
          width: 80,
          render: (v: number) => `v${v}`,
        },
        {
          title: '状态',
          key: 'effective',
          dataIndex: 'checksum',
          width: 120,
          render: (v: string, row: KernelVersion) =>
            currentChecksum && v === currentChecksum ? '当前生效' : row.status,
        },
        { title: '时间', dataIndex: 'created_at', width: 190 },
        { title: '作者', dataIndex: 'author', width: 120 },
        {
          title: '快照名称',
          dataIndex: 'definition',
          render: (d: Record<string, unknown>) => String(d.display_name || '—'),
        },
        {
          title: '变更',
          dataIndex: 'change_set',
          render: (v: string[]) => v.join('；'),
        },
        { title: 'Checksum', dataIndex: 'checksum', ellipsis: true },
      ]}
      dataSource={rows}
      rowKey="rid"
      loading={loading}
      empty={<p>暂无已发布版本快照</p>}
    />
  );
}
