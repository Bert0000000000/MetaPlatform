import { Card, Empty, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface OpLog {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  ip?: string;
  status: 'success' | 'failed';
}

const MOCK_LOGS: OpLog[] = [
  { id: '1', actor: 'admin', action: '修改配置', resource: 'capability', timestamp: '2026-07-17T09:00:00Z', ip: '10.10.10.1', status: 'success' },
  { id: '2', actor: 'admin', action: '激活', resource: 'employee', timestamp: '2026-07-17T08:00:00Z', ip: '10.10.10.1', status: 'success' },
  { id: '3', actor: 'system', action: '自动重试', resource: 'task-1234', timestamp: '2026-07-16T15:30:00Z', status: 'success' },
];

export default function OperationLogPanel() {
  const columns: ColumnsType<OpLog> = [
    { title: '操作人', dataIndex: 'actor' },
    { title: '动作', dataIndex: 'action' },
    { title: '资源', dataIndex: 'resource' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => (
        <Tag color={v === 'success' ? 'green' : 'red'}>{v}</Tag>
      ),
    },
    { title: 'IP', dataIndex: 'ip' },
    {
      title: '时间',
      dataIndex: 'timestamp',
      render: (v) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Card title="操作日志">
      {MOCK_LOGS.length === 0 ? (
        <Empty />
      ) : (
        <Table
          rowKey="id"
          dataSource={MOCK_LOGS}
          columns={columns}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      )}
    </Card>
  );
}
