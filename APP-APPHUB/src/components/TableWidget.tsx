import { Card, Table, Empty, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DashboardWidget } from '@/api/pages';
import { useDataSource } from '@/components/DashboardCanvas';

interface TableWidgetProps {
  widget: DashboardWidget;
}

interface TableRow {
  id: string;
  name: string;
  value: number;
}

const MOCK_COLUMNS: ColumnsType<TableRow> = [
  { title: 'ID', dataIndex: 'id' },
  { title: '名称', dataIndex: 'name' },
  { title: '数值', dataIndex: 'value' },
];

function toTableRows(data: unknown[]): TableRow[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((item, i) => {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        id: typeof obj.id === 'string' ? obj.id : String(obj.id ?? i + 1),
        name: typeof obj.name === 'string' ? obj.name : String(obj.name ?? ''),
        value: typeof obj.value === 'number' ? obj.value : Number(obj.value ?? 0),
      };
    }
    return { id: String(i + 1), name: String(item), value: 0 };
  });
}

export default function TableWidget({ widget }: TableWidgetProps) {
  const { data, loading } = useDataSource(widget.dataSource);
  const rows = toTableRows(data);

  return (
    <Card title={widget.title} size="small">
      {widget.dataSource ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <Table
            rowKey="id"
            size="small"
            dataSource={rows}
            columns={MOCK_COLUMNS}
            pagination={false} scroll={{ x: 'max-content' }} />
        )
      ) : (
        <Empty description="未配置数据源" />
      )}
    </Card>
  );
}
