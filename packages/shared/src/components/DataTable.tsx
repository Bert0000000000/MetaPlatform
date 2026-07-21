import { ReactNode } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { StateContainer } from './StateViews';

interface DataTableProps<T> {
  /** 行数据 */
  dataSource: T[];
  /** 列定义（与 AntD Table 一致） */
  columns: TableProps<T>['columns'];
  /** 行 key 取值函数或字段名 */
  rowKey: string | ((record: T) => string);
  /** 加载中 */
  loading?: boolean;
  /** 错误（传入后将渲染 ErrorState 而不是 Table） */
  error?: Error | string | null;
  /** 是否空数据（默认根据 dataSource.length === 0 判断） */
  isEmpty?: boolean;
  /** 空数据描述 */
  emptyDescription?: ReactNode;
  /** 重试回调 */
  onRetry?: () => void;
  /** 分页大小，默认 10；传 false 关闭分页 */
  pageSize?: number | false;
  /** 表格尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 其他透传给 AntD Table 的属性 */
  tableProps?: Omit<TableProps<T>, 'dataSource' | 'columns' | 'rowKey' | 'loading' | 'pagination' | 'size'>;
}

/**
 * 统一的数据表格：在 AntD Table 基础上内置 loading / error / empty 状态切换。
 *
 * 用于替代各 APP 中重复的 `loading ? <Spin/> : error ? <Result/> : <Table/>` 模板。
 * 当 error 不为空时渲染 ErrorState；dataSource 为空时由 Table 自身渲染空态。
 *
 * @example
 * <DataTable
 *   dataSource={employees}
 *   columns={columns}
 *   rowKey="id"
 *   loading={loading}
 *   error={error}
 *   onRetry={reload}
 * />
 */
export function DataTable<T extends object>({
  dataSource,
  columns,
  rowKey,
  loading = false,
  error = null,
  isEmpty,
  emptyDescription,
  onRetry,
  pageSize = 10,
  size = 'middle',
  tableProps,
}: DataTableProps<T>) {
  const empty = isEmpty ?? dataSource.length === 0;
  return (
    <StateContainer
      loading={loading}
      error={error}
      isEmpty={false}
      onRetry={onRetry}
    >
      <Table<T>
        rowKey={rowKey as never}
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        size={size}
        pagination={pageSize === false ? false : { pageSize, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        locale={empty && emptyDescription ? { emptyText: emptyDescription } : undefined}
        {...tableProps}
      />
    </StateContainer>
  );
}
