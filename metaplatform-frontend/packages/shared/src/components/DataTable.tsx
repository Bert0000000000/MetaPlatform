import { Table } from 'antd';
import type { TableProps } from 'antd';

interface DataTableProps<T extends object = object> extends TableProps<T> {}

export default function DataTable<T extends object = object>(props: DataTableProps<T>) {
  return (
    <Table<T>
      {...props}
      className={`v-table ${props.className ?? ''}`}
      pagination={props.pagination ?? { pageSize: 10 }}
      scroll={props.scroll ?? { x: 'max-content' }}
    />
  );
}
