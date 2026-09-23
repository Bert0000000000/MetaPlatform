import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tag } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { listSchemaWip, type SchemaWipEntry } from '@/api/ont/kernel';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import SchemaWipCard from '../../components/SchemaWipCard';
import { ridTail } from '../../rid';
import '../governance.css';
import '../../ontology.css';

const PAGE_SIZE = 20;

/**
 * 草稿（IA2-6 自 OpsPage 的 release tab 抽出为独立页）：
 * 正式路由 /ontology/governance/drafts。
 *
 * <p>Schema WIP（G33）：类型编辑器暂存的草稿清单——应用后按不可变版本发布。
 * 发布与治理组的默认入口。
 */
export default function DraftsPage() {
  const [rows, setRows] = useState<SchemaWipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listSchemaWip());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => `${r.rid} ${r.author}`.toLowerCase().includes(kw));
  }, [rows, keyword]);

  return (
    <>
      <PageHeader
        title="草稿"
        desc={`${rows.length} 条 Schema WIP · 应用后按不可变版本发布`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索类型或作者' }}
        filters={<Tag type="light">类型编辑器暂存后出现在这里</Tag>}
      />

      <DataTablePro<SchemaWipEntry>
        columns={[
          {
            title: '对象类型',
            dataIndex: '__label__',
            width: 260,
            ellipsis: true,
            render: (v: string) => <span className="mp-onto-strong">{ridTail(v)}</span>,
          },
          { title: 'rid', dataIndex: 'rid', width: 320, ellipsis: true },
          { title: '作者', dataIndex: 'author', width: 180, ellipsis: true },
          {
            title: '草稿字段',
            dataIndex: 'payload',
            width: 120,
            render: (v: Record<string, unknown>) => Object.keys(v ?? {}).length,
          },
          {
            title: '暂存时间',
            dataIndex: 'created_at',
            ellipsis: true,
            render: (v: string | undefined) => <span className="mp-onto-muted">{v ?? '—'}</span>,
          },
        ]}
        dataSource={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
        rowKey="rid"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          onChange: setPage,
        }}
        empty={
          <EmptyState
            illustration="no-content"
            title="当前没有待发布的 Schema WIP"
            desc="草稿在类型编辑器里暂存后会出现在这里。"
          />
        }
      />

      {/* 应用（破坏性 409 二段确认）/ 丢弃——原 GovernancePage 的操作卡随迁（IA2-6） */}
      <SchemaWipCard />
    </>
  );
}
