import { useEffect, useState } from 'react';
import { Button, Card, Empty, Spin, Table, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { getEmployeeOperationLogs } from '@/api/dw/employees';
import type { EmployeeOperationLog } from '@/api/dw/types';

type SemiColumns<T> = ColumnProps<T & Record<string, any>>[];

interface OperationLogPanelProps {
  employeeId: string;
}

export default function OperationLogPanel({ employeeId }: OperationLogPanelProps) {
  const [logs, setLogs] = useState<EmployeeOperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeeOperationLogs(employeeId);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [employeeId]);

  const columns: SemiColumns<EmployeeOperationLog> = [
    { title: '操作人', dataIndex: 'actor', width: 100 },
    { title: '动作', dataIndex: 'action', width: 100 },
    { title: '资源', dataIndex: 'resource', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : '失败'}</Tag>
      ),
    },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    {
      title: '时间',
      dataIndex: 'timestamp',
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  if (loading) {
    return (
      <Card title="操作日志">
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="操作日志"
        headerExtraContent={
          <Button icon={<ReloadOutlined />} onClick={load} size="small">
            重试
          </Button>
        }
      >
        <Empty description={`加载失败：${error.message}`} />
      </Card>
    );
  }

  return (
    <Card
      title="操作日志"
      headerExtraContent={<Button icon={<ReloadOutlined />} onClick={load} size="small">刷新</Button>}
    >
      {logs.length === 0 ? (
        <Empty description="暂无操作日志" />
      ) : (
        <Table
          rowKey="id"
          dataSource={logs}
          columns={columns}
          pagination={{ pageSize: 10 }}
          size="small" scroll={{ x: 'max-content' }} />
      )}
    </Card>
  );
}
