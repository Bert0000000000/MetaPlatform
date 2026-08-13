import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Spin, Timeline, Typography } from '@douyinfe/semi-ui';
import { ReloadOutlined } from '@ant-design/icons';
import { getEmployeeOperationLogs } from '@/api/dw/employees';
import type { EmployeeOperationLog } from '@/api/dw/types';

const { Text } = Typography;

interface OperationLogPanelProps {
  employeeId: string;
}

function formatTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    CLONE: '克隆',
    ACTIVATE: '启用',
    DEACTIVATE: '停用',
    CONFIG_UPDATE: '配置变更',
  };
  return map[action] || action;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const dataSource = useMemo(
    () =>
      logs.map((log) => ({
        time: formatTime(log.timestamp),
        type: (log.status === 'success' ? 'success' : 'error') as 'success' | 'error',
        extra: log.actor,
        content: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 13 }}>{actionLabel(log.action)}</Text>
            {log.resource && (
              <Text type="tertiary" style={{ fontSize: 12 }}>· {log.resource}</Text>
            )}
            {log.ip && (
              <Text type="tertiary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                · {log.ip}
              </Text>
            )}
          </div>
        ),
      })),
    [logs],
  );

  if (loading) {
    return (
      <Card title="操作日志">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="操作日志"
      headerExtraContent={
        <Button icon={<ReloadOutlined />} onClick={load} size="small">刷新</Button>
      }
      bodyStyle={{ padding: error ? 16 : '8px 16px 0' }}
    >
      {error ? (
        <Empty description={`加载失败：${error.message}`} />
      ) : logs.length === 0 ? (
        <Empty description="暂无操作日志" />
      ) : (
        <Timeline dataSource={dataSource} />
      )}
    </Card>
  );
}
