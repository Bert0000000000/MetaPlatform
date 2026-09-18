import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  type DataTableProProps,
} from '@/components/skeleton';

const DEFAULT_PAGE_SIZE = 20;

export interface KernelPrimitiveListPageProps<T extends object> {
  /** 页面标题（如「关系类型」）。 */
  title: string;
  /** 列表 API（失败自动落错误态 + 重试）。 */
  load: () => Promise<T[]>;
  rowKey: (row: T) => string;
  /** 搜索匹配的字符串堆（与原 ModelingPage 各 kind 的 match 逻辑一致）。 */
  searchText: (row: T) => string;
  /** 列定义与 DataTablePro 一致（Semi Column[]）。 */
  columns: DataTableProProps<T>['columns'];
  searchPlaceholder: string;
  /** 额外头部动作（如对象类型页的「新建本体」）。 */
  actions?: ReactNode;
  pageSize?: number;
}

/**
 * 12 基元清单页的共享骨架（IA2-2 从 ModelingPage 抽出，只抽取不复制）。
 *
 * <p>每个基元（关系 / 接口 / 公理 / 动作 / 函数）一个独立路由页，共用水位：
 * PageHeader（标题 + 实时计数）→ FilterBar（搜索）→ DataTablePro（分页），
 * 读取失败给错误态 + 重试。原容器里的 7-kind 横向 Tab 随拆分消亡
 * （ADR-0069：不再用页面内部 useState 充当产品导航）。
 */
export default function KernelPrimitiveListPage<T extends object>({
  title,
  load,
  rowKey,
  searchText,
  columns,
  searchPlaceholder,
  actions,
  pageSize = DEFAULT_PAGE_SIZE,
}: KernelPrimitiveListPageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const kw = keyword.trim().toLowerCase();
  const filtered = useMemo(
    () => (kw ? rows.filter((r) => searchText(r).toLowerCase().includes(kw)) : rows),
    [rows, kw, searchText],
  );
  const pageOf = (list: T[]) => list.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <PageHeader
        title={title}
        desc={
          loading && rows.length === 0
            ? '数据取自本体内核 v2'
            : `${rows.length} 个${title} · 数据取自本体内核 v2`
        }
        actions={
          <>
            {actions}
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void reload()}
            >
              刷新
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: searchPlaceholder }} />

      {error ? (
        <EmptyState
          illustration="failure"
          title="本体内核读取失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void reload()}>
              重试
            </Button>
          }
        />
      ) : (
        <DataTablePro<T>
          columns={columns}
          dataSource={pageOf(filtered)}
          rowKey={rowKey}
          loading={loading}
          pagination={{
            currentPage: page,
            pageSize,
            total: filtered.length,
            onChange: setPage,
          }}
          empty={
            <EmptyState
              illustration="no-result"
              title={`没有匹配的${title}`}
              desc="换个关键词试试。"
            />
          }
        />
      )}
    </>
  );
}
