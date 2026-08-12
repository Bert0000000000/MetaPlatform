import { Table } from '@douyinfe/semi-ui';

type SemiTableProps = React.ComponentProps<typeof Table>;

interface DataTableProps extends SemiTableProps {}

export default function DataTable(props: DataTableProps) {
  return (
    <Table
      {...props}
      className={`v-table ${props.className ?? ''}`}
      pagination={props.pagination ?? { pageSize: 10 }}
      scroll={props.scroll ?? { x: 'max-content' }}
    />
  );
}
