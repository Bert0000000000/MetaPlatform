import { Button, Checkbox, Pagination, Popover, Table } from '@douyinfe/semi-ui';
import { useMemo, useState, type ReactNode } from 'react';
import { Columns3 } from 'lucide-react';

type SemiTableProps = React.ComponentProps<typeof Table>;
type SemiColumn = NonNullable<SemiTableProps['columns']>[number];

export interface DataTableProPagination {
  currentPage: number;
  pageSize: number;
  total: number;
  onChange: (currentPage: number) => void;
  /** 传入即启用「每页条数」切换（服务端分页的列表页通常需要） */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface DataTableProSelection<T> {
  selectedRowKeys: Array<string | number>;
  onChange: (keys: Array<string | number>) => void;
  getCheckboxProps?: (record: T) => { disabled?: boolean };
}

export interface DataTableProProps<T extends object> {
  columns: SemiColumn[];
  dataSource: T[];
  rowKey: SemiTableProps['rowKey'];
  loading?: boolean;
  /** 传入即启用勾选列 + 底部「已选 n 项 · 清除」 */
  rowSelection?: DataTableProSelection<T>;
  /** 传入才渲染分页条（受控，便于和 URL / 服务端分页对齐） */
  pagination?: DataTableProPagination;
  onRow?: SemiTableProps['onRow'];
  /** 空态插槽；不传用 Semi Table 自带空态 */
  empty?: ReactNode;
  /** 列显隐入口，默认开启 */
  columnSettings?: boolean;
  scroll?: SemiTableProps['scroll'];
  className?: string;
}

/** 列的唯一标识：key → dataIndex → title。 */
function columnId(column: SemiColumn, index: number): string {
  const c = column as { key?: string; dataIndex?: string | string[]; title?: unknown };
  if (c.key) return c.key;
  if (typeof c.dataIndex === 'string') return c.dataIndex;
  if (Array.isArray(c.dataIndex)) return c.dataIndex.join('.');
  if (typeof c.title === 'string') return c.title;
  return `col-${index}`;
}

/**
 * DataTablePro —— 五骨架里「E 表格页 / B 两栏浏览器」共用的表格层，
 * 基于 Semi Table 封装：勾选、列头排序/列宽（由 columns 的 sorter + resizable 驱动）、
 * 列显隐、40px 行高（DSM 主题 $spacing-table_tbody_rowCell-padding 已定）、
 * 底部「已选 n 项 · 清除」+ 受控分页。
 */
export default function DataTablePro<T extends object>({
  columns,
  dataSource,
  rowKey,
  loading,
  rowSelection,
  pagination,
  onRow,
  empty,
  columnSettings = true,
  scroll,
  className,
}: DataTableProProps<T>) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const identified = useMemo(
    () => columns.map((c, i) => ({ id: columnId(c, i), column: c })),
    [columns],
  );

  const visibleColumns = useMemo(
    () =>
      (hiddenIds.length
        ? identified.filter((c) => !hiddenIds.includes(c.id)).map((c) => c.column)
        : columns),
    [identified, hiddenIds, columns],
  );

  const selectedCount = rowSelection?.selectedRowKeys.length ?? 0;

  const settings = columnSettings && identified.length > 1 ? (
    <Popover
      trigger="click"
      position="bottomRight"
      content={
        <div className="mp-table-columns">
          <Checkbox.Group
            value={identified.map((c) => c.id).filter((id) => !hiddenIds.includes(id))}
            onChange={(next) => {
              const kept = next as string[];
              setHiddenIds(identified.map((c) => c.id).filter((id) => !kept.includes(id)));
            }}
          >
            {identified.map((c) => (
              <Checkbox key={c.id} value={c.id}>
                {typeof (c.column as { title?: unknown }).title === 'string'
                  ? ((c.column as { title?: string }).title as string)
                  : c.id}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      }
    >
      <Button
        theme="borderless"
        type="tertiary"
        icon={<Columns3 size={16} strokeWidth={1.5} />}
        aria-label="列设置"
      />
    </Popover>
  ) : null;

  return (
    <div className={className ? `mp-tablepro ${className}` : 'mp-tablepro'}>
      {settings ? <div className="mp-table-toolbar">{settings}</div> : null}

      <Table
        className="mp-table"
        columns={visibleColumns}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        pagination={false}
        resizable
        onRow={onRow}
        empty={empty}
        scroll={scroll}
        rowSelection={
          rowSelection
            ? {
                selectedRowKeys: rowSelection.selectedRowKeys,
                onChange: (keys?: Array<string | number>) => rowSelection.onChange(keys ?? []),
                getCheckboxProps: rowSelection.getCheckboxProps,
              }
            : undefined
        }
      />

      {(rowSelection && selectedCount > 0) || pagination ? (
        <div className="mp-table-foot">
          {rowSelection && selectedCount > 0 ? (
            <span className="mp-table-foot-count">
              已选 {selectedCount} 项
              <Button
                theme="borderless"
                type="primary"
                size="small"
                onClick={() => rowSelection.onChange([])}
              >
                清除
              </Button>
            </span>
          ) : (
            <span className="mp-table-foot-count" />
          )}

          {pagination ? (
            <Pagination
              className="mp-table-foot-pager"
              currentPage={pagination.currentPage}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={pagination.onChange}
              showSizeChanger={Boolean(pagination.onPageSizeChange)}
              pageSizeOpts={pagination.pageSizeOptions ?? [10, 20, 50, 100]}
              onPageSizeChange={pagination.onPageSizeChange}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
