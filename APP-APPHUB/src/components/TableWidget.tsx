import { Card, Table, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DashboardWidget } from '@/api/pages';

interface TableWidgetProps {
  widget: DashboardWidget;
}

interface MockRow {
  id: string;
  name: string;
  value: number;
}

const MOCK_DATA: MockRow[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `${i + 1}`,
  name: `样本 ${i + 1}`,
  value: Math.floor(Math.random() * 1000),
}));

const MOCK_COLUMNS: ColumnsType<MockRow> = [
  { title: 'ID', dataIndex: 'id' },
  { title: '名称', dataIndex: 'name' },
  { title: '数值', dataIndex: 'value' },
];

export default function TableWidget({ widget }: TableWidgetProps) {
  return (
    <Card title={widget.title} size="small">
      {widget.dataSource ? (
        <Table
          rowKey="id"
          size="small"
          dataSource={MOCK_DATA}
          columns={MOCK_COLUMNS}
          pagination={false}
        />
      ) : (
        <Empty description="未配置数据源" />
      )}
    </Card>
  );
}
